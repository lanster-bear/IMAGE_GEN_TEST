import http from 'node:http';
import { spawn } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { readFile, mkdir, writeFile, unlink } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadConfig, sanitize, ROOT } from './config.mjs';
import { ImageProvider } from './provider.mjs';
import { JobStore, InputError } from './jobs.mjs';
import { acquireServiceLock } from './service-lock.mjs';

const APP = 'image-gen-studio';
const CONTENT_TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

async function readBody(request) {
  let bytes = 0; const chunks = [];
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 64 * 1024) throw new InputError('请求体过大。', 413);
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new InputError('请求体不是有效 JSON。'); }
}

export async function createStudio(config, provider = new ImageProvider(config)) {
  const store = new JobStore(config, provider);
  await store.init();
  const token = randomBytes(32).toString('hex');
  let models = [], modelError = null, modelUpdatedAt = null, refreshing = null;
  let stopping = false;

  function refreshModels() {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      try { models = await provider.models(); modelError = null; modelUpdatedAt = new Date().toISOString(); }
      catch (error) { modelError = sanitize(error.message, config.apiKey); }
      finally { refreshing = null; }
    })();
    return refreshing;
  }
  const ready = refreshModels();

  const server = http.createServer(async (request, response) => {
    function json(body, status = 200) {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify(body));
    }
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    try {
      const allowedHosts = new Set([`127.0.0.1:${server.address()?.port}`, `localhost:${server.address()?.port}`]);
      if (!allowedHosts.has(request.headers.host)) throw new InputError('只允许通过本机地址访问。', 403);
      const url = new URL(request.url, `http://${request.headers.host}`);
      if (request.method === 'POST') {
        const origin = request.headers.origin;
        if (origin && ![`http://127.0.0.1:${server.address().port}`, `http://localhost:${server.address().port}`].includes(origin)) throw new InputError('已阻止跨站请求。', 403);
        if (request.headers['x-studio-token'] !== token) throw new InputError('请求验证失败，请刷新页面。', 403);
        if (!request.headers['content-type']?.startsWith('application/json')) throw new InputError('请使用 application/json 请求。', 415);
      }
      if (request.method === 'GET' && url.pathname === '/api/health') return json({ app: APP, status: 'ok', pid: process.pid, pending: store.list().filter(job => ['queued', 'running'].includes(job.status)).length, busy: store.draining, outputDirectory: config.outputDir });
      if (request.method === 'POST' && url.pathname === '/api/desktop/stop' && config.desktop) {
        if (store.draining || store.list().some(job => ['queued', 'running'].includes(job.status))) throw new InputError('生成任务仍在处理中，请等待完成后关闭工作台。', 409);
        stopping = true;
        response.setHeader('Connection', 'close');
        json({ status: 'stopping' });
        server.close();
        server.closeIdleConnections();
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/config') {
        await ready;
        return json({ app: APP, token, configured: Boolean(config.baseUrl && config.apiKey), endpoint: config.baseUrl,
          models, modelError, modelUpdatedAt, defaultModel: models.find(item => item.id === config.preferredModel)?.id || models[0]?.id || '',
          sizes: config.sizes, defaultSize: config.defaultSize, maxImages: config.maxImages, maxPromptLength: config.maxPromptLength,
          templates: config.templates, outputDirectory: config.outputDir, timeoutSeconds: config.timeoutMs / 1000 });
      }
      if (request.method === 'POST' && url.pathname === '/api/models/refresh') { await refreshModels(); return json({ models, modelError, modelUpdatedAt }); }
      if (request.method === 'GET' && url.pathname === '/api/jobs') return json({ jobs: store.list() });
      if (request.method === 'DELETE' && url.pathname === '/api/jobs/batch') {
        const body = await readBody(request);
        if (!Array.isArray(body.ids)) throw new InputError('ids 必须是数组。', 400);
        const deleted = [];
        for (const id of body.ids) {
          const job = store.jobs.get(id);
          if (!job) continue;
          if (['queued', 'running'].includes(job.status)) throw new InputError(`任务 ${id} 正在执行，无法删除。`, 409);
          await store.deleteJob(id);
          deleted.push(id);
        }
        return json({ deleted: deleted.length });
      }
      if (request.method === 'GET' && /^\/api\/jobs\/[0-9a-f-]+$/i.test(url.pathname)) {
        const job = store.jobs.get(url.pathname.split('/').pop());
        if (!job) throw new InputError('任务不存在。', 404);
        return json(job);
      }
      if (request.method === 'POST' && url.pathname === '/api/jobs') {
        if (stopping) throw new InputError('工作台正在关闭，请稍后重新打开。', 503);
        await ready;
        if (stopping) throw new InputError('工作台正在关闭，请稍后重新打开。', 503);
        if (!models.length) throw new InputError(modelError || '模型列表尚未就绪。', 503);
        return json(await store.create(await readBody(request), models), 202);
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') throw new InputError('不支持此请求方式。', 405);
      let filename;
      if (/^\/outputs\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]+-\d+\.(png|jpg|webp)$/.test(url.pathname)) filename = path.join(config.outputDir, url.pathname.slice(9));
      else if (['/', '/index.html', '/styles.css', '/app.js', '/favicon.svg'].includes(url.pathname)) filename = path.join(config.publicDir || path.join(config.root, 'public'), url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
      else throw new InputError('文件不存在。', 404);
      let content;
      try { content = await readFile(filename); }
      catch (error) { if (error.code === 'ENOENT') throw new InputError('文件不存在。', 404); throw error; }
      if (url.searchParams.has('download')) response.setHeader('Content-Disposition', `attachment; filename="${path.basename(filename)}"`);
      response.writeHead(200, { 'Content-Type': CONTENT_TYPES[path.extname(filename)], 'Cache-Control': 'no-cache' });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch (error) {
      if (!response.headersSent) json({ error: sanitize(error.message, config.apiKey) }, error.status || 500);
      else response.end();
    }
  });
  return { server, store, ready, token };
}

function portableLog(message) {
  if (process.env.STUDIO_PORTABLE !== '1') return;
  try {
    const dir = path.join(ROOT, '.data');
    mkdirSync(dir, { recursive: true });
    appendFileSync(path.join(dir, 'portable.log'), `${new Date().toISOString()} ${message}\n`);
  } catch { /* A log failure must not hide the startup error. */ }
}

function openLocalPage(url) {
  if (process.env.STUDIO_OPEN === '0') return;
  if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  else spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
}

async function reuseRunningStudio(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(2000) });
    const body = await response.json();
    if (body.app !== APP) return false;
    openLocalPage(`http://127.0.0.1:${port}`);
    portableLog(`已有工作台在运行，打开 http://127.0.0.1:${port}`);
    return true;
  } catch { return false; }
}

export async function startStudio() {
  let releaseLock;
  try {
    try { process.loadEnvFile(path.join(ROOT, '.env')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const config = await loadConfig();
    config.desktop = process.env.STUDIO_DESKTOP === '1';
    if (process.env.STUDIO_PORTABLE === '1' && !config.desktop && await reuseRunningStudio(config.port)) return;
    await mkdir(config.dataDir, { recursive: true });
    releaseLock = await acquireServiceLock(config.dataDir);
    const { server, token } = await createStudio(config);
    const infoPath = config.desktop && process.env.STUDIO_DESKTOP_INFO;
    server.on('close', async () => {
      await releaseLock();
      if (infoPath) await unlink(infoPath).catch(() => {});
      if (config.desktop) process.exit(0);
    });
    const url = `http://127.0.0.1:${config.port}`;
    server.on('error', error => {
      const message = error.code === 'EADDRINUSE' ? `端口 ${config.port} 已占用，请检查已有服务或设置 PORT。` : sanitize(error.message);
      portableLog(message); console.error(message); process.exitCode = 1;
      releaseLock().finally(() => { if (config.desktop) process.exit(1); });
    });
    server.listen(config.port, '127.0.0.1', () => {
      const message = `Image Studio 已启动：${url}\n图片保存：${config.outputDir}\n密钥仅由本地服务读取。`;
      portableLog(message.replaceAll('\n', ' ')); console.log(message);
      if (infoPath) writeFile(infoPath, JSON.stringify({ app: APP, pid: process.pid, port: config.port, token }), 'utf8').catch(error => {
        portableLog(sanitize(error.message)); server.close();
      });
      if (process.env.STUDIO_PORTABLE === '1') openLocalPage(url);
    });
  } catch (error) {
    if (releaseLock) await releaseLock();
    const message = sanitize(error.message);
    portableLog(message); console.error(message); process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await startStudio();

import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { loadConfig, ROOT } from '../server/config.mjs';

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('用法：npm run generate -- --prompt "画面描述" [--model 模型ID] [--size 1024x1024] [--quality high]');
  process.exit(0);
}
const allowed = new Set(['prompt', 'model', 'size', 'quality']);
const options = {};
for (let i = 0; i < args.length; i += 2) {
  const name = args[i].replace(/^--/, '');
  if (!allowed.has(name) || !args[i + 1]) { console.error('参数无效。运行 npm run generate -- --help 查看用法。'); process.exit(1); }
  options[name] = args[i + 1];
}
if (!options.prompt?.trim()) { console.error('请使用 --prompt 提供提示词。'); process.exit(1); }

try {
  try { process.loadEnvFile(path.join(ROOT, '.env')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const config = await loadConfig();
  const base = `http://127.0.0.1:${config.port}`;
  let token;
  async function request(endpoint, body) {
    const response = await fetch(`${base}${endpoint}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'X-Studio-Token': token || '' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    return result;
  }
  const settings = await request('/api/config'); token = settings.token;
  const job = await request('/api/jobs', { ...options, model: options.model || settings.defaultModel, size: options.size || settings.defaultSize, quality: options.quality || 'auto', requestId: randomUUID(), n: 1 });
  console.log(`已提交任务 ${job.id}。不自动重试；可以关闭此命令，服务端继续处理。`);
  const deadline = Date.now() + config.timeoutMs + 90000;
  while (Date.now() < deadline) {
    const current = await request(`/api/jobs/${job.id}`);
    if (current.status === 'completed') {
      console.log(JSON.stringify({ id: job.id, files: current.images.map(image => path.join(config.outputDir, image.url.slice('/outputs/'.length))), elapsedSeconds: current.elapsedMs / 1000 }, null, 2));
      process.exit(0);
    }
    if (['failed', 'interrupted'].includes(current.status)) throw new Error(current.error);
    await delay(1500);
  }
  throw new Error(`等待超时。请在作品库检查任务 ${job.id}，不要立即重新提交。`);
} catch (error) {
  console.error(error.message === 'fetch failed' ? '无法连接本地工作台。请先双击 Start Studio.cmd。' : error.message);
  process.exitCode = 1;
}

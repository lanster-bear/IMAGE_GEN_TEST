import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { ROOT } from '../server/config.mjs';

let requests = 0;
let png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jAZcAAAAASUVORK5CYII=', 'base64');
try { png = await readFile(path.join(ROOT, 'outputs/2026-10-09/9b5ae1c0-7049-4957-b793-141555d713de-1.png')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const provider = http.createServer(async (request, response) => {
  response.setHeader('Content-Type', 'application/json');
  if (request.method === 'GET' && request.url === '/v1/models') return response.end(JSON.stringify({ data: [{ id: 'gpt-image-native-fixture' }] }));
  if (request.method === 'POST' && request.url === '/v1/images/generations') {
    requests += 1;
    for await (const chunk of request) {}
    await delay(2500);
    return response.end(JSON.stringify({ data: [{ b64_json: png.toString('base64') }] }));
  }
  response.writeHead(404);
  response.end('{}');
});
provider.listen(0, '127.0.0.1');
await once(provider, 'listening');
const root = path.join(ROOT, '.data/desktop-qa');
const runId = randomUUID();
let timeoutHandle;
try {
  const options = { cwd: ROOT, env: { ...process.env, STUDIO_QA_PROVIDER_URL: `http://127.0.0.1:${provider.address().port}`, STUDIO_QA_RUN_ID: runId }, windowsHide: false };
  const child = spawn(path.join(ROOT, 'Image Studio.exe'), ['--smoke-test'], options);
  const exited = once(child, 'exit');
  await delay(900);
  const second = spawn(path.join(ROOT, 'Image Studio.exe'), ['--smoke-test'], options);
  assert.equal((await once(second, 'exit'))[0], 0);
  const timeout = new Promise((resolve, reject) => { timeoutHandle = setTimeout(() => reject(new Error('原生桌面验收超时；保留窗口供排查，不强制中断任务。')), 60000); });
  const [code] = await Promise.race([exited, timeout]);
  assert.equal(code, 0);
  const result = JSON.parse(await readFile(path.join(root, 'verification.json'), 'utf8'));
  assert.equal(result.runId, runId);
  assert.equal(result.window.hasPrompt, true);
  assert.equal(result.window.hasKey, false);
  assert.equal(result.offlineGeneration, true);
  assert.equal(result.busyCloseProtected, true);
  assert.ok(result.nativeWindow > 0);
  if (result.window.cssWidth > 980) assert.equal(result.window.sideBySide, true);
  assert.equal(requests, 1);
  assert.throws(() => process.kill(result.servicePid, 0));
  const preferences = JSON.parse(await readFile(path.join(root, '.data/desktop-preferences.json'), 'utf8'));
  assert.equal(JSON.parse(preferences['studio-draft']).prompt, `Offline native WebView2 check ${runId}`);
  result.serviceExited = true;
  result.draftSaved = true;
  result.providerRequests = requests;
  result.singleInstance = true;
  await writeFile(path.join(root, 'verification.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  clearTimeout(timeoutHandle);
  provider.close();
  provider.closeIdleConnections();
}

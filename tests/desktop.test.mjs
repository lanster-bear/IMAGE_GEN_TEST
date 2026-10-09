import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createStudio } from '../server/index.mjs';
import { acquireServiceLock } from '../server/service-lock.mjs';

async function directory(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'studio-desktop-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('service lock prevents another process from sharing data and can be released', async t => {
  const root = await directory(t);
  const release = await acquireServiceLock(root);
  assert.equal(JSON.parse(await readFile(path.join(root, 'service.lock'), 'utf8')).pid, process.pid);
  await assert.rejects(acquireServiceLock(root), /已有工作台服务/);
  await release();
  await release();
  const secondRelease = await acquireServiceLock(root);
  await secondRelease();
});

test('service lock recovers only a dead owner and leaves malformed locks untouched', async t => {
  const root = await directory(t);
  await writeFile(path.join(root, 'service.lock'), JSON.stringify({ pid: 2147483647 }));
  const release = await acquireServiceLock(root);
  await release();
  await writeFile(path.join(root, 'service.lock'), '{}');
  await assert.rejects(acquireServiceLock(root), /服务锁无效/);
  assert.equal(await readFile(path.join(root, 'service.lock'), 'utf8'), '{}');
});

async function studio(t, desktop, providerOptions = {}) {
  const root = await directory(t);
  const config = { root, dataDir: path.join(root, '.data'), outputDir: path.join(root, 'outputs'), apiKey: 'desktop-test-key', desktop, templates: [], sizes: [{ value: '1024x1024' }], defaultSize: '1024x1024', maxImages: 1, maxPromptLength: 100, maxQueue: 2 };
  const provider = { models: async () => [{ id: 'image-test', name: 'Image test' }], ...providerOptions };
  const result = await createStudio(config, provider);
  result.server.listen(0, '127.0.0.1');
  await once(result.server, 'listening');
  t.after(async () => {
    if (result.server.listening) await new Promise(resolve => { result.server.close(resolve); result.server.closeIdleConnections(); });
  });
  const base = `http://127.0.0.1:${result.server.address().port}`;
  const stop = (headers = {}) => fetch(`${base}/api/desktop/stop`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Studio-Token': result.token, ...headers }, body: '{}' });
  return { ...result, base, stop };
}

test('desktop stop requires the local token and denies cross-site origins', async t => {
  const { stop, server } = await studio(t, true);
  assert.equal((await stop({ 'X-Studio-Token': 'wrong' })).status, 403);
  assert.equal((await stop({ Origin: 'https://untrusted.invalid' })).status, 403);
  assert.equal(server.listening, true);
});

test('desktop stop protects active tasks and their final persistence, then closes cleanly', async t => {
  const { stop, store, server, base } = await studio(t, true);
  store.jobs.set('fixture', { id: 'fixture', status: 'running', createdAt: new Date().toISOString(), images: [] });
  assert.equal((await stop()).status, 409);
  store.jobs.get('fixture').status = 'completed';
  store.draining = true;
  assert.equal((await stop()).status, 409);
  const health = await (await fetch(`${base}/api/health`)).json();
  assert.equal(health.busy, true);
  store.draining = false;
  const closed = once(server, 'close');
  assert.equal((await stop()).status, 200);
  await closed;
  assert.equal(server.listening, false);
});

test('browser service does not expose the desktop shutdown route', async t => {
  const { stop, server } = await studio(t, false);
  assert.equal((await stop()).status, 405);
  assert.equal(server.listening, true);
});

test('shutdown rejects a submission that was waiting for model discovery', async t => {
  let resolveModels;
  const discovery = new Promise(resolve => { resolveModels = resolve; });
  const { server, token, base, stop, store } = await studio(t, true, { models: () => discovery });
  const arrived = once(server, 'request');
  const submission = fetch(`${base}/api/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Studio-Token': token }, body: '{}' });
  await arrived;
  const closed = once(server, 'close');
  assert.equal((await stop()).status, 200);
  resolveModels([{ id: 'image-test', name: 'Image test' }]);
  assert.equal((await submission).status, 503);
  await closed;
  assert.deepEqual(store.list(), []);
});

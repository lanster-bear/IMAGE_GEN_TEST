import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { parseCredentials, normalizeBase, sanitize, loadConfig } from '../server/config.mjs';
import { ImageProvider, extractImageItems, imageType, isPublicAddress } from '../server/provider.mjs';
import { validateInput, JobStore } from '../server/jobs.mjs';
import { createStudio } from '../server/index.mjs';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jAZcAAAAASUVORK5CYII=', 'base64');
const MODELS = [{ id: 'gpt-image-test', name: 'Test image model' }];
const INPUT = { prompt: 'A green glass sphere', model: MODELS[0].id, size: '1024x1024', quality: 'auto', n: 1 };

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'image-studio-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const config = { root, apiKey: 'sk-fixture-secret', baseUrl: 'https://provider.invalid/v1', dataDir: path.join(root, '.data'), outputDir: path.join(root, 'outputs'), timeoutMs: 1000, maxPromptLength: 12000, maxImages: 1, maxQueue: 12, defaultSize: '1024x1024', sizes: [{ value: '1024x1024', label: 'square', ratio: '1:1' }], templates: [] };
  await mkdir(path.join(root, 'public'));
  await writeFile(path.join(root, 'public/index.html'), '<!doctype html><title>Studio fixture</title>');
  return config;
}

async function waitFor(store, id) {
  for (let i = 0; i < 200; i++) {
    const job = store.jobs.get(id);
    if (job && !['queued', 'running'].includes(job.status)) return job;
    await delay(5);
  }
  throw new Error('Test job did not finish');
}

test('credentials: BOM, current two-line file and named key', () => {
  assert.deepEqual(parseCredentials('\uFEFFhttps://provider.invalid/\r\nsk-local-secret\r\n'), { baseUrl: 'https://provider.invalid/', apiKey: 'sk-local-secret' });
  assert.deepEqual(parseCredentials('BASE_URL=https://provider.invalid/v1\nAPI_KEY="opaque-fixture"'), { baseUrl: 'https://provider.invalid/v1', apiKey: 'opaque-fixture' });
});

test('base URL normalizes root and /v1 without duplicate versions', () => {
  assert.equal(normalizeBase('https://provider.invalid/'), 'https://provider.invalid/v1');
  assert.equal(normalizeBase('https://provider.invalid/v1/'), 'https://provider.invalid/v1');
  assert.equal(normalizeBase('https://provider.invalid/v1/images/generations'), 'https://provider.invalid/v1');
  assert.throws(() => normalizeBase('https://secret:password@provider.invalid'));
  assert.throws(() => normalizeBase('https://provider.invalid?key=example'));
});

test('configuration: environment overrides local file; empty environment preserves original', async t => {
  const config = await fixture(t);
  await mkdir(path.join(config.root, 'config'));
  await writeFile(path.join(config.root, 'config/studio.json'), JSON.stringify({ defaultSize: '1024x1024' }));
  await writeFile(path.join(config.root, 'Image_key.txt'), 'https://file.invalid\nsk-local-fixture');
  const original = await loadConfig(config.root, {});
  assert.equal(original.baseUrl, 'https://file.invalid/v1');
  assert.equal(original.apiKey, 'sk-local-fixture');
  const overridden = await loadConfig(config.root, { IMAGE2_BASE_URL: 'https://env.invalid/v1', IMAGE2_API_KEY: 'env-fixture', PORT: '4321' });
  assert.equal(overridden.baseUrl, 'https://env.invalid/v1'); assert.equal(overridden.apiKey, 'env-fixture'); assert.equal(overridden.port, 4321);
  await assert.rejects(loadConfig(config.root, { PORT: 'bad' }));
});

test('sanitizer removes real keys, bearer tokens and signed URLs', () => {
  const result = sanitize('opaque-secret sk-another-key Bearer hidden https://files.invalid/a?signature=secret', 'opaque-secret');
  for (const forbidden of ['opaque-secret', 'sk-another-key', 'hidden', 'signature=secret']) assert.ok(!result.includes(forbidden));
});

test('input validation trims prompts and rejects missing or excessive prompt', () => {
  const config = { maxPromptLength: 20, maxImages: 1, sizes: [{ value: '1024x1024' }], defaultSize: '1024x1024' };
  assert.equal(validateInput({ ...INPUT, prompt: '  idea  ' }, config, MODELS).prompt, 'idea');
  assert.throws(() => validateInput({ ...INPUT, prompt: ' ' }, config, MODELS));
  assert.throws(() => validateInput({ ...INPUT, prompt: 'x'.repeat(21) }, config, MODELS));
  assert.throws(() => validateInput(null, config, MODELS));
});

test('input validation rejects unsupported models, sizes, count, quality and unsafe IDs', () => {
  const config = { maxPromptLength: 12000, maxImages: 1, sizes: [{ value: '1024x1024' }], defaultSize: '1024x1024' };
  for (const patch of [{ model: 'unknown' }, { size: '4096x4096' }, { n: 0 }, { n: 2 }, { n: '1' }, { quality: 'ultra' }, { requestId: '../../secret' }, { requestId: [randomUUID()] }]) {
    assert.throws(() => validateInput({ ...INPUT, ...patch }, config, MODELS));
  }
});

test('image response extraction supports b64, URL and nested outputs', () => {
  assert.deepEqual(extractImageItems({ data: [{ b64_json: 'abc' }] }), [{ encoded: 'abc' }]);
  assert.deepEqual(extractImageItems({ data: [{ url: 'https://files.invalid/test.png' }] }), [{ url: 'https://files.invalid/test.png' }]);
  assert.deepEqual(extractImageItems({ output: [{ result: { images: [{ base64: 'abc' }] } }] }), [{ encoded: 'abc' }]);
});

test('image type validates real signatures rather than trusting a declared format', () => {
  assert.equal(imageType(PNG), 'png');
  assert.equal(imageType(Buffer.from([255, 216, 255, 0])), 'jpg');
  assert.equal(imageType(Buffer.from('RIFF0000WEBP0000')), 'webp');
  assert.throws(() => imageType(Buffer.from('<html>not an image</html>')));
});

test('image downloader blocks loopback and private network addresses', () => {
  for (const address of ['127.0.0.1', '10.1.1.1', '192.168.0.1', '172.16.0.1', '169.254.169.254', '100.64.0.1', '::1', 'fc00::1', '::ffff:127.0.0.1']) assert.equal(isPublicAddress(address), false);
  assert.equal(isPublicAddress('8.8.8.8'), true);
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true);
});

test('provider uses server-side auth, omits default quality and preserves image bytes', async t => {
  const config = await fixture(t); let call;
  const provider = new ImageProvider(config, async (url, options) => { call = { url, options }; return Response.json({ data: [{ b64_json: PNG.toString('base64') }] }); });
  const images = await provider.generate(INPUT);
  assert.equal(call.url, 'https://provider.invalid/v1/images/generations');
  assert.equal(call.options.headers.Authorization, 'Bearer sk-fixture-secret');
  assert.deepEqual(JSON.parse(call.options.body), { model: INPUT.model, prompt: INPUT.prompt, size: INPUT.size, n: 1 });
  assert.deepEqual(images[0].bytes, PNG);
});

test('provider passes explicit quality without silently replacing parameters', async t => {
  const config = await fixture(t); let payload;
  const provider = new ImageProvider(config, async (_url, options) => { payload = JSON.parse(options.body); return Response.json({ image: PNG.toString('base64') }); });
  await provider.generate({ ...INPUT, quality: 'high' });
  assert.equal(payload.quality, 'high');
});

test('model discovery filters chat models and deduplicates image models', async t => {
  const config = await fixture(t);
  const provider = new ImageProvider(config, async () => Response.json({ data: [{ id: 'gpt-chat-test' }, { id: 'gpt-image-test' }, { id: 'gpt-image-test' }, { id: 'custom', type: 'image', display_name: 'Custom' }] }));
  assert.deepEqual(await provider.models(), [{ id: 'gpt-image-test', name: 'gpt-image-test' }, { id: 'custom', name: 'Custom' }]);
});

test('provider authentication error is redacted and never retried', async t => {
  const config = await fixture(t); let calls = 0;
  const provider = new ImageProvider(config, async () => { calls++; return Response.json({ error: { message: `Invalid key ${config.apiKey}` } }, { status: 401 }); });
  await assert.rejects(provider.generate(INPUT), error => error.status === 401 && !error.message.includes(config.apiKey));
  assert.equal(calls, 1);
});

test('provider timeout warns of uncertain billing and never retries', async t => {
  const config = await fixture(t); let calls = 0;
  const provider = new ImageProvider(config, async () => { calls++; throw new DOMException('timed out', 'TimeoutError'); });
  await assert.rejects(provider.generate(INPUT), error => error.status === 504 && error.message.includes('计费'));
  assert.equal(calls, 1);
});

test('provider rejects malformed JSON, missing images and invalid image payload', async t => {
  const config = await fixture(t);
  for (const response of [new Response('<html>bad</html>'), Response.json({ data: [] }), Response.json({ data: [{ b64_json: Buffer.from('not image').toString('base64') }] })]) {
    const provider = new ImageProvider(config, async () => response);
    await assert.rejects(provider.generate(INPUT));
  }
});

test('provider refuses image URL pointing at the local machine', async t => {
  const config = await fixture(t); let calls = 0;
  const provider = new ImageProvider(config, async () => { calls++; return Response.json({ data: [{ url: 'https://127.0.0.1/secret' }] }); });
  await assert.rejects(provider.generate(INPUT), /私有网络/);
  assert.equal(calls, 1);
});

test('jobs persist metadata and exact image bytes, and reload completed history', async t => {
  const config = await fixture(t);
  const provider = { generate: async () => [{ bytes: PNG, extension: 'png' }] };
  const store = new JobStore(config, provider); await store.init();
  const created = await store.create(INPUT, MODELS); const job = await waitFor(store, created.id);
  assert.equal(job.status, 'completed'); assert.equal(job.images.length, 1);
  assert.deepEqual(await readFile(path.join(config.outputDir, job.images[0].url.slice('/outputs/'.length))), PNG);
  const metadata = await readFile(path.join(store.jobDir, `${job.id}.json`), 'utf8');
  assert.ok(!metadata.includes(config.apiKey));
  const reloaded = new JobStore(config, provider); await reloaded.init();
  assert.equal(reloaded.jobs.get(job.id).status, 'completed');
});

test('job request IDs deduplicate concurrent submissions and reject parameter conflicts', async t => {
  const config = await fixture(t); let calls = 0;
  const provider = { generate: async () => { calls++; await delay(15); return [{ bytes: PNG, extension: 'png' }]; } };
  const store = new JobStore(config, provider); await store.init(); const requestId = randomUUID();
  const [a, b] = await Promise.all([store.create({ ...INPUT, requestId: requestId.toUpperCase() }, MODELS), store.create({ ...INPUT, requestId }, MODELS)]);
  assert.equal(a.id, b.id); await waitFor(store, a.id); assert.equal(calls, 1);
  await assert.rejects(store.create({ ...INPUT, requestId, prompt: 'Different idea' }, MODELS), error => error.status === 409);
});

test('job queue serializes upstream calls', async t => {
  const config = await fixture(t); let concurrent = 0, maximum = 0;
  const provider = { generate: async () => { concurrent++; maximum = Math.max(maximum, concurrent); await delay(15); concurrent--; return [{ bytes: PNG, extension: 'png' }]; } };
  const store = new JobStore(config, provider); await store.init();
  const jobs = await Promise.all([store.create(INPUT, MODELS), store.create(INPUT, MODELS), store.create(INPUT, MODELS)]);
  await Promise.all(jobs.map(job => waitFor(store, job.id))); assert.equal(maximum, 1);
});

test('job failure is recorded without credentials and without retry', async t => {
  const config = await fixture(t); let calls = 0;
  const provider = { generate: async () => { calls++; throw new Error(`secret ${config.apiKey}`); } };
  const store = new JobStore(config, provider); await store.init();
  const created = await store.create(INPUT, MODELS); const job = await waitFor(store, created.id);
  assert.equal(job.status, 'failed'); assert.ok(!job.error.includes(config.apiKey)); assert.equal(calls, 1);
});

test('restart marks unfinished jobs interrupted and does not resubmit them', async t => {
  const config = await fixture(t); let calls = 0;
  await mkdir(path.join(config.dataDir, 'jobs'), { recursive: true });
  for (const status of ['queued', 'running']) {
    const id = randomUUID();
    await writeFile(path.join(config.dataDir, 'jobs', `${id}.json`), JSON.stringify({ id, ...INPUT, status, createdAt: new Date().toISOString(), images: [] }));
  }
  const store = new JobStore(config, { generate: async () => { calls++; } }); await store.init();
  assert.ok(store.list().every(job => job.status === 'interrupted'));
  assert.equal(calls, 0);
});

test('queue limit rejects additional work rather than starting more remote calls', async t => {
  const config = await fixture(t); config.maxQueue = 1;
  let release; const gate = new Promise(resolve => { release = resolve; });
  const store = new JobStore(config, { generate: async () => { await gate; return [{ bytes: PNG, extension: 'png' }]; } }); await store.init();
  const job = await store.create(INPUT, MODELS);
  await assert.rejects(store.create(INPUT, MODELS), error => error.status === 429);
  release(); await waitFor(store, job.id);
});

test('HTTP integration: session guard, actual model validation, persistence, image download and secret isolation', async t => {
  const config = await fixture(t); let generationCalls = 0;
  await writeFile(path.join(config.root, 'Image_key.txt'), config.apiKey);
  const provider = { models: async () => MODELS, generate: async () => { generationCalls++; return [{ bytes: PNG, extension: 'png' }]; } };
  const { server, store, ready } = await createStudio(config, provider); await ready;
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const settingsResponse = await fetch(`${base}/api/config`); const settings = await settingsResponse.json();
  assert.ok(!JSON.stringify(settings).includes(config.apiKey)); assert.equal(settings.models[0].id, MODELS[0].id);
  assert.ok(settingsResponse.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
  const headers = { 'Content-Type': 'application/json', 'X-Studio-Token': settings.token };
  assert.equal((await fetch(`${base}/api/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(INPUT) })).status, 403);
  assert.equal((await fetch(`${base}/api/jobs`, { method: 'POST', headers: { ...headers, Origin: 'https://evil.invalid' }, body: JSON.stringify(INPUT) })).status, 403);
  assert.equal((await fetch(`${base}/api/jobs`, { method: 'POST', headers: { 'X-Studio-Token': settings.token }, body: '{}' })).status, 415);
  assert.equal((await fetch(`${base}/api/jobs`, { method: 'POST', headers, body: '{bad' })).status, 400);
  assert.equal((await fetch(`${base}/api/jobs`, { method: 'POST', headers, body: JSON.stringify({ ...INPUT, model: 'not-available' }) })).status, 400);
  const requestId = randomUUID();
  const response = await fetch(`${base}/api/jobs`, { method: 'POST', headers, body: JSON.stringify({ ...INPUT, requestId }) });
  assert.equal(response.status, 202);
  const created = await response.json(); const job = await waitFor(store, created.id);
  const duplicate = await fetch(`${base}/api/jobs`, { method: 'POST', headers, body: JSON.stringify({ ...INPUT, requestId }) });
  assert.equal((await duplicate.json()).id, job.id); assert.equal(generationCalls, 1);
  const image = await fetch(`${base}${job.images[0].url}?download=1`);
  assert.equal(image.headers.get('content-type'), 'image/png'); assert.ok(image.headers.get('content-disposition').startsWith('attachment;'));
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), PNG);
  const jobs = await (await fetch(`${base}/api/jobs`)).json(); assert.equal(jobs.jobs.length, 1); assert.ok(!JSON.stringify(jobs).includes(config.apiKey));
  for (const pathname of ['/Image_key.txt', '/.env', '/.data/jobs/x.json', '/server/config.mjs', '/outputs/../Image_key.txt']) assert.equal((await fetch(`${base}${pathname}`)).status, 404);
  assert.equal((await fetch(`${base}/api/jobs/${randomUUID()}`)).status, 404);
  const hostStatus = await new Promise((resolve, reject) => { const req = http.get(`${base}/api/health`, { headers: { Host: 'evil.invalid' } }, res => { res.resume(); resolve(res.statusCode); }); req.on('error', reject); });
  assert.equal(hostStatus, 403);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Window } from 'happy-dom';
import { ROOT } from '../server/config.mjs';

const html = await readFile(path.join(ROOT, 'public/index.html'), 'utf8');
const app = await readFile(path.join(ROOT, 'public/app.js'), 'utf8');
const CONFIG = { token: 'local-test-session', configured: true, endpoint: 'https://provider.invalid/v1', models: [{ id: 'gpt-image-test', name: 'Test image' }], defaultModel: 'gpt-image-test', modelError: null, defaultSize: '1024x1024', sizes: [{ value: '1024x1024', label: '方形', ratio: '1:1' }, { value: '1536x1024', label: '横向', ratio: '3:2' }], maxImages: 1, maxPromptLength: 12000, outputDirectory: 'fixture/outputs', timeoutSeconds: 900, templates: [{ id: 'test', name: '产品摄影', description: 'Test template', prompt: 'A green sphere with natural light' }] };

async function frontend(t, options = {}) {
  const window = new Window({ url: 'http://127.0.0.1:4317', settings: { disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  t.after(async () => { await window.happyDOM.abort(); window.close(); });
  const jobs = options.jobs || [];
  const calls = [];
  let failConfig = Boolean(options.failConfig);
  window.fetch = async (url, request = {}) => {
    calls.push({ url, request });
    if (url === '/api/config') {
      if (failConfig) throw new Error('fixture disconnected');
      return Response.json(CONFIG);
    }
    if (url === '/api/jobs' && request.method === 'POST') {
      if (options.failSubmit) throw new Error('fixture transport error');
      if (options.rejectSubmit) return Response.json({ error: 'Invalid parameter' }, { status: 400 });
      const input = JSON.parse(request.body);
      const job = { ...input, id: input.requestId, status: 'completed', createdAt: new Date().toISOString(), elapsedMs: 1000, images: [{ url: `/outputs/2026-10-09/${input.requestId}-1.png`, filename: 'fixture.png', bytes: 123 }] };
      jobs.unshift(job); return Response.json(job, { status: 202 });
    }
    if (url === '/api/jobs') return Response.json({ jobs });
    if (url === '/api/models/refresh') return Response.json({ models: CONFIG.models, modelError: null });
    throw new Error(`Unexpected local test request: ${url}`);
  };
  // Polling is tested at the HTTP/store level. Disable background timers here.
  window.setTimeout = () => 1; window.clearTimeout = () => {};
  window.document.write(html);
  await window.eval(`(async () => { ${app}\n })()`);
  const $ = id => window.document.getElementById(id);
  async function flush() { await delay(20); }
  function submit() { $('generate-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); }
  return { window, $, jobs, calls, flush, submit, reconnect: () => { failConfig = false; } };
}

test('frontend initializes actual models, sizes, templates and connected state', async t => {
  const { window, $ } = await frontend(t);
  assert.equal($('model').value, 'gpt-image-test');
  assert.equal(window.document.querySelectorAll('[name=size]').length, 2);
  assert.equal($('template-shortcuts').children.length, 1);
  assert.equal($('generate-button').disabled, false);
  assert.match($('connection-status').textContent, /1 个模型可用/);
  assert.equal($('global-error').hidden, true);
});

test('frontend template, character count, draft, navigation and theme all work', async t => {
  const { window, $ } = await frontend(t);
  $('template-shortcuts').querySelector('button').click();
  assert.equal($('prompt').value, CONFIG.templates[0].prompt);
  assert.equal($('prompt-count').textContent, `${CONFIG.templates[0].prompt.length} / 12000`);
  assert.equal(JSON.parse(window.localStorage.getItem('studio-draft')).prompt, CONFIG.templates[0].prompt);
  window.document.querySelector('nav [data-view=templates]').click();
  assert.equal($('view-templates').hidden, false); assert.equal($('view-studio').hidden, true);
  $('template-list').querySelector('button').click(); assert.equal($('view-studio').hidden, false);
  const theme = window.document.documentElement.dataset.theme;
  $('theme-toggle').click(); assert.notEqual(window.document.documentElement.dataset.theme, theme);
  $('clear-prompt').click(); assert.equal($('prompt').value, '');
});

test('frontend submission uses local token, saves preview/download and deduplicates double-click', async t => {
  const { $, window, calls, submit, flush } = await frontend(t);
  $('prompt').value = 'A glass sphere';
  submit(); submit(); await flush();
  const submissions = calls.filter(call => call.url === '/api/jobs' && call.request.method === 'POST');
  assert.equal(submissions.length, 1);
  assert.equal(submissions[0].request.headers['X-Studio-Token'], CONFIG.token);
  assert.equal(JSON.parse(submissions[0].request.body).quality, 'auto');
  assert.equal($('preview').querySelector('img').alt, 'A glass sphere');
  assert.ok($('download-current').href.endsWith('?download=1'));
  assert.equal($('preview-actions').hidden, false);
  assert.equal(window.localStorage.getItem('studio-pending'), null);
  assert.equal($('generate-button').disabled, false);
  assert.equal($('library-count').textContent, '1');
});

test('frontend renders untrusted prompt text safely, supports history reuse and search', async t => {
  const job = { id: '00000000-0000-4000-8000-000000000001', prompt: '<img src=x onerror=alert(1)>', model: 'gpt-image-test', size: '1024x1024', n: 1, quality: 'auto', status: 'completed', createdAt: '2026-10-09T00:00:00.000Z', elapsedMs: 1000, images: [{ url: '/outputs/2026-10-09/00000000-0000-4000-8000-000000000001-1.png', filename: 'test.png' }] };
  const { $, window } = await frontend(t, { jobs: [job] });
  assert.equal(window.document.querySelectorAll('img[onerror]').length, 0);
  $('reuse-current').click(); assert.equal($('prompt').value, job.prompt);
  $('library-search').value = 'nonmatching'; $('library-search').dispatchEvent(new window.Event('input'));
  assert.equal($('library-list').querySelectorAll('article').length, 0);
  assert.match($('library-list').textContent, /没有匹配/);
});

test('frontend transport failure retains pending ID and never automatically resubmits', async t => {
  const { $, window, submit, flush, calls } = await frontend(t, { failSubmit: true });
  $('prompt').value = 'A sphere'; submit(); await flush(); submit(); await flush();
  assert.equal(calls.filter(call => call.request.method === 'POST' && call.url === '/api/jobs').length, 1);
  assert.ok(window.localStorage.getItem('studio-pending'));
  assert.equal($('generate-button').disabled, true); assert.match($('form-error').textContent, /尚未确认/);
  $('refresh-models').click(); await flush();
  assert.equal(window.localStorage.getItem('studio-pending'), null); assert.equal($('generate-button').disabled, false);
});

test('frontend HTTP rejection clears pending state and displays actionable error', async t => {
  const { $, window, submit, flush } = await frontend(t, { rejectSubmit: true });
  $('prompt').value = 'A sphere'; submit(); await flush();
  assert.equal(window.localStorage.getItem('studio-pending'), null);
  assert.equal($('generate-button').disabled, false); assert.equal($('form-error').textContent, 'Invalid parameter');
});

test('frontend reconnects after initialization failure and builds missing controls', async t => {
  const { $, window, reconnect, flush } = await frontend(t, { failConfig: true });
  assert.equal($('generate-button').disabled, true); assert.equal($('global-error').hidden, false);
  reconnect(); $('refresh-models').click(); await flush();
  assert.equal($('generate-button').disabled, false);
  assert.equal(window.document.querySelectorAll('[name=size]').length, 2);
  assert.equal($('template-shortcuts').children.length, 1);
});

test('frontend shows a plain working state and moves between tasks from the keyboard', async t => {
  const running = { id: '00000000-0000-4000-8000-000000000010', prompt: 'running prompt', model: 'gpt-image-test', size: '1024x1024', n: 1, quality: 'auto', status: 'running', createdAt: new Date().toISOString(), images: [] };
  const done = { id: '00000000-0000-4000-8000-000000000011', prompt: 'done prompt', model: 'gpt-image-test', size: '1024x1024', n: 1, quality: 'auto', status: 'completed', createdAt: '2026-10-09T00:00:00.000Z', elapsedMs: 1000, images: [{ url: '/outputs/2026-10-09/00000000-0000-4000-8000-000000000011-1.png', filename: 'done.png' }] };
  const { $, window } = await frontend(t, { jobs: [running, done] });
  assert.match($('preview').textContent, /正在生成/);
  assert.equal($('preview').textContent.includes('想法正在成形'), false);
  assert.equal($('preview-actions').hidden, true);
  $('recent-list').focus();
  window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  assert.equal($('preview').querySelector('img').alt, 'done prompt');
  window.document.body.focus();
  window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: '/', bubbles: true }));
  assert.equal(window.document.activeElement, $('prompt'));
});

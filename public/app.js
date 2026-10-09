const $ = id => document.getElementById(id);
const labels = { queued: '等待生成', running: '正在生成', completed: '已完成', failed: '生成失败', interrupted: '任务中断' };
const views = { studio: '工作台', library: '记录', templates: '模板', settings: '连接' };
const state = { config: null, jobs: [], selected: null, submitting: false, timer: null, previewKey: '' };
let theme = localStorage.getItem('studio-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

function applyTheme() {
  document.documentElement.dataset.theme = theme;
  $('theme-toggle').textContent = theme === 'dark' ? '切换为浅色' : '切换为深色';
}
applyTheme();
$('theme-toggle').addEventListener('click', () => { theme = theme === 'light' ? 'dark' : 'light'; localStorage.setItem('studio-theme', theme); applyTheme(); });

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', 'X-Studio-Token': state.config?.token || '', ...options.headers } });
  const data = await response.json();
  if (!response.ok) { const error = new Error(data.error || '本地服务请求失败。'); error.status = response.status; throw error; }
  return data;
}

function showView(view) {
  for (const key of Object.keys(views)) $(`view-${key}`).hidden = key !== view;
  for (const button of document.querySelectorAll('nav [data-view]')) {
    const active = button.dataset.view === view;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  }
  $('view-label').textContent = views[view];
  if (view === 'library') renderLibrary();
}
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));

function saveDraft() {
  localStorage.setItem('studio-draft', JSON.stringify({ prompt: $('prompt').value, model: $('model').value, size: document.querySelector('[name=size]:checked')?.value, quality: $('quality').value }));
}
function updatePrompt() { $('prompt-count').textContent = `${$('prompt').value.length} / ${state.config?.maxPromptLength || 12000}`; saveDraft(); }
$('prompt').addEventListener('input', updatePrompt);
$('clear-prompt').addEventListener('click', () => { $('prompt').value = ''; updatePrompt(); $('prompt').focus(); });
for (const id of ['model', 'quality']) $(id).addEventListener('change', saveDraft);

function usePrompt(prompt) { $('prompt').value = prompt; updatePrompt(); showView('studio'); $('prompt').focus(); }
function reuse(job) {
  $('prompt').value = job.prompt;
  if ([...$('model').options].some(option => option.value === job.model)) $('model').value = job.model;
  const size = [...document.querySelectorAll('[name=size]')].find(input => input.value === job.size);
  if (size) size.checked = true;
  $('quality').value = job.quality || 'auto';
  updatePrompt(); showView('studio'); $('prompt').focus();
}

function renderConfig() {
  const config = state.config;
  const existing = $('model').value;
  $('model').replaceChildren(...config.models.map(model => { const option = element('option', '', model.name); option.value = model.id; return option; }));
  if (!config.models.length) { const option = element('option', '', '暂无可用模型'); option.value = ''; $('model').append(option); }
  $('model').value = config.models.some(model => model.id === existing) ? existing : config.defaultModel || config.models[0]?.id || '';
  $('connection-status').textContent = config.modelError ? '连接需要检查' : `${config.models.length} 个模型可用`;
  $('connection-status').classList.toggle('ready', Boolean(config.models.length && !config.modelError));
  $('global-error').hidden = !config.modelError;
  $('global-error').textContent = config.modelError || '';
  const fields = [['API 端点', config.endpoint || '未配置'], ['密钥状态', config.configured ? '已由服务端读取（不会传给页面）' : '未配置'], ['可用模型', config.models.map(model => model.id).join('、') || '无'], ['图片保存位置', config.outputDirectory], ['请求超时', `${config.timeoutSeconds} 秒`], ['模型更新时间', config.modelUpdatedAt ? new Date(config.modelUpdatedAt).toLocaleString('zh-CN') : '尚未成功读取']];
  $('settings-info').replaceChildren(...fields.map(([label, value]) => { const row = element('div'); row.append(element('dt', '', label), element('dd', '', value)); return row; }));
  updateButton();
}

function updateButton() {
  const pending = Boolean(localStorage.getItem('studio-pending'));
  $('generate-button').disabled = state.submitting || pending || !state.config?.models.length;
  $('generate-label').textContent = state.submitting ? '正在提交…' : pending ? '等待当前任务完成' : '生成图像';
}

function setupInputs() {
  let draft = {};
  try { draft = JSON.parse(localStorage.getItem('studio-draft') || '{}'); } catch { /* Invalid browser draft is safe to ignore. */ }
  $('size-options').replaceChildren(...state.config.sizes.map(size => {
    const label = element('label', 'size-option');
    const input = element('input'); input.type = 'radio'; input.name = 'size'; input.value = size.value; input.checked = size.value === (draft.size || state.config.defaultSize);
    input.addEventListener('change', saveDraft);
    const span = element('span'); span.append(element('b', '', size.ratio), document.createTextNode(size.label));
    label.append(input, span); return label;
  }));
  if (!document.querySelector('[name=size]:checked')) document.querySelector('[name=size]').checked = true;
  $('count').replaceChildren(...Array.from({ length: state.config.maxImages }, (_, index) => { const option = element('option', '', `${index + 1} 张`); option.value = index + 1; return option; }));
  $('template-shortcuts').replaceChildren(...state.config.templates.map(template => { const button = element('button', 'template-chip', template.name); button.type = 'button'; button.addEventListener('click', () => usePrompt(template.prompt)); return button; }));
  $('template-list').replaceChildren(...state.config.templates.map(template => {
    const article = element('article', 'template-card');
    const button = element('button', 'secondary-button', '填入工作台'); button.addEventListener('click', () => usePrompt(template.prompt));
    article.append(element('h2', '', template.name), element('small', '', template.description), element('p', '', template.prompt), button); return article;
  }));
  $('prompt').maxLength = state.config.maxPromptLength;
  $('prompt').value = typeof draft.prompt === 'string' ? draft.prompt.slice(0, state.config.maxPromptLength) : '';
  if (state.config.models.some(model => model.id === draft.model)) $('model').value = draft.model;
  if (['auto', 'low', 'medium', 'high'].includes(draft.quality)) $('quality').value = draft.quality;
  updatePrompt();
}

function openImage(url) { $('dialog-image').src = url; $('image-dialog').showModal(); }
$('close-dialog').addEventListener('click', () => $('image-dialog').close());
$('image-dialog').addEventListener('click', event => { if (event.target === $('image-dialog')) $('image-dialog').close(); });

function elapsedSeconds(job) {
  const started = Date.parse(job.createdAt);
  if (!Number.isFinite(started)) return 0;
  return Math.max(0, Math.round((Date.now() - started) / 1000));
}

function markSelected() {
  for (const card of document.querySelectorAll('.job-card')) card.classList.toggle('is-selected', card.dataset.id === state.selected);
}

async function copyPrompt(text) {
  try {
    await navigator.clipboard.writeText(text);
    $('copy-current').textContent = '已复制';
    setTimeout(() => { if ($('copy-current')) $('copy-current').textContent = '复制提示词'; }, 1200);
  } catch {
    $('form-error').hidden = false;
    $('form-error').textContent = '这一页不能写入剪贴板。提示词仍在左侧，可以手动复制。';
  }
}

function selectJob(job) { state.selected = job.id; state.previewKey = ''; renderPreview(); markSelected(); showView('studio'); }

function renderPreview() {
  const job = state.jobs.find(item => item.id === state.selected);
  if (!job) return;
  const elapsed = elapsedSeconds(job);
  const active = job.status === 'queued' || job.status === 'running';
  const key = `${job.id}:${job.status}:${job.images.length}:${job.error || ''}:${active ? elapsed : ''}`;
  if (key === state.previewKey) return;
  state.previewKey = key;
  $('preview-status').textContent = active ? `${labels[job.status]} · ${elapsed} 秒` : (labels[job.status] || job.status);
  $('preview-actions').hidden = job.status !== 'completed';
  if (job.status === 'completed') {
    const images = element('div', `preview-images${job.images.length > 1 ? ' multi' : ''}`);
    for (const item of job.images) {
      const image = element('img', 'preview-image'); image.src = item.url; image.alt = job.prompt; image.tabIndex = 0;
      image.addEventListener('click', () => openImage(item.url)); image.addEventListener('keydown', event => { if (event.key === 'Enter') openImage(item.url); });
      images.append(image);
    }
    $('preview').replaceChildren(images);
    $('image-info').replaceChildren(element('strong', '', job.model), document.createTextNode(`${job.size} · ${(job.elapsedMs / 1000).toFixed(1)} 秒 · ${job.images.length} 张`));
    $('download-current').href = `${job.images[0].url}?download=1`; $('download-current').download = job.images[0].filename;
    $('reuse-current').onclick = () => reuse(job);
    $('copy-current').onclick = () => copyPrompt(job.prompt);
  } else {
    const working = element('div', 'working-state');
    if (['queued', 'running'].includes(job.status)) {
      const bar = element('div', 'busy-bar'); bar.append(element('span'));
      working.append(bar, element('h3', 'working-title', labels[job.status]), element('p', 'working-detail', job.status === 'queued' ? '前一张结束后才会开始。不会并行发送。' : '请求已经发出。请等待完成后退出，不会自动重复提交。'));
    } else {
      working.append(element('h3', 'working-title', labels[job.status]), element('p', 'working-detail', job.error || '请检查服务商记录。'));
      const button = element('button', 'secondary-button', '回填参数（不自动重试）'); button.addEventListener('click', () => reuse(job)); working.append(button);
    }
    $('preview').replaceChildren(working);
  }
}

function jobCard(job) {
  const card = element('article', 'job-card'); card.dataset.id = job.id;
  const button = element('button', job.images.length ? 'job-image-button' : 'job-placeholder'); button.setAttribute('aria-label', `查看任务：${job.prompt.slice(0, 50)}`);
  if (job.images.length) { const img = element('img'); img.src = job.images[0].url; img.alt = job.prompt; img.loading = 'lazy'; button.append(img); }
  else button.textContent = labels[job.status] || job.status;
  button.addEventListener('click', () => selectJob(job));
  const copy = element('div', 'job-copy'); const prompt = element('p', 'job-prompt', job.prompt); prompt.title = job.prompt;
  const meta = element('div', 'job-meta'); meta.append(element('span', '', `${new Date(job.createdAt).toLocaleDateString('zh-CN')} · ${job.size}`), element('span', '', labels[job.status]));
  const controls = element('div', 'job-controls'); const reuseButton = element('button', 'text-button', '复用提示词'); reuseButton.addEventListener('click', () => reuse(job)); controls.append(reuseButton);
  if (job.images.length) { const link = element('a', '', '下载原图'); link.href = `${job.images[0].url}?download=1`; link.download = job.images[0].filename; controls.append(link); }
  copy.append(prompt, meta, controls); card.append(button, copy); return card;
}

function renderLibrary() {
  const term = $('library-search').value.trim().toLowerCase();
  const jobs = state.jobs.filter(job => `${job.prompt} ${job.model}`.toLowerCase().includes(term));
  $('library-list').replaceChildren(...(jobs.length ? jobs.map(jobCard) : [element('p', 'quiet-empty', term ? '没有匹配的作品。' : '还没有任务。')]));
}
$('library-search').addEventListener('input', renderLibrary);

async function loadJobs() {
  const data = await api('/api/jobs');
  const changed = JSON.stringify(data.jobs) !== JSON.stringify(state.jobs);
  state.jobs = data.jobs;
  const pendingId = localStorage.getItem('studio-pending');
  const pending = state.jobs.find(job => job.id === pendingId);
  if (pending && !['queued', 'running'].includes(pending.status)) localStorage.removeItem('studio-pending');
  if (!state.selected) state.selected = pending?.id || state.jobs[0]?.id || null;
  if (changed) {
    $('recent-list').replaceChildren(...(state.jobs.length ? state.jobs.slice(0, 12).map(jobCard) : [element('p', 'quiet-empty', '还没有任务。')]));
    $('library-count').textContent = state.jobs.filter(job => job.status === 'completed').length;
    renderLibrary();
  }
  renderPreview(); markSelected(); updateButton();
  clearTimeout(state.timer);
  state.timer = setTimeout(pollJobs, state.jobs.some(job => ['queued', 'running'].includes(job.status)) || pendingId ? 1500 : 10000);
}

async function pollJobs() {
  try { await loadJobs(); }
  catch {
    $('connection-status').textContent = '本地连接中断'; $('connection-status').classList.remove('ready');
    $('global-error').hidden = false; $('global-error').textContent = '暂时无法连接本地服务。已提交任务不会在页面里自动重试，请恢复服务后刷新任务状态。';
    state.timer = setTimeout(pollJobs, 5000);
  }
}

$('generate-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (state.submitting || localStorage.getItem('studio-pending') || !state.config?.models.length) return;
  if (!$('prompt').value.trim()) { $('prompt').focus(); return; }
  state.submitting = true; $('form-error').hidden = true; updateButton(); saveDraft();
  const id = crypto.randomUUID();
  localStorage.setItem('studio-pending', id);
  const input = { requestId: id, prompt: $('prompt').value.trim(), model: $('model').value, size: document.querySelector('[name=size]:checked').value, quality: $('quality').value, n: Number($('count').value) };
  try {
    const job = await api('/api/jobs', { method: 'POST', body: JSON.stringify(input) });
    state.selected = job.id; state.previewKey = ''; await loadJobs();
  } catch (error) {
    // HTTP rejection has a definite result. A transport failure remains pending.
    if (error.status) localStorage.removeItem('studio-pending');
    $('form-error').hidden = false;
    $('form-error').textContent = error.status ? error.message : '提交结果尚未确认。请刷新连接或作品库检查任务；不会自动重复提交。';
  } finally { state.submitting = false; updateButton(); }
});
$('prompt').addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); $('generate-form').requestSubmit(); } });
document.addEventListener('keydown', event => {
  if ($('image-dialog').open) return;
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  if (event.key === '/' && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); $('prompt').focus(); return; }
  if (typing || !['ArrowLeft', 'ArrowRight'].includes(event.key) || $('view-studio').hidden) return;
  const bench = document.activeElement === document.body || document.activeElement === $('recent-list') || $('recent-list').contains(document.activeElement) || $('preview').contains(document.activeElement);
  if (!bench) return;
  const index = state.jobs.findIndex(job => job.id === state.selected);
  if (index < 0) return;
  const next = event.key === 'ArrowRight' ? Math.min(state.jobs.length - 1, index + 1) : Math.max(0, index - 1);
  if (next === index) return;
  event.preventDefault(); selectJob(state.jobs[next]);
});

async function refreshConnection() {
  const buttons = [$('refresh-models'), $('settings-refresh')]; buttons.forEach(button => { button.disabled = true; });
  try {
    // Refresh the local session token too, so service restarts are recoverable.
    state.config = await api('/api/config');
    const refreshed = await api('/api/models/refresh', { method: 'POST', body: '{}' });
    Object.assign(state.config, refreshed); renderConfig();
    if (!document.querySelector('[name=size]')) setupInputs();
    await loadJobs();
    const pendingId = localStorage.getItem('studio-pending');
    if (pendingId && !state.jobs.some(job => job.id === pendingId)) {
      localStorage.removeItem('studio-pending'); updateButton();
      $('form-error').hidden = false; $('form-error').textContent = '已检查本地任务记录：上次请求未登记。可以重新提交。';
    }
  } catch (error) { $('global-error').hidden = false; $('global-error').textContent = error.message; }
  finally { buttons.forEach(button => { button.disabled = false; }); }
}
$('refresh-models').addEventListener('click', refreshConnection);
$('settings-refresh').addEventListener('click', refreshConnection);
$('refresh-jobs').addEventListener('click', () => pollJobs());

try {
  state.config = await api('/api/config'); renderConfig(); setupInputs(); await loadJobs();
} catch (error) {
  $('connection-status').textContent = '连接失败'; $('global-error').hidden = false;
  $('global-error').textContent = `无法初始化工作台：${error.message}。请检查本地服务是否运行。`;
}

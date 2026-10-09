// Artifact rendering, not browser UI automation. Uses an isolated temporary profile.
import { spawnSync } from 'node:child_process';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { ROOT, loadConfig } from '../server/config.mjs';

const candidates = [process.env.STUDIO_BROWSER_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean);
let browser;
for (const filename of candidates) { try { await access(filename); browser = filename; break; } catch { /* Try next installed browser. */ } }
if (!browser) throw new Error('No installed Chromium browser. Set STUDIO_BROWSER_PATH for rendering QA.');
try { process.loadEnvFile(path.join(ROOT, '.env')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const config = await loadConfig();
const base = `http://127.0.0.1:${config.port}`;
const health = await (await fetch(`${base}/api/health`)).json();
if (health.app !== 'image-gen-studio') throw new Error('Start Studio before rendering QA.');
const output = path.join(config.dataDir, 'qa'); await mkdir(output, { recursive: true });
// This installed Chromium enforces a 500 CSS-pixel minimum in CLI headless mode.
// Smaller screenshots crop a 500px layout; do not mislabel them as 390px QA.
for (const item of [{ name: 'desktop-light', size: '1440,1120' }, { name: 'desktop-dark', size: '1440,1120', dark: true }, { name: 'mobile-light', size: '500,1900' }]) {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'image-studio-render-'));
  try {
    const screenshot = path.join(output, `${item.name}.png`);
    const args = ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, '--force-device-scale-factor=1', `--window-size=${item.size}`, '--virtual-time-budget=8000', `--screenshot=${screenshot}`, '--dump-dom'];
    if (item.dark) args.push('--force-dark-mode');
    args.push(base);
    const result = spawnSync(browser, args, { encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024, windowsHide: true });
    if (result.error || result.status !== 0) throw new Error(`Rendering failed: ${item.name}: ${result.error?.message || result.status}`);
    if (config.apiKey && result.stdout.includes(config.apiKey)) throw new Error('Credential appeared in rendered document.');
    await access(screenshot);
    await writeFile(path.join(output, `${item.name}.html`), result.stdout, 'utf8');
    const theme = result.stdout.match(/<html[^>]*data-theme="([^"]+)"/)?.[1];
    console.log(JSON.stringify({ screenshot, theme, connected: result.stdout.includes('个模型可用'), hasPreview: result.stdout.includes('class="preview-image"') }));
  } finally { await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
}

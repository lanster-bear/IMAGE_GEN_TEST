import { readFile, readdir, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { ROOT, parseCredentials } from '../server/config.mjs';

const excluded = new Set(['.git', '.data', 'outputs', 'node_modules', 'dist', '%SystemDrive%']);
async function files(dir) {
  const result = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    if (excluded.has(item.name) || item.name === 'Image_key.txt' || item.name === '.env' || item.name === 'Image Studio.exe') continue;
    const filename = path.join(dir, item.name);
    if (item.isDirectory()) result.push(...await files(filename)); else result.push(filename);
  }
  return result;
}
let key;
try { key = parseCredentials(await readFile(path.join(ROOT, 'Image_key.txt'), 'utf8')).apiKey; } catch { /* Optional secret file. */ }
const sourceFiles = await files(ROOT);
const errors = [];
for (const filename of sourceFiles) {
  const content = await readFile(filename, 'utf8');
  if (key && content.includes(key)) errors.push(`发现真实密钥：${path.relative(ROOT, filename)}`);
  if (/\.(?:mjs|cjs|js)$/.test(filename)) {
    const result = spawnSync(process.execPath, ['--check', filename], { encoding: 'utf8' });
    if (result.status !== 0) errors.push(`语法检查失败：${path.relative(ROOT, filename)}`);
  }
  if (filename.endsWith('.md')) {
    for (const match of content.matchAll(/\]\(([^)]+)\)/g)) {
      const link = match[1];
      if (/^(https?:|#)/.test(link)) continue;
      try { await access(path.resolve(path.dirname(filename), link.split('#')[0])); }
      catch { errors.push(`文档链接不存在：${path.relative(ROOT, filename)} → ${link}`); }
    }
  }
}
const ignore = await readFile(path.join(ROOT, '.gitignore'), 'utf8');
for (const item of ['Image_key.txt', '.env', '.data/', 'outputs/']) if (!ignore.split(/\r?\n/).includes(item)) errors.push(`缺少忽略规则：${item}`);
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`检查通过：${sourceFiles.length} 个项目文件，JavaScript 语法、文档链接和真实密钥隔离正常。`);

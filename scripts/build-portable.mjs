import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { openSync, readSync, writeSync, closeSync } from 'node:fs';
import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { ROOT } from '../server/config.mjs';
import { APP_FILES } from './portable-plan.mjs';

const dist = path.join(ROOT, 'dist');
const exe = path.join(dist, 'ImageStudio.exe');

function hideConsole(filename) {
  const fd = openSync(filename, 'r+');
  try {
    const dos = Buffer.alloc(64);
    readSync(fd, dos, 0, 64, 0);
    if (dos.readUInt16LE(0) !== 0x5a4d) throw new Error('便携版不是 Windows 可执行文件。');
    const peOffset = dos.readUInt32LE(0x3c);
    const pe = Buffer.alloc(26);
    readSync(fd, pe, 0, 26, peOffset);
    if (pe.readUInt32LE(0) !== 0x4550) throw new Error('便携版缺少 PE 头。');
    if (pe.readUInt16LE(24) !== 0x20b) throw new Error('便携版不是 64 位 PE。');
    const subsystemAt = peOffset + 24 + 68;
    const subsystem = Buffer.alloc(2);
    readSync(fd, subsystem, 0, 2, subsystemAt);
    const value = subsystem.readUInt16LE(0);
    if (value !== 3 && value !== 2) throw new Error(`无法识别的子系统：${value}`);
    subsystem.writeUInt16LE(2, 0);
    writeSync(fd, subsystem, 0, 2, subsystemAt);
  } finally { closeSync(fd); }
}

async function smoke(filename) {
  const child = spawn(filename, [], {
    env: { ...process.env, PORT: '4391', STUDIO_OPEN: '0', IMAGE2_BASE_URL: 'http://127.0.0.1:9', IMAGE2_API_KEY: 'sk-smoke-not-real', IMAGE2_TIMEOUT: '10' },
    windowsHide: true, stdio: 'ignore',
  });
  try {
    let health;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await delay(500);
      try {
        const response = await fetch('http://127.0.0.1:4391/api/health', { signal: AbortSignal.timeout(1000) });
        health = await response.json();
        if (health.app === 'image-gen-studio') break;
      } catch { /* The portable process is still booting. */ }
      if (child.exitCode !== null) break;
    }
    if (health?.app !== 'image-gen-studio') throw new Error('便携版没有在隔离端口完成启动。');
    const page = await (await fetch('http://127.0.0.1:4391/')).text();
    if (!page.includes('当前画面') || !page.includes('id="prompt"')) throw new Error('便携版没有提供工作台页面。');
    if (page.includes('sk-smoke-not-real')) throw new Error('便携版页面出现了测试密钥。');
    return { pid: child.pid, status: health.status };
  } finally {
    if (child.exitCode === null) {
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true });
    }
  }
}

await mkdir(dist, { recursive: true });
const hash = createHash('sha256');
const assets = {};
for (const file of APP_FILES) {
  const filename = path.join(ROOT, file);
  assets[file] = filename;
  hash.update(file);
  hash.update(await readFile(filename));
}
const buildId = hash.digest('hex').slice(0, 16);
const buildIdFile = path.join(dist, 'build-id.txt');
await writeFile(buildIdFile, buildId);
assets['build-id'] = buildIdFile;
const configFile = path.join(dist, 'sea-config.json');
await writeFile(configFile, JSON.stringify({
  main: path.join(ROOT, 'scripts/sea-entry.cjs'),
  output: path.join(dist, 'sea-prep.blob'),
  disableExperimentalSEAWarning: true,
  useSnapshot: false,
  useCodeCache: false,
  assets,
}));
const prep = spawnSync(process.execPath, ['--experimental-sea-config', configFile], { cwd: ROOT, encoding: 'utf8' });
if (prep.status !== 0) throw new Error(prep.stderr || prep.stdout || 'SEA 准备失败。');
await copyFile(process.execPath, exe);
const inject = spawnSync(process.execPath, [path.join(ROOT, 'node_modules/postject/dist/cli.js'), exe, 'NODE_SEA_BLOB', path.join(dist, 'sea-prep.blob'), '--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2', '--overwrite'], { encoding: 'utf8' });
if (inject.status !== 0) throw new Error(inject.stderr || inject.stdout || '资源注入失败。');
hideConsole(exe);
await mkdir(path.join(dist, 'config'), { recursive: true });
await copyFile(path.join(ROOT, 'config/studio.json'), path.join(dist, 'config/studio.json'));
try { await copyFile(path.join(ROOT, 'Image_key.txt'), path.join(dist, 'Image_key.txt')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await writeFile(path.join(dist, '使用说明.txt'), `Image Studio 便携版\n\n把整个 dist 文件夹复制到其他 Windows 电脑即可使用，不需要安装 Node.js。\nImage_key.txt 必须放在 ImageStudio.exe 旁边，不会被打包进 exe。\n双击 ImageStudio.exe，或在项目里双击 Start Portable.cmd。\n图片在 exe 旁边的 outputs，任务记录在 .data。\n已有工作台占用 4317 时，再次打开只会唤起页面，不会再启动一份服务。\n`);
await rm(path.join(dist, 'sea-prep.blob'), { force: true });
await rm(configFile, { force: true });
await rm(buildIdFile, { force: true });
const result = await smoke(exe);
const file = await stat(exe);
console.log(JSON.stringify({ exe, bytes: file.size, buildId, smoke: result }));

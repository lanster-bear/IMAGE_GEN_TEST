import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from '../server/config.mjs';
import { APP_FILES } from './portable-plan.mjs';

export async function buildService(directory) {
  await mkdir(directory, { recursive: true });
  const assets = {};
  const hash = createHash('sha256');
  for (const file of [...APP_FILES, 'scripts/sea-entry.cjs']) {
    const filename = path.join(ROOT, file);
    hash.update(file).update(await readFile(filename));
    if (file !== 'scripts/sea-entry.cjs') assets[file] = filename;
  }
  const buildId = hash.digest('hex').slice(0, 16);
  const buildIdFile = path.join(directory, 'build-id.txt');
  await writeFile(buildIdFile, buildId);
  assets['build-id'] = buildIdFile;
  const prepFile = path.join(directory, 'sea-prep.blob');
  const configFile = path.join(directory, 'sea-config.json');
  await writeFile(configFile, JSON.stringify({ main: path.join(ROOT, 'scripts/sea-entry.cjs'), output: prepFile, disableExperimentalSEAWarning: true, useSnapshot: false, useCodeCache: false, assets }));
  const prep = spawnSync(process.execPath, ['--experimental-sea-config', configFile], { encoding: 'utf8', windowsHide: true });
  if (prep.status !== 0) throw new Error(prep.stderr || prep.stdout || 'SEA 准备失败。');
  const exe = path.join(directory, 'StudioService.exe');
  await copyFile(process.execPath, exe);
  const inject = spawnSync(process.execPath, [path.join(ROOT, 'node_modules/postject/dist/cli.js'), exe, 'NODE_SEA_BLOB', prepFile, '--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2', '--overwrite'], { encoding: 'utf8', windowsHide: true });
  if (inject.status !== 0) throw new Error(inject.stderr || inject.stdout || 'SEA 资源注入失败。');
  return { exe, buildId };
}

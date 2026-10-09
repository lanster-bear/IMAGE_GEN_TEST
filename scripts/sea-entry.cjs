'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { getAsset, getAssetKeys } = require('node:sea');

const root = process.env.STUDIO_ROOT ? path.resolve(process.env.STUDIO_ROOT) : path.dirname(process.execPath);
process.env.STUDIO_ROOT = root;
process.env.STUDIO_PORTABLE = '1';

const keys = getAssetKeys();
const buildId = keys.includes('build-id') ? Buffer.from(getAsset('build-id')).toString('utf8').trim() : 'dev';
const runtime = path.join(root, '.data', 'runtime', buildId);
process.env.STUDIO_PUBLIC = path.join(runtime, 'public');

function writeAsset(key, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, Buffer.from(getAsset(key)));
}

if (!fs.existsSync(path.join(runtime, '.ready'))) {
  for (const key of keys) {
    if (key.startsWith('server/') || key.startsWith('public/')) writeAsset(key, path.join(runtime, key));
  }
  fs.writeFileSync(path.join(runtime, '.ready'), buildId);
}

const configFile = path.join(root, 'config', 'studio.json');
if (!fs.existsSync(configFile) && keys.includes('config/studio.json')) writeAsset('config/studio.json', configFile);

import(pathToFileURL(path.join(runtime, 'server', 'index.mjs')).href)
  .then(mod => mod.startStudio())
  .catch(error => {
    const log = path.join(root, '.data', 'portable-error.log');
    fs.mkdirSync(path.dirname(log), { recursive: true });
    fs.appendFileSync(log, `${new Date().toISOString()} ${error && error.stack || error}\n`);
    process.exitCode = 1;
  });

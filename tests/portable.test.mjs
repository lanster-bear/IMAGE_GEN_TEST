import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { ROOT, studioRoot } from '../server/config.mjs';
import { APP_FILES } from '../scripts/portable-plan.mjs';

test('portable assets include the app and exclude credentials', async () => {
  assert.equal(APP_FILES.some(file => /image_key|\.env|outputs\//i.test(file)), false);
  assert.ok(APP_FILES.includes('server/index.mjs'));
  assert.ok(APP_FILES.includes('public/index.html'));
  for (const file of APP_FILES) await access(path.join(ROOT, file));
});

test('studio root follows STUDIO_ROOT and otherwise stays at the source tree', () => {
  const directed = path.join(ROOT, 'dist');
  assert.equal(studioRoot({ STUDIO_ROOT: directed }), path.resolve(directed));
  assert.equal(studioRoot({}), ROOT);
});

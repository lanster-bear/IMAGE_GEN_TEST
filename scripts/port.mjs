import path from 'node:path';
import { ROOT, loadConfig, sanitize } from '../server/config.mjs';

try {
  try { process.loadEnvFile(path.join(ROOT, '.env')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  console.log((await loadConfig()).port);
} catch (error) {
  console.error(sanitize(error.message));
  process.exitCode = 1;
}

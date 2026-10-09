import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function studioRoot(env = process.env, moduleUrl = import.meta.url) {
  if (env.STUDIO_ROOT) return path.resolve(env.STUDIO_ROOT);
  return path.resolve(path.dirname(fileURLToPath(moduleUrl)), '..');
}

export const ROOT = studioRoot();

export function parseCredentials(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const baseUrl = lines.map(line => line.match(/https?:\/\/[^\s"<>]+/)?.[0]).find(Boolean);
  const apiKey = lines.map(line => line.match(/sk-[A-Za-z0-9_-]+/)?.[0]).find(Boolean)
    || lines.find(line => /^(?:IMAGE2_API_KEY|API_KEY|key)\s*[:=]/i.test(line))?.replace(/^[^:=]+[:=]\s*/, '').replace(/^['"]|['"]$/g, '')
    || lines.find(line => !line.includes('http') && !line.startsWith('#') && !line.includes('='));
  return { baseUrl, apiKey };
}

export function normalizeBase(value) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('端点必须是没有密码、查询参数和片段的 HTTP(S) 地址。');
  }
  let pathname = url.pathname.replace(/\/+$/, '').replace(/\/images\/generations$/, '');
  if (!pathname.endsWith('/v1')) pathname += '/v1';
  url.pathname = pathname;
  return url.toString().replace(/\/$/, '');
}

export async function loadConfig(root = ROOT, env = process.env) {
  const settings = JSON.parse(await readFile(path.join(root, 'config/studio.json'), 'utf8'));
  let credentials = {};
  try { credentials = parseCredentials(await readFile(path.join(root, 'Image_key.txt'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const value = env.IMAGE2_BASE_URL || credentials.baseUrl;
  const port = Number(env.PORT || 4317);
  const timeout = Number(env.IMAGE2_TIMEOUT || 900);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT 必须在 1 到 65535 之间。');
  if (!Number.isFinite(timeout) || timeout < 10 || timeout > 1800) throw new Error('IMAGE2_TIMEOUT 必须在 10 到 1800 秒之间。');
  return {
    ...settings, root, port, timeoutMs: timeout * 1000,
    baseUrl: value ? normalizeBase(value) : null,
    apiKey: env.IMAGE2_API_KEY || credentials.apiKey || null,
    preferredModel: env.IMAGE2_MODEL || null,
    dataDir: path.join(root, '.data'), outputDir: path.join(root, 'outputs'),
    publicDir: env.STUDIO_PUBLIC ? path.resolve(env.STUDIO_PUBLIC) : path.join(root, 'public'),
  };
}

export function sanitize(value, key = '') {
  let text = String(value ?? '未知错误');
  if (key) text = text.replaceAll(key, '[REDACTED]');
  return text.replace(/sk-[A-Za-z0-9_-]+/g, '[REDACTED]')
    .replace(/Bearer\s+[^\s"<>]+/gi, 'Bearer [REDACTED]')
    .replace(/https?:\/\/[^\s<>"']+/g, '[远端地址]')
    .slice(0, 600);
}

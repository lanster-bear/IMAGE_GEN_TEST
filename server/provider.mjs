import dns from 'node:dns/promises';
import net from 'node:net';
import { sanitize } from './config.mjs';

export class ProviderError extends Error {
  constructor(message, status = 502) { super(message); this.status = status; }
}

async function readLimited(response, limit = 64 * 1024 * 1024) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > limit) throw new ProviderError('接口返回内容过大，已停止接收。');
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export function imageType(bytes) {
  if (bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (bytes.length > 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpg';
  if (bytes.length > 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  throw new ProviderError('接口返回的内容不是可识别的 PNG、JPEG 或 WebP 图片。');
}

export function extractImageItems(value, found = []) {
  if (Array.isArray(value)) value.forEach(item => extractImageItems(item, found));
  else if (value && typeof value === 'object') {
    const encoded = ['b64_json', 'base64', 'image', 'result'].map(key => value[key]).find(item => typeof item === 'string' && item);
    const url = value.url || (typeof value.image_url === 'object' ? value.image_url?.url : value.image_url);
    if (encoded) found.push({ encoded });
    else if (typeof url === 'string') found.push({ url });
    for (const key of ['data', 'output', 'images', 'result']) {
      if (typeof value[key] === 'object') extractImageItems(value[key], found);
    }
  }
  return found;
}

export function isPublicAddress(address) {
  if (net.isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127));
  }
  if (net.isIP(address) === 6) {
    return /^[23][0-9a-f]{3}:/i.test(address) && !address.toLowerCase().startsWith('2001:db8:');
  }
  return false;
}

async function download(url, signal, fetchImpl) {
  for (let redirects = 0; redirects < 4; redirects++) {
    const target = new URL(url);
    if (target.protocol !== 'https:' || target.username || target.password) throw new ProviderError('远端图片地址不是安全的 HTTPS 地址。');
    const records = await dns.lookup(target.hostname, { all: true });
    if (!records.length || records.some(record => !isPublicAddress(record.address))) throw new ProviderError('已阻止访问本地或私有网络的图片地址。');
    const response = await fetchImpl(target, { signal, redirect: 'manual' });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new ProviderError('图片下载重定向缺少目标地址。');
      url = new URL(location, target).toString();
      continue;
    }
    if (!response.ok) throw new ProviderError(`图片下载失败（HTTP ${response.status}）。不自动重新生成，避免重复扣费。`);
    return readLimited(response, 32 * 1024 * 1024);
  }
  throw new ProviderError('图片下载重定向次数过多。');
}

export class ImageProvider {
  constructor(config, fetchImpl = fetch) { this.config = config; this.fetch = fetchImpl; }

  async request(endpoint, payload, timeoutMs = this.config.timeoutMs) {
    const { baseUrl, apiKey } = this.config;
    if (!baseUrl || !apiKey) throw new ProviderError('未配置端点或密钥，请检查本地 Image_key.txt。', 503);
    let response;
    try {
      response = await this.fetch(`${baseUrl}${endpoint}`, {
        method: payload ? 'POST' : 'GET',
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json', 'Content-Type': 'application/json' },
        body: payload ? JSON.stringify(payload) : undefined,
        signal: AbortSignal.timeout(timeoutMs), redirect: 'error',
      });
      const buffer = await readLimited(response);
      let body;
      try { body = JSON.parse(buffer.toString('utf8')); }
      catch { throw new ProviderError(`接口返回非 JSON 内容（HTTP ${response.status}）。请核对端点。`); }
      if (!response.ok) {
        const message = sanitize(body.error?.message || body.message || '请检查模型、额度或参数。', apiKey);
        throw new ProviderError(`接口错误（HTTP ${response.status}）：${message}`, response.status);
      }
      return body;
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        throw new ProviderError('请求超时，服务商可能仍在生成或计费。请先检查服务商记录，不要立即重试。', 504);
      }
      throw new ProviderError(`接口连接失败：${sanitize(error.message, apiKey)}。不自动重试，以免重复扣费。`);
    }
  }

  async models() {
    const body = await this.request('/models', null, 20000);
    const models = (body.data || body.models || []).filter(item => item?.type === 'image' || /image|flux|dall-e|imagen|seedream|banana/i.test(item?.id || ''))
      .map(item => ({ id: item.id, name: item.display_name || item.id }));
    if (!models.length) throw new ProviderError('此密钥未返回可识别的生图模型，请检查服务商分组。', 503);
    return [...new Map(models.map(item => [item.id, item])).values()];
  }

  async generate(input) {
    const payload = { model: input.model, prompt: input.prompt, size: input.size, n: input.n };
    // Auto means omit the optional parameter, not claim relay support for "auto".
    if (input.quality !== 'auto') payload.quality = input.quality;
    const body = await this.request('/images/generations', payload);
    const items = extractImageItems(body);
    if (!items.length) throw new ProviderError('接口没有返回图片数据。原请求可能已计费，请核对服务商记录。');
    if (items.length > 4) throw new ProviderError('接口返回的图片数量异常。');
    const images = [];
    for (const item of items) {
      const bytes = item.encoded
        ? Buffer.from(item.encoded.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, ''), 'base64')
        : await download(item.url, AbortSignal.timeout(60000), this.fetch);
      images.push({ bytes, extension: imageType(bytes) });
    }
    return images;
  }
}

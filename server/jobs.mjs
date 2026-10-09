import { mkdir, readdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { sanitize } from './config.mjs';

export class InputError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export function validateInput(input, config, models) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new InputError('请求必须是 JSON 对象。');
  const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : '';
  if (!prompt || prompt.length > config.maxPromptLength) throw new InputError(`提示词不能为空，且不能超过 ${config.maxPromptLength} 字。`);
  if (!models.some(model => model.id === input.model)) throw new InputError('请选择此密钥实际可用的模型。');
  const size = input.size || config.defaultSize;
  if (!config.sizes.some(item => item.value === size)) throw new InputError('不支持此图片尺寸。');
  const n = input.n ?? 1;
  if (!Number.isInteger(n) || n < 1 || n > config.maxImages) throw new InputError(`图片数量必须在 1 到 ${config.maxImages} 之间。`);
  const quality = input.quality || 'auto';
  if (!['auto', 'low', 'medium', 'high'].includes(quality)) throw new InputError('不支持此质量参数。');
  if (input.requestId !== undefined && (typeof input.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestId))) {
    throw new InputError('requestId 必须是 UUID v4。');
  }
  return { prompt, model: input.model, size, n, quality };
}

export class JobStore {
  constructor(config, provider) {
    this.config = config; this.provider = provider; this.jobs = new Map(); this.draining = false;
    this.jobDir = path.join(config.dataDir, 'jobs');
  }

  async init() {
    await mkdir(this.jobDir, { recursive: true });
    await mkdir(this.config.outputDir, { recursive: true });
    for (const file of await readdir(this.jobDir)) {
      if (!/^[0-9a-f-]+\.json$/.test(file)) continue;
      const job = JSON.parse(await readFile(path.join(this.jobDir, file), 'utf8'));
      if (job.status === 'queued' || job.status === 'running') {
        job.status = 'interrupted';
        job.error = '服务在任务完成前停止。服务商可能仍在处理或计费；不会自动重新提交，请先核对远端记录。';
        job.finishedAt = new Date().toISOString();
        await this.save(job);
      }
      this.jobs.set(job.id, job);
    }
  }

  async save(job) {
    const filename = path.join(this.jobDir, `${job.id}.json`);
    await writeFile(`${filename}.tmp`, JSON.stringify(job, null, 2), 'utf8');
    await rename(`${filename}.tmp`, filename);
  }

  list() { return [...this.jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }

  async create(input, models) {
    const data = validateInput(input, this.config, models);
    const id = input.requestId?.toLowerCase() || randomUUID();
    if (this.jobs.has(id)) {
      const job = this.jobs.get(id);
      if (['prompt', 'model', 'size', 'n', 'quality'].some(key => job[key] !== data[key])) throw new InputError('同一 requestId 不能对应不同的生成参数。', 409);
      return job;
    }
    if (this.list().filter(job => ['queued', 'running'].includes(job.status)).length >= this.config.maxQueue) throw new InputError('队列已满，请等当前任务完成。', 429);
    const job = { id, ...data, status: 'queued', createdAt: new Date().toISOString(), images: [] };
    this.jobs.set(id, job);
    try { await this.save(job); }
    catch (error) { this.jobs.delete(id); throw error; }
    queueMicrotask(() => this.drain().catch(() => { this.draining = false; }));
    return job;
  }

  async drain() {
    if (this.draining) return;
    this.draining = true;
    try {
      for (const job of this.jobs.values()) {
        if (job.status !== 'queued') continue;
        job.status = 'running'; job.startedAt = new Date().toISOString();
        await this.save(job);
        try {
          const images = await this.provider.generate(job);
          const date = job.createdAt.slice(0, 10);
          const directory = path.join(this.config.outputDir, date);
          await mkdir(directory, { recursive: true });
          for (const [index, image] of images.entries()) {
            const relative = `${date}/${job.id}-${index + 1}.${image.extension}`;
            await writeFile(path.join(this.config.outputDir, relative), image.bytes);
            job.images.push({ url: `/outputs/${relative}`, filename: path.basename(relative), bytes: image.bytes.length });
          }
          job.status = 'completed';
        } catch (error) {
          job.status = 'failed'; job.error = sanitize(error.message, this.config.apiKey); job.httpStatus = error.status || 502;
        }
        job.finishedAt = new Date().toISOString();
        job.elapsedMs = Date.parse(job.finishedAt) - Date.parse(job.startedAt);
        await this.save(job);
      }
    } finally { this.draining = false; }
  }

  async deleteJob(id) {
    const job = this.jobs.get(id);
    if (!job) return;

    // 删除图片文件
    for (const image of job.images) {
      try {
        const imagePath = path.join(this.config.outputDir, image.url.replace(/^\/outputs\//, ''));
        await unlink(imagePath);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }

    // 删除任务文件
    const filename = path.join(this.jobDir, `${job.id}.json`);
    await unlink(filename);
    this.jobs.delete(id);
  }
}

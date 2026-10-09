import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';

export async function acquireServiceLock(dataDir) {
  await mkdir(dataDir, { recursive: true });
  const filename = path.join(dataDir, 'service.lock');
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let file;
    try { file = await open(filename, 'wx'); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      let owner;
      try { owner = JSON.parse(await readFile(filename, 'utf8')); }
      catch { throw new Error('服务锁尚未就绪。请等待现有工作台启动或检查 .data/service.lock。'); }
      if (!Number.isInteger(owner.pid) || owner.pid < 1) throw new Error('服务锁无效，请检查 .data/service.lock。');
      try { process.kill(owner.pid, 0); }
      catch (probeError) {
        if (probeError.code === 'ESRCH') { await unlink(filename); continue; }
        throw probeError;
      }
      throw new Error('同一目录已有工作台服务运行。请先关闭原工作台，避免同时修改历史。');
    }
    try { await file.writeFile(JSON.stringify({ pid: process.pid }), 'utf8'); }
    catch (error) { await file.close(); await unlink(filename); throw error; }
    await file.close();
    let released = false;
    return async () => {
      if (released) return;
      released = true;
      try {
        const owner = JSON.parse(await readFile(filename, 'utf8'));
        if (owner.pid === process.pid) await unlink(filename);
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    };
  }
  throw new Error('无法获得本地服务锁。');
}

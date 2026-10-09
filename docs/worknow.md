# Worknow · 当前工作

更新：2026-10-10（Asia/Shanghai）

## 当前目标

便携版已按当前源码重建。根目录 `Image Studio.exe` 含 IMG-011 的参数预设和视觉改动。

## 当前进度

- `npm run portable` 完成。产物 34,571,264 字节，构建号 `37e304c68f81140b`，SHA-256 `c2d7a761f7037f0af8dd46df9c724077cde3d2fc594177d950c7175f5e13ed4a`。
- SDK 仍是 `1.0.4258.31`，哈希与签名检查通过。构建脚本确认 exe 内没有真实密钥。
- 没有启动窗口，没有调用生图接口，没有改密钥、原图和历史任务。exe 不进 Git。

上一轮 IMG-010 的分类提示词库、批量下载和文档仍有效。桌面入口仍是根目录 `Image Studio.exe`，启动脚本在 `launch/`。

## 接下来做什么

没有正在推进的开发任务。这次只完成了打包，没有重新做原生窗口交互验收。双击根目录 `Image Studio.exe` 即可使用。

任务范围见 [taskshot](taskshot.md)。

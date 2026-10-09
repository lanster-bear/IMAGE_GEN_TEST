# Worknow · 当前工作

更新：2026-01-10（Asia/Shanghai）

## 当前目标

IMG-007 已完成：文档群与目录边界整理后，源码已发布到公开仓库 [lanster-bear/IMAGE_GEN_TEST](https://github.com/lanster-bear/IMAGE_GEN_TEST)。当前没有正在推进的开发任务；保留原有 WebView2 桌面版、配置和创作数据。

## 当前进度

公开源码已创建并推送，仓库可见性 `PUBLIC`、默认分支 `main`，首次推送提交 `d852d74` 与本地一致。README、文档导航、目录地图、发布说明及忽略规则已整理；50 文件安全扫描与 9 类排除探针通过，密钥、配置、exe、历史任务和原图共 5 个文件哈希不变。

用户重新完成 CLI OAuth 登录后，原 fine-grained PAT 建仓 403 阻塞已解除。从 GitHub 无凭据克隆后，`npm ci --ignore-scripts --no-fund --no-audit`、39/39 测试与 50 文件检查通过。公开仓库没有本机凭据、创作数据或预编译 exe。

IMG-006 已完成。根目录 `Image Studio.exe` 是 WebView2 原生桌面程序，34,567,168 字节，约 33 MiB。`launch/` 目录下的两份 Start 脚本均启动它，不再打开浏览器。Electron 依赖已撤回。

39 项离线测试通过；真实 WebView2 窗口的离线出图、重复启动、忙碌退出保护、关闭后服务退出、草稿恢复和高 DPI 双栏布局均通过。证据在 `.data/desktop-qa/verification.json` 和 `webview2-window.png`，Provider 是本机测试夹具，未新增付费生图。

正式版使用根目录原有密钥、配置、历史与原图。IMG-006 验收结束时旧 4317 浏览器服务已停止、正式桌面窗口已重新打开；IMG-007 未重启或重新验收正式窗口。桌面服务由窗口管理，使用临时端口。

## 当前事实

- 原密钥文件和原图字节保持不变；根目录历史仍是 1 个 completed 真实任务。
- SDK `1.0.4258.31` 的固定哈希与 Microsoft 签名已验证；本机 Runtime `154.0.4258.62` 可用。
- 应用免安装、不需要 Node.js；目标系统仍需要 WebView2 Runtime 与 .NET Framework 4.6.2+，exe 尚未签名。
- 数据仍在 `.data/` 和 `outputs/`。内部资源缓存不等于创作数据；不要删除它们来”清理”。

## 接下来做什么

项目结构已整理：启动脚本移至 `launch/`，前端视觉优化完成，文档清理进行中。后续修改先按 [rules](rules.md) 和 [publishing](publishing.md) 确认用户授权，再运行测试、检查提交内容并正常追加 Git 历史。IMG-007 未改应用源码、未重建 exe、未启停正式服务、未调用真实生成接口。

本地使用仍直接打开 `Image Studio.exe`；关闭窗口前必须等任务完成。后续修改打包源文件需重新 `npm run portable`，不能用源码测试通过代替 exe 验收。原生离线验收用 `npm run qa:desktop`。

未完成：另一台电脑部署、没有 Runtime 的环境、exe 签名、新增付费生成、sunburst 和其它尺寸实测。不要自动扩大这些范围。

任务范围与完成条件见 [taskshot](taskshot.md)。

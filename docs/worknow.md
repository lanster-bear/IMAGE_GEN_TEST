# Worknow · 当前工作

更新：2026-10-10（Asia/Shanghai）

## 当前目标

IMG-007：整理文档群和项目目录，安全发布公开源码仓库 `lanster-bear/IMAGE_GEN_TEST`。保留当前 WebView2 桌面版、配置和创作数据。

## 当前进度

公开发布待远端验收：已整理 README、文档导航、目录地图和发布说明；已初始化 Git `main`。39/39 测试、50 文件检查、50 个暂存文件安全扫描与 9 类排除探针通过；密钥、配置、exe、历史任务和原图共 5 个文件哈希不变。GitHub CLI 已登录 `lanster-bear`，待创建 public 仓库并推送核验。

IMG-006 已完成。根目录 `Image Studio.exe` 是 WebView2 原生桌面程序，34,567,168 字节，约 33 MiB。两份 Start 脚本均启动它，不再打开浏览器。Electron 依赖已撤回。

39 项离线测试通过；真实 WebView2 窗口的离线出图、重复启动、忙碌退出保护、关闭后服务退出、草稿恢复和高 DPI 双栏布局均通过。证据在 `.data/desktop-qa/verification.json` 和 `webview2-window.png`，Provider 是本机夹具，未新增付费生图。

正式版使用根目录原有密钥、配置、历史与原图。IMG-006 验收结束时旧 4317 浏览器服务已停止、正式桌面窗口已重新打开；IMG-007 未重启或重新验收正式窗口。桌面服务由窗口管理，使用临时端口。

## 当前事实

- 原密钥文件和原图字节保持不变；根目录历史仍是 1 个 completed 真实任务。
- SDK `1.0.4258.31` 的固定哈希与 Microsoft 签名已核验；本机 Runtime `154.0.4258.62` 可用。
- 应用免安装、不需要 Node.js；目标系统仍需要 WebView2 Runtime 与 .NET Framework 4.6.2+，exe 尚未签名。
- 数据仍在 `.data/` 和 `outputs/`。内部资源缓存不等于创作数据；不要删除它们来“清理”。

## 紧接着做

先完成 IMG-007 验收并同步 taskshot、handoff、verification。此轮不修改应用源码或重建 exe，不重启正式桌面服务，不调用真实生成接口。

本地使用仍直接打开 `Image Studio.exe`；关闭窗口前必须等任务完成。后续修改打包源文件需重新 `npm run portable`，不能用源码测试通过代替 exe 验收。原生离线验收用 `npm run qa:desktop`。

未做：另一台电脑部署、没有 Runtime 的环境、exe 签名、新增付费生成、sunburst 和其它尺寸实测。不要自动扩大这些范围。

任务范围与完成条件见 [taskshot](taskshot.md)。

# Portable · 免安装便携版

更新：2026-10-10

## 怎么用

公开仓库仅提供源码，不包含 `Image Studio.exe` 或密钥。克隆后先按本页构建；本机已有 exe 的用户可直接使用。源码浏览器入口是 `npm start`，`launch/` 目录下的 Start 脚本都要求 exe 已存在。

双击根目录 `Image Studio.exe`，或者 [launch/Start Portable.cmd](../launch/Start Portable.cmd)。打开的是 WebView2 原生桌面窗口，没有浏览器地址栏、外部浏览器或黑色控制台。不需要安装 Node.js。

`Image_key.txt` 保留在 exe 旁边，不会打进 exe，也不再复制密钥。图片、任务和配置分别是同目录的 `outputs/`、`.data/`、`config/studio.json`。本次 exe 放在项目根目录，直接继续使用原历史。新目录第一次运行时，默认非敏感配置会自动建立。

重复启动只唤起已有窗口。窗口启动隐藏服务，使用本机临时端口；正常关闭时通过带本地会话 token 的接口确认没有正在生成或落盘的任务，再关闭服务。生成中拒绝退出，不强制杀任务。没有远端取消或自动重试。

便携复制只需 exe 和自己的密钥文件；带走创作时额外保留 `.data/`、`outputs/`，自定义模板还要保留 `config/`。支持 Windows x64，需要 WebView2 Runtime 与 .NET Framework 4.6.2 或更高。本机 Runtime 为 `154.0.4258.62`，不替用户自动安装系统组件。

## 构建

先 `npm ci`，再 `npm run portable`。构建机需要 Windows x64、Node.js 24、开发依赖 postject 和 Windows 系统 C# 编译器。微软 WebView2 SDK 从官方 NuGet 下载，固定 `1.0.4258.31`，核对 SHA-256 和三份 Microsoft 签名。产物约 33 MiB，Node 服务与 SDK 以压缩资源嵌入 exe，不再携带独立 Chromium。

`npm run qa:desktop` 在实际原生窗口中填入提示词、点击生成、验证生成中退出保护、重复启动和服务退出。Provider 是本机夹具，图片复用本地已有文件或 1px PNG；不会发真实生图请求。证据在 `.data/desktop-qa/verification.json` 和 `webview2-window.png`。

## 技术边界

原生外壳使用 WinForms + WebView2；服务使用现有 Node SEA 子进程。首次运行解压 SDK 和服务到 `.data/runtime/webview2-<构建号>/`；页面和 ESM 服务再从内置资源加载。数据目录始终是用户 exe 所在目录。

窗口只允许导航和下载同源本地内容，禁用外部新窗口、网页权限和网页消息桥。用户界面无法直接访问文件系统、Node.js 或密钥。WebView2 用户资料在 `.data/webview-profile/`；正常退出将草稿、主题和未确认请求 ID 写入 `.data/desktop-preferences.json`，避免临时端口改变导致草稿丢失。

原生壳、内置服务各有单实例/数据锁。同目录不能同时运行源码服务与桌面服务。旧源码服务可用 `launch/Stop Studio.cmd` 停止；随后再打开桌面版。强制结束进程时不能保证收尾，重启后未完成任务仍标记 interrupted，不自动续发。

exe 未签名，可能出现 SmartScreen 提示。应用日志在 `.data/desktop.log`、`.data/portable.log`。旧 `dist/ImageStudio.exe` 仅为浏览器式历史产物，保留但不再作为默认入口；`npm run portable:legacy` 才重建它。旧 dist 内的密钥副本不要外传。

# Architecture · 模块地图

## 选择

Node.js 原生 HTTP + 静态 HTML/CSS/JS 保持不变。桌面版增加 WinForms + WebView2 原生壳，由壳管理隐藏的 Node SEA 服务。happy-dom 仅用于离线测试。服务端只监听 127.0.0.1，以数据锁确保同目录只有一份服务，不支持共享网络盘上的并发。

## 请求与数据流

界面提示词（浏览器或 WebView2）→ POST `/api/jobs` → 校验 + UUID 去重 → 任务 JSON 先落盘 → 单任务队列 → 服务商 `/v1/images/generations` → 校验图片格式 → 本地 outputs → 状态 JSON 更新 → 界面轮询并展示。

| 路径 | 职责 |
| --- | --- |
| `server/config.mjs` | 配置、密钥读取、基础地址归一化、脱敏 |
| `server/provider.mjs` | 模型发现、兼容协议请求、响应图片解析与下载 |
| `server/jobs.mjs` | 参数校验、去重、串行队列、文件持久化与恢复 |
| `server/index.mjs` | 同源接口、请求验证、静态文件白名单、HTTP 入口 |
| `server/service-lock.mjs` | 同目录服务互斥、死进程锁恢复 |
| `desktop/Host.cs` | WebView2 原生窗口、单实例、服务启停、退出保护、偏好保留 |
| `public/app.js` | 页面状态、草稿、提交、轮询、预览、历史、主题 |
| `public/styles.css` | 主题 token、布局、响应式和减少动效 |
| `config/studio.json` | 非敏感默认参数和提示词模板 |
| `scripts/` | Windows 启停、CLI、语法/文档/密钥检查 |
| `tests/` | 假 Provider 的离线测试 |

根目录入口、本地专用目录和 Git 提交边界见 [directories](directories.md)。本轮整理保留模块位置，不改变运行路径或数据布局。

## 任务状态

`queued → running → completed / failed`。进程重启后旧 queued/running 变为 `interrupted`，不自动续发。UUID 相同且参数相同的提交返回原任务；参数不同返回 409。每张图保留真实格式与原始字节，不压缩为缩略图替代原图。

## 数据边界

- `Image_key.txt` 和 `.env` 不提供静态下载。
- `.data/jobs` 保留提示词、参数、状态、时间和本地图片路径，不保存授权头或远端签名 URL。
- public 静态文件采用固定白名单；outputs 路径采用严格日期、UUID、图片扩展名格式。
- POST 需要本地会话 token，检查 Host 与 Origin，无跨域允许头。
- URL 图片下载不附加 API Key，限制 HTTPS 和公网地址；此机制不是公网部署安全认证。

参数、接口与错误边界见 [api](api.md)。

## 便携版

`scripts/build-webview2.mjs` 调用 `build-service.mjs` 生成 Node SEA 服务，再将服务、微软 SDK 和 x64 loader 压缩嵌入原生壳，输出根目录 `Image Studio.exe`。不嵌入或复制密钥。窗口用临时本地端口连接自己的服务；退出接口拒绝中断正在生成/落盘的任务。细节见 [portable](portable.md)。

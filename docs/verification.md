# Verification · 验收记录

更新：2026-10-10，Asia/Shanghai。以下按任务保留历史验收；公开源码不附带本地截图、任务记录、原图或凭据。

## 已确认

- Node.js 24.15.0、npm 12.0.2 可用。
- 初始目录仅一个 Image_key.txt（原文件保留）。
- 服务商 `/v1/models` HTTP 200，返回 gpt-image-2.5-flare 和 gpt-image-2.5-sunburst。
- `/v1/images/batches/models` 返回 404 / BATCH_IMAGE_DISABLED，不作为本项目依赖。

## 已通过的验收

| 检查 | 结果 |
| --- | --- |
| `npm test` | 30/30；23 项后端/协议/HTTP 测试 + 7 项离线前端交互测试 |
| `npm run check` | 35 个项目文件；JS 语法、文档链接、真实密钥隔离与忽略规则通过 |
| 一键启动 | Windows PowerShell 5 脚本启动成功，打开工作台；4310 占用后改为 4317 |
| 重复启动 | 返回 already running，复用同一服务，不创建第二个进程 |
| 停止与重启 | 停止后图片保留；重启服务 PID 改变，1 个 completed 任务及图片保持完整 |
| 真实生成 | CLI → 本地 API → flare → 返回图片 → 落盘，成功；本轮仅 1 次付费生图请求 |
| 图片格式与尺寸 | PNG，1024×1024，1,598,696 字节；已打开检查实际画面 |
| 原图下载 | HTTP 200 / image/png / attachment；下载字节与磁盘原图完全一致 |
| 页面渲染 | 1440×1120 浅色、深色，500×1900 小屏；均显示真实模型和图片，已逐张视觉检查 |
| 密钥隔离 | config 响应无 Key；6 个运行时任务/日志/页面文件扫描无真实 Key；源码检查通过 |
| 依赖审计 | 安装时 npm audit 0 漏洞；生产依赖 audit 0 漏洞；运行时依赖为 0 |

前端测试覆盖模板填入、计数和草稿、主题与导航、提交 token、重复点击防护、历史回填、搜索、错误处理、断线恢复和 HTML 注入隔离。后端测试覆盖错误脱敏、不自动重试、UUID 大小写去重、串行、队列上限、持久化、重启中断、静态白名单及同源检查。

## 真实出图记录

- 参数：`gpt-image-2.5-flare` / `1024x1024` / `n=1` / 默认质量（quality 字段省略）。
- 服务端生成耗时：63.203 秒。
- 任务标识、原始提示词和图片校验值只留在本机任务记录中，不公开。
- 原图与任务记录：本机 `outputs/2026-10-09/` 和 `.data/jobs/`，两者均被 Git 忽略。
- 页面截图：`.data/qa/desktop-light.png`、`desktop-dark.png`、`mobile-light.png`。

## 验收边界

内置浏览器访问本地地址返回 `net::ERR_BLOCKED_BY_CLIENT`，没有绕过安全屏障。因此没有真实浏览器点击生成的证明；使用 happy-dom 的离线交互测试与 Chrome 命令行页面渲染补充，真实出图由 CLI 验证同一服务链路。

Chrome 无头命令行的 390px 请求实际产生 500px CSS 视口。诊断页面返回 innerWidth=500，所以丢弃被裁切的 390px 截图，以真实 500px 重新渲染并检查。没有声称通过 390px 真机验证。

## 不作能力承诺

仅列出已实测的模型和参数组合。其它模型、横图/竖图/自动尺寸、显式质量、图生图和批量端点均不能从页面选项推断成功。所有离线图像使用测试夹具，不属于服务商生成证据。

## IMG-005 · 2026-10-09

| 检查 | 结果 |
| --- | --- |
| `npm test` | 33/33。新增工作状态与键盘路径、便携资源清单、数据根目录 |
| `npm run check` | 语法、文档链接、真实密钥隔离通过 |
| 页面 | 去掉口号和装饰色块；生成按钮紧跟参数；最近任务不再压住缩略图 |
| 渲染 | 重新输出 `.data/qa/desktop-light.png`、`desktop-dark.png`、`mobile-light.png`；500px 宽，不是 390px 真机 |
| `npm run portable` | `dist/ImageStudio.exe` 91,885,568 字节；构建号 `a41d6378acb055d1` |
| 隔离启动 | `PORT=4391`、假端点 `127.0.0.1:9`、`STUDIO_OPEN=0`；健康检查 `ok`；页面含工作台且不含测试密钥 |
| 密钥 | 真实 Key 不在 exe 字节内。`dist/Image_key.txt` 是本地副本，目录已忽略 |

没有为这次打包调用付费生图，也没有重启正在监听 4317 的源码服务。便携版数据在 exe 旁边，不证明它读到了源码目录的旧任务。

## IMG-006 · 2026-10-10：WebView2 原生桌面

| 检查 | 结果 |
| --- | --- |
| `npm test` | 39/39；包含数据锁、死进程锁恢复、关闭接口鉴权/跨站保护、生成及落盘退出保护、关闭期间待发现模型请求的竞态 |
| `npm run check` | 53 个项目文件；语法、文档链接和真实密钥隔离检查通过 |
| `npm run portable` | 根目录 `Image Studio.exe`，34,567,168 字节；构建号 `1b23a6c9dd96ac5b` |
| exe SHA-256 | `e0f0c9295bc94e87318eba3b62ba1643e96060e02f7a8ba84078127bc728a6c8` |
| SDK | 官方 NuGet `1.0.4258.31`；SHA-256 `56f7f4b8bf9aee4b8efefbbdd4f67d5f74ebd1b100ed0806da71bf76af481aa9`；Core/WinForms/Loader 三份 Microsoft 签名有效 |
| `npm run qa:desktop` | 实际 WebView2 窗口句柄 `3287360`；Runtime `154.0.4258.62`；同源页面正常，未显示夹具密钥 |
| 原生界面操作 | 填入提示词 → 点击生成 → 本机假 Provider → 本地落盘 → 当前画面显示，1 次假生成请求，无真实付费生图 |
| 单实例 | 验收期间再次启动正常退出并唤起原窗口，未增加服务或生成调用 |
| 退出保护 | 生成中关闭被拒绝，任务完成后窗口正常关闭，服务 PID `64860` 确认不存在 |
| 状态与布局 | 第二轮启动成功恢复草稿；CSS 视口 1280，提示词/画面保持双栏；1920×1260 WebView2 预览已视觉检查 |
| 原有文件 | 密钥文件字节不变，原图字节及 SHA-256 不变；主数据目录仍仅有原 1 个 completed 任务 |
| 依赖 | Electron/electron-builder 已移除；`npm audit --omit=dev` 为 0 漏洞 |
| 正式启动 | 原生窗口已重新打开，内置服务有 2 个真实可用模型、1 个历史任务、0 个排队/生成任务；未提交真实生图 |

原生证据：`.data/desktop-qa/verification.json`、`.data/desktop-qa/webview2-window.png`。构建信息：`.data/build/webview2/build-result.json`。假 Provider 为本机 HTTP 夹具；响应图复用了既有本地图像，不属于新的服务商生成证据。

正式版已重新打开，根目录配置与历史保持原位。默认 Start 脚本不再调用外部浏览器。目标系统需 WebView2 Runtime 和 .NET Framework，另一台电脑、缺少 Runtime、exe 签名与新付费生成未验证。

## IMG-007 · 2026-10-10：文档、目录与公开源码

| 检查 | 结果 |
| --- | --- |
| 整理前基线 | `npm test` 39/39，`npm run check` 53 个文件通过；项目原无 Git 仓库 |
| 整理后测试 | `npm test` 39/39；假 Provider，不新增付费请求 |
| 整理后源码检查 | `npm run check` 50 个文件，JS 语法、文档链接与真实密钥隔离通过；Windows 缓存改为排除 |
| 公开目录 | 保留 config/server/public/desktop/scripts/tests/docs 分层；新增目录地图与发布说明，未移动或删除本地数据 |
| 暂存区 | 50 个源码/文档文件；路径白名单、真实本机 Key 字节和凭据特征扫描通过；匹配的假 Key/URL 已核对为测试夹具 |
| Git 排除 | 9 个探针通过：密钥、两类环境文件、任务、原图、旧 dist、exe、开发依赖、Windows 缓存；`.env.example` 允许提交 |
| 原文件保护 | 密钥、exe、非敏感配置、1 个历史任务和 1 张原图共 5 个文件 SHA-256 与整理前一致 |
| GitHub | 登录账号 `lanster-bear` 已核验；目标仓库名不存在；创建与推送待验收 |

公开文档移除了私人任务标识和原始提示词，本机任务/原图保留。此轮不改应用功能、不重建 exe、不启停正式服务、不做付费生成，也不重复历史桌面交互验收。公开源码没有预编译程序或本机验收截图；另一台电脑和新环境生图仍未验证。

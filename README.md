# Image Studio

输入提示词，一键生成图像。图片和历史保存在电脑上，密钥只由本地服务端读取。

公开源码仓库：[IMAGE_GEN_TEST](https://github.com/lanster-bear/IMAGE_GEN_TEST)。可在另一台电脑克隆源码并使用自己的服务商账号运行。应用仍只监听本机，不是公网服务。仓库不包含 API Key、个人图片、任务历史或预编译 exe。

## 新电脑首次运行

最简单的方式是运行源码版。先在人手动完成以下准备：

1. 安装 Git 和 Node.js 22 或更高版本（建议安装 Node.js LTS）。安装完成后打开新的终端，运行 `git --version`、`node --version`、`npm --version` 确认命令可用。
2. 选择一个提供 **OpenAI 兼容图像生成 API** 的服务商，并登录其官方网站/控制台。按服务商要求实名或充值，在控制台创建 API Key，确认该 Key 所属分组已开通图像生成权限，并记下 API Base URL 和一个可用的生图模型 ID。模型发现接口需兼容 `GET /v1/models`，生成接口需兼容 `POST /v1/images/generations`；仅支持聊天文本或其它非兼容格式的服务不能直接使用。
3. 下载项目源码：

```powershell
git clone https://github.com/lanster-bear/IMAGE_GEN_TEST.git
cd IMAGE_GEN_TEST
```

4. 在项目根目录用记事本创建 `Image_key.txt`。若保存对话框有“保存类型”，选择“所有文件”；确认文件名不是 `Image_key.txt.txt`。写入两行，将示例替换成服务商控制台里的真实值：

```text
https://你的服务商提供的API地址/v1
API_KEY=粘贴你刚创建的API_Key
```

第一行是 API Base URL，通常以 `/v1` 结尾；不要填模型网页地址，也不要把 `/images/generations` 加在末尾。第二行必须是服务商的 API Key，不是网站登录密码。部分服务商给出的地址格式不同，请以其 API 文档中的兼容 Base URL 为准。也可参照 [.env.example](.env.example) 配置本地 `.env` 或环境变量；优先级见[配置说明](docs/configuration.md)。

**密钥只保存在自己的电脑上。** `Image_key.txt` 和 `.env` 已被 Git 忽略，不要把它们贴进聊天、截图、Issue 或提交到 GitHub。若不慎公开了 Key，应立即在服务商控制台撤销并重新创建。

## 让 Agent 完成启动与验证

前置准备完成后，在项目目录中打开你使用的编程 Agent，并把下面的指令交给它。请把方括号中的提示词换成你愿意实际生成的一张图：

> 请先阅读 README.md 和 AGENTS.md，检查本机 Node.js 版本、Image_key.txt 是否存在且非空；不要打印、复制或提交密钥。运行 `npm ci` 安装锁定的开发/测试依赖，然后运行 `npm test` 和 `npm run check`。启动应用并检查能否发现生图模型。若配置有效，请使用提示词“[填写一条简单的测试图像提示词]”只提交一次真实生图请求，等待任务结束并确认图片已保存到 outputs/。生图可能产生费用；不要换模型重试。遇到超时、失败或结果不确定时停止并告诉我检查服务商用量，不要再次提交。完成后报告运行地址、模型 ID、任务状态和图片文件位置，不要报告 API Key。

正常启动时，源码版默认只在本机 `http://127.0.0.1:4317` 提供服务。模型列表能加载只代表 Key 和模型发现可用；按上述指令完成一次真实任务并在 `outputs/` 找到图片，才算验证了生图链路。每次真实生成都可能计费；超时也可能已计费，软件不会自动重试。

也可以人工启动源码版：

```powershell
npm start
```

随后在浏览器打开 `http://127.0.0.1:4317`。点击生成会调用服务商接口并可能计费。不要与同目录桌面版并行运行。

### 常见配置问题

- 找不到模型：确认 API Base URL、Key 和服务商的生图模型授权/分组；不要把 Key 发到聊天里。可在服务商控制台检查访问权限与余额。
- HTTP 401/403：通常是 Key 无效、权限不足或分组未开通；到服务商控制台检查，不要反复重试。
- 模型列表正常但生成报参数错误：确认使用了服务商支持的模型 ID 和图像生成兼容接口。兼容接口不保证所有尺寸或质量参数均受支持。
- 服务商不兼容上述接口：本项目不能仅凭 API Key 自动适配；先确认服务商提供 OpenAI 图像生成兼容模式。
- 端口 4317 被占用：让 Agent 检查并按配置说明更换 `PORT`，不要同时启动多个服务操作同一数据目录。

## 本机桌面版

Windows 双击根目录 **Image Studio.exe**，直接打开 WebView2 原生桌面窗口，不打开外部浏览器，不需要安装 Node.js。`launch/` 目录下的 **Start Studio.cmd** 和 **Start Portable.cmd** 也启动同一桌面程序。

公开仓库不附带 exe。Windows 用户可在安装 Node.js 24 和构建所需的系统 C# 编译器后，按下节从源码构建桌面版；克隆仓库后不能直接运行 Start 脚本。首次使用建议先运行源码版，减少系统构建前置要求。

端点和密钥从同目录 `Image_key.txt` 读取。exe 放在项目根目录时直接使用已有图片、历史和配置，不迁移或改写密钥。服务只在本机临时端口运行，由桌面窗口管理。

关闭窗口会一起关闭内置服务；有生成任务时会阻止退出。重复双击只唤起已有窗口。草稿和主题会在正常退出时保存，下次打开继续使用。

便携使用：复制 **Image Studio.exe** 和自己的 `Image_key.txt` 即可。要保留创作，再带上 `.data/` 和 `outputs/`，自定义模板带上 `config/`。支持 Windows x64，需要系统已有微软 WebView2 Runtime 和 .NET Framework 4.6.2 或更高。当前产物约 33 MiB，不包含密钥、尚未签名。详见 [便携版](docs/portable.md)。

## 开发、测试与构建

开发测试安装仅包含本地测试和打包工具：

```powershell
npm ci
npm test
npm run check
```

Windows x64 构建桌面版需要 Node.js 24 与系统 C# 编译器；构建会下载并校验固定版本的微软 WebView2 SDK，但不会调用生图接口：

```powershell
npm run portable
```

产物为根目录 `Image Studio.exe`。`npm run qa:desktop` 使用实际 WebView2 窗口与本机假 Provider 验收，不消耗服务商额度。截图工具 `npm run qa:render` 要求源码服务已启动和本机 Chrome/Edge 可用，产物在 `.data/qa/`，不提交。

命令行出图需先启动源码服务，会调用付费接口；不能直接使用桌面版的临时端口：

```powershell
npm run generate -- --prompt "清晨的山间湖泊，薄雾、自然光，无文字"
```

## 已包含

- 提示词输入、快捷模板、Ctrl/⌘ + Enter 提交。
- 实时读取当前密钥可用模型，支持刷新连接。
- 尺寸选择、可选质量参数，默认一次一张。
- 本地排队生成、状态查询、原图预览和下载。
- 历史作品库、搜索、提示词与参数回填、草稿保留。
- 参数预设：把当前模型、比例、质量存成一组，下次一键套用。
- 批量管理：选择多个任务批量下载、删除或导出为 JSON。
- 提示词库：保存常用提示词片段，快速插入组合。
- 深浅主题和小屏布局。
- 本地服务端密钥隔离、请求 ID 去重、错误脱敏、不自动重试。

尺寸/质量来自兼容协议，不等于服务商保证支持。具体实测范围见 [验证记录](docs/verification.md)。不包含图生图、远程多用户、自动提示词优化或批量计费策略。

## 项目目录

```text
IMAGE_GEN_TEST/              克隆目录；现有本机目录可保持原名
├─ AGENTS.md                 Agent 首次进入
├─ README.md                 用户使用入口
├─ .env.example              占位配置，无真实凭据
├─ .gitignore                公开源码与本地文件的边界
├─ package.json / lock       命令与开发依赖锁定
├─ launch/                   启动脚本
│  ├─ Start Studio.cmd       启动桌面窗口
│  ├─ Start Portable.cmd     启动同一桌面程序
│  └─ Stop Studio.cmd        旧浏览器版安全停止
├─ config/studio.json        非敏感参数与提示词模板
├─ server/                   配置、服务商适配、任务、HTTP 服务
├─ public/                   原生 HTML / CSS / JS 前端
├─ desktop/                  WebView2 原生窗口与应用清单
├─ scripts/                  启停、构建、出图、检查和离线验收
├─ tests/                    不消耗额度的自动化测试
└─ docs/                     使用、技术、状态、证据和发布文档
```

本地专用文件：`Image_key.txt`、`.env*`（示例除外）、`Image Studio.exe`、`.data/`、`outputs/`、`dist/`、`node_modules/`、`%SystemDrive%/` 缓存。它们均不上传，整理目录不代表删除数据。完整职责见 [目录地图](docs/directories.md)。

更多：[文档索引](docs/README.md) · [配置说明](docs/configuration.md) · [验证记录](docs/verification.md) · [发布说明](docs/publishing.md) · [Agent 交接](docs/handoff.md)。

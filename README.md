# Image Studio

输入提示词，一键生成图像。图片和历史保存在电脑上，密钥只由本地服务端读取。

公开源码仓库：[IMAGE_GEN_TEST](https://github.com/lanster-bear/IMAGE_GEN_TEST)。仅面向本机使用，不是公网服务。仓库不包含 API Key、个人图片、任务历史或预编译 exe。

## 从 GitHub 运行源码

需要 Node.js 22 或更高；应用运行时没有 npm 依赖。

```powershell
git clone https://github.com/lanster-bear/IMAGE_GEN_TEST.git
cd IMAGE_GEN_TEST
```

在项目根目录自行创建 `Image_key.txt`，填写自己的服务商地址和 Key。格式如下，占位值必须在本机替换：

```text
https://your-provider.example/v1
API_KEY=enter-locally-only
```

也可参照 [.env.example](.env.example) 设置环境变量或本地 `.env`，优先级见 [配置说明](docs/configuration.md)。不要提交凭据。

```powershell
npm start
```

随后在浏览器打开 `http://127.0.0.1:4317`。发现模型不等于生成图片；点击生成会调用服务商接口并可能计费。不要与同目录桌面版并行运行。

## 本机桌面版

Windows 双击根目录 **Image Studio.exe**，直接打开 WebView2 原生桌面窗口，不打开外部浏览器，不需要安装 Node.js。`launch/` 目录下的 **Start Studio.cmd** 和 **Start Portable.cmd** 也启动同一桌面程序。

公开仓库不附带 exe。已有本机产物可直接运行；克隆仓库后需先按下节构建，Start 脚本不是源码启动入口。

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
- 批量管理：选择多个任务批量删除或导出为 JSON。
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

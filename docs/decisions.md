# Decisions · 技术取舍与来源

2026-10-09

## 本地原生实现，不直接 fork 全套产品

初始只有一个密钥文件。初始调研未使用 GitHub CLI，浏览搜索工具路由不可用，改为通过公开 GitHub REST API 检索候选项目；这是历史调研方式，不代表当前工具状态：

- [shinpr/mcp-image](https://github.com/shinpr/mcp-image)：MIT，偏 MCP 工具和多服务商适配，没有本项目需要的独立本地 UI。
- [dickpy/dsh-imagegen](https://github.com/dickpy/dsh-imagegen)：Apache-2.0，依赖 DeepSeek Harness 插件环境，并非独立轻量工作台。
- [RicardoGEsteves/omniscient](https://github.com/RicardoGEsteves/omniscient)：MIT，全栈 SaaS 范围明显大于当前需求。

本轮没有复制第三方项目源码。选择 Node 原生服务 + 无构建前端，启动无需安装，目录与维护边界更小。代价是复杂交互和远程多人部署不适合此结构；用户明确需要时再评估框架迁移。

## 发现模型而非硬编码

实际 `/v1/models` 返回两个 2.5 模型，不能使用技能默认 `gpt-image-2` 来假定此账户有权限。界面根据实时列表填充；环境变量首选 ID 必须在列表内。

## 文件存储与串行队列

单机少量任务不需要数据库。每任务独立 JSON、临时文件原子替换，图片按日期落盘。一个服务串行调用，降低误并发与费用风险。IMG-006 增加同目录进程锁，但不增加远端取消或自动恢复重试。

## 费用确定性优先

UUID 去重；提交先持久化；失败不自动重试；重启标记未完成状态；停止器拒绝中断未完成任务。不会为了拿到一张图循环更换模型、尺寸或端点。

## 服务商来源

真实模型列表来自用户配置端点。公开 [接入文档](https://www.geek2api.com/docs/api-manual) 用于核对基础地址；探测批量模型接口返回 BATCH_IMAGE_DISABLED，因此不用批量协议。兼容协议参考本机 image2-generate 技能的请求/图片响应形态，服务商成功必须另做真实测试，不能从协议参考推出。

## 单文件可执行程序，不引入桌面框架

此节记录 IMG-005 的旧浏览器方案，IMG-006 已按用户要求替换默认入口。

免安装和轻量是同一件事。Electron 或 Tauri 会再带一套界面运行时；当前页面已经是静态 HTML。Node.js 24 官方 SEA 把现有服务和页面放进一个 exe，构建机以外不需要 Node。

Node 24 还没有 `--build-sea`，注入使用开发依赖 postject。SEA 入口只能是 CommonJS，所以不把 ESM 服务改写成另一套模块；入口解出原文件再启动。代价是首次启动多一次本地解包，以及 exe 体积约等于 Node 运行时。密钥、任务和原图留在 exe 外面。

## IMG-006：原生 WebView2，不使用 Electron

用户明确选择 WebView2。采用系统 .NET Framework 的 WinForms 壳，直接复用既有页面和 Node SEA 服务。微软 [运行环境分发说明](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution) 说明 Evergreen Runtime 的部署边界；SDK 固定为官方 NuGet 的 [1.0.4258.31](https://www.nuget.org/packages/Microsoft.Web.WebView2/1.0.4258.31)，哈希及 Microsoft 签名均验证。

取舍：exe 不打包独立 Chromium，压缩后约 33 MB；缺少 WebView2 Runtime 的电脑仍需安装微软组件，不把“应用免安装”写成“系统零依赖”。不引入 Electron、npm 运行依赖、账号或数据库。构建只使用本机 C# 编译器，不安装 Visual Studio 或全局工具。

窗口负责启动和关闭服务，生成/落盘期间阻止退出；原生互斥锁和数据锁避免重复服务。临时端口的 localStorage 原点会变化，因此正常退出单独保存草稿与主题，下一次注入受限白名单偏好。网页消息桥禁用，外部导航与权限被拒绝。

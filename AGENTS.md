# Agent 工作入口

本项目是仅在本机运行的生图工作台。先理解当前状态，再修改代码。密钥在 `Image_key.txt`，不得将它输出到对话、日志、网页或 Git。

## 每次进入的阅读顺序

1. [worknow](docs/worknow.md)：现在做什么、已经验证什么、下一步从哪里开始。
2. [rules](docs/rules.md)：修改范围、安全边界和验收规则。
3. [taskshot](docs/taskshot.md)：任务定义、状态及完成证据。
4. [handoff](docs/handoff.md)：上一轮交接、运行方式和已知限制。
5. 需要修改时再读 [architecture](docs/architecture.md) 与 [API](docs/api.md)；整理目录参考 [directories](docs/directories.md)，用户要求远程发布时再读 [publishing](docs/publishing.md)。

## 最短工作回路

读状态 → 为当前任务写可验证的验收项 → 运行相关测试 → 精确修改 → 再测试 → 更新 worknow/taskshot/handoff。

常用命令：`npm test`、`npm run check`、`npm start`。运行工作台不需安装依赖；新环境运行测试先 `npm ci`，只安装开发测试依赖。本机已安装。

真实生成会消耗服务商额度。离线测试使用假 Provider；需要实际生成时，先明确次数和提示词，不进行自动重试或盲测模型。

用户要求：思考先于编码；简单优先；只修改与请求直接相关的内容；以验收结果推进任务。不要擅自重构、删除旧图片、改动密钥或安装全局工具。远程发布必须取得用户明确授权；公开源码不包含本地密钥、创作数据、缓存或 exe。

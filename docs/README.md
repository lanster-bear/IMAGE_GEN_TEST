# 项目文档导航

人类使用从根目录 [README](../README.md) 开始；Agent 从 [AGENTS](../AGENTS.md) 开始。

按目的阅读：

- 使用与构建：README → configuration → portable。
- 开发与目录整理：directories → architecture → api。
- 恢复工作：worknow → rules → taskshot → handoff，再看 verification。
- 公开发布：publishing；先核验敏感文件与测试，再创建或推送仓库。

| 文档 | 用途 | 何时更新 |
| --- | --- | --- |
| [worknow](worknow.md) | 当前工作焦点、验证结果、下一步 | 每次任务开始与结束 |
| [taskshot](taskshot.md) | 任务快照、范围、验收与状态 | 任务状态改变时 |
| [handoff](handoff.md) | 交接运行状态、证据、限制 | 每次结束工作前 |
| [rules](rules.md) | 安全和修改约束 | 约束明确变化时 |
| [architecture](architecture.md) | 模块职责、目录与数据流 | 模块边界改变时 |
| [api](api.md) | 本地接口与服务商请求协议 | 接口改变时 |
| [configuration](configuration.md) | 密钥、模型、参数和启动 | 配置行为改变时 |
| [decisions](decisions.md) | 技术取舍与来源 | 做出影响维护的决策时 |
| [verification](verification.md) | 实际测试证据与未验证项 | 运行验收后 |
| [portable](portable.md) | 免安装 exe 的使用、构建和边界 | 打包方式改变时 |
| [directories](directories.md) | 源码分层、根目录入口和本地专用目录 | 目录职责或发布边界改变时 |
| [publishing](publishing.md) | GitHub 仓库、公开内容、安全检查与推送 | 用户授权发布或发布方式改变时 |

避免多处重复当前状态：taskshot 记任务事实，worknow 记当前行动，handoff 记恢复上下文，verification 记证据。

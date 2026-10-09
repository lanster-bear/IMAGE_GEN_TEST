# Directories · 目录地图

更新：2026-10-10

## 组织原则

保持当前源码分层，不为整理目录移动运行数据或改写路径。GitHub 仓库名为 `IMAGE_GEN_TEST`；现有本机目录 `IMAGE_GEN` 无需重命名。服务默认以项目根目录为数据根目录，桌面版以 exe 所在目录为数据根目录。

## 公开源码

| 路径 | 职责 |
| --- | --- |
| `README.md`、`AGENTS.md` | 用户使用入口与 Agent 工作入口 |
| `.gitignore`、`.env.example` | 提交边界与无凭据配置示例 |
| `package.json`、`package-lock.json` | 命令、开发依赖和锁定版本；运行时依赖为零 |
| `Start Studio.cmd`、`Start Portable.cmd` | 启动已构建的根目录桌面 exe |
| `Stop Studio.cmd` | 安全停止旧源码后台服务，不用于强杀桌面生成任务 |
| `config/` | 可公开的参数和示例模板；不要在此写入真实凭据 |
| `server/` | 本地 HTTP 服务、服务商适配、配置、任务队列与互斥锁 |
| `public/` | 静态页面、样式、浏览器交互和图标；不是公网发布目录 |
| `desktop/` | WebView2 原生窗口源码和 Windows 应用清单 |
| `scripts/` | 源码启停、CLI 出图、检查、构建和验收工具 |
| `tests/` | 使用假 Provider 的离线测试 |
| `docs/` | 使用/技术说明、当前状态、交接、历史验收和公开发布规则 |

模块级职责见 [architecture](architecture.md)，文档分工见 [文档导航](README.md)。

## 仅在本机保留

| 路径 | 内容与处理 |
| --- | --- |
| `Image_key.txt`、`.env*` | 服务商端点和凭据；仅 `.env.example` 可提交 |
| `.data/` | 历史任务、锁、日志、偏好、桌面资料、构建缓存和验收证据；整目录忽略 |
| `outputs/` | 按日期保存的原图；备份时与 `.data/` 一起保留，不提交 |
| `Image Studio.exe` | 当前 WebView2 构建产物；从源码重建，不放入 Git 历史 |
| `dist/` | 旧浏览器便携版等历史产物，可能有密钥副本；不外传、不自动删除 |
| `node_modules/`、`coverage/` | 可重新生成的开发依赖与测试产物 |
| `%SystemDrive%/` | 本机运行遗留的 Windows 缓存目录，不属于项目源码；保留并忽略 |

不要用删除 `.data/`、`outputs/`、旧构建目录或缓存的方式“整理”。本轮没有删除、搬迁这些目录，也没有修改图片或密钥。备份、清理和迁移必须单独获得用户授权。

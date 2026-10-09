# Worknow · 当前工作

更新：2026-01-10（Asia/Shanghai）

## 当前目标

IMG-008 已完成：项目结构整理、前端视觉优化、文档表达改进。启动脚本已移至 `launch/` 目录，前端增加过渡动画和交互反馈，文档剔除 AI 风格表达。所有改动已推送到 GitHub。

## 当前进度

目录结构整理完成：启动脚本移至 `launch/` 目录，根目录更整洁，所有文档链接已更新并通过检查。

前端视觉优化完成：
- 增加过渡动画和按钮状态反馈
- 优化间距和呼吸感
- 增强卡片深度
- 改善图片预览体验（渐入动画、圆角、阴影）
- 添加字数接近上限提示
- 提升基础字号和行高
- 优化侧边栏导航激活状态

文档改进完成：worknow、handoff、taskshot、directories、rules、portable、configuration 等文档剔除 AI 风格说法，使用直接清晰的表达。

39 项测试通过，50 文件检查通过。密钥、原图、历史任务字节保持不变。提交 `c018d45` 已推送到 GitHub。

IMG-007 已完成：源码已发布到公开仓库 [lanster-bear/IMAGE_GEN_TEST](https://github.com/lanster-bear/IMAGE_GEN_TEST)，可见性 `PUBLIC`、默认分支 `main`。

IMG-006 已完成：根目录 `Image Studio.exe` 是 WebView2 原生桌面程序，34,567,168 字节，约 33 MiB。

## 当前事实

- 原密钥文件和原图字节保持不变；根目录历史仍是 1 个 completed 真实任务。
- SDK `1.0.4258.31` 的固定哈希与 Microsoft 签名已验证；本机 Runtime `154.0.4258.62` 可用。
- 应用免安装、不需要 Node.js；目标系统仍需要 WebView2 Runtime 与 .NET Framework 4.6.2+，exe 尚未签名。
- 数据仍在 `.data/` 和 `outputs/`。

## 接下来做什么

当前没有正在推进的开发任务。后续修改先按 [rules](rules.md) 和 [publishing](publishing.md) 确认用户授权，再运行测试、检查提交内容并正常追加 Git 历史。

本地使用仍直接打开 `Image Studio.exe`；关闭窗口前必须等任务完成。后续修改打包源文件需重新 `npm run portable`，不能用源码测试通过代替 exe 验收。原生离线验收用 `npm run qa:desktop`。

未完成：另一台电脑部署、没有 Runtime 的环境、exe 签名、新增付费生成、sunburst 和其它尺寸实测。不要自动扩大这些范围。

任务范围与完成条件见 [taskshot](taskshot.md)。

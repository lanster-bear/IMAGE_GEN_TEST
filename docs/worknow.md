# Worknow · 当前工作

更新：2026-01-10（Asia/Shanghai）

## 当前目标

IMG-010 已完成：提示词库分类增强、批量下载图片、项目文档补充。所有改动已推送到 GitHub。

## 当前进度

提示词库分类增强：
- 支持 6 个分类：场景、光线、风格、构图、材质、其它
- 保存片段时选择分类（输入数字 1-6）
- 片段卡片显示分类下拉菜单，可切换分类
- 按分类分组显示，每组独立标题和网格
- 插入片段时自动添加中文分隔符（智能判断句尾）
- 旧数据自动迁移，未分类片段归入「其它」

批量管理增强：
- 新增批量下载图片功能（自动间隔下载）
- 按钮顺序优化：下载 > 导出 > 删除
- 导出按钮改为「导出 JSON」更明确

文档补充：
- 新增 [features.md](features.md)：完整功能说明
- 新增 [guide.md](guide.md)：用户使用指南
- 新增 [restructure-plan.md](restructure-plan.md)：目录整理记录

39 项测试通过，50 文件检查通过。密钥、原图、历史任务保持不变。提交 `5ac683b` 已推送到 GitHub。

IMG-009 已完成：批量管理和提示词库功能。

IMG-008 已完成：项目结构整理、前端视觉优化、文档表达改进。

IMG-007 已完成：源码已发布到公开仓库 [lanster-bear/IMAGE_GEN_TEST](https://github.com/lanster-bear/IMAGE_GEN_TEST)。

IMG-006 已完成：根目录 `Image Studio.exe` 是 WebView2 原生桌面程序，34,567,168 字节，约 33 MiB。

## 当前事实

- 原密钥文件和原图字节保持不变；根目录历史仍是 1 个 completed 真实任务。
- SDK `1.0.4258.31` 的固定哈希与 Microsoft 签名已验证；本机 Runtime `154.0.4258.62` 可用。
- 应用免安装、不需要 Node.js；目标系统仍需要 WebView2 Runtime 与 .NET Framework 4.6.2+，exe 尚未签名。
- 数据仍在 `.data/` 和 `outputs/`。
- 启动脚本位于 `launch/` 目录，根目录保持整洁。

## 接下来做什么

当前没有正在推进的开发任务。等待用户确认功能需求或提出新的优化方向。

可选方向：
1. 视觉进一步优化（前面已有详细方案）
2. 功能扩展：快捷键增强、预设参数组、图生图等
3. 其它用户需求

后续修改先按 [rules](rules.md) 和 [publishing](publishing.md) 确认用户授权，再运行测试、检查提交内容并正常追加 Git 历史。

本地使用仍直接打开 `Image Studio.exe`；关闭窗口前必须等任务完成。后续修改打包源文件需重新 `npm run portable`，不能用源码测试通过代替 exe 验收。原生离线验收用 `npm run qa:desktop`。

未完成：另一台电脑部署、没有 Runtime 的环境、exe 签名、新增付费生成、sunburst 和其它尺寸实测。不要自动扩大这些范围。

任务范围与完成条件见 [taskshot](taskshot.md)。

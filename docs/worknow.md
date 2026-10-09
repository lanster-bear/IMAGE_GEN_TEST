# Worknow · 当前工作

更新：2026-01-10（Asia/Shanghai）

## 当前目标

IMG-009 已完成：批量管理和提示词库功能。记录页面支持批量选择、删除、导出任务；新增提示词库保存和插入常用片段。所有改动已推送到 GitHub。

## 当前进度

批量管理功能完成：
- 记录页面添加复选框批量选择任务
- 全选/取消全选功能
- 批量删除：删除选中的任务及其图片文件，执行中任务受保护
- 批量导出：导出选中任务为 JSON 文件
- 服务端新增 DELETE /api/jobs/batch 接口

提示词库功能完成：
- 新增提示词库视图和导航入口
- 工作台选中文字后可保存为片段
- 保存的片段可插入到提示词框
- 片段管理：查看、插入、删除
- LocalStorage 持久化存储

39 项测试通过，50 文件检查通过。密钥、原图、历史任务保持不变。提交 `0f0e393` 已推送到 GitHub。

IMG-008 已完成：项目结构整理、前端视觉优化、文档表达改进。

IMG-007 已完成：源码已发布到公开仓库 [lanster-bear/IMAGE_GEN_TEST](https://github.com/lanster-bear/IMAGE_GEN_TEST)。

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

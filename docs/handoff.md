# Handoff · 交接

更新：2026-10-10

## 恢复入口

先读 [worknow](worknow.md)、[rules](rules.md)、[taskshot](taskshot.md)。原生壳 `desktop/Host.cs`，构建 `scripts/build-webview2.mjs`，服务 `server/index.mjs`，界面 `public/index.html` / `public/app.js`。目录职责见 [directories](directories.md)，便携版见 [portable](portable.md)，远程发布见 [publishing](publishing.md)。

## 当前交付状态

默认本机交付为根目录 `Image Studio.exe`。IMG-006 验收结束时已重新打开原生窗口、停止旧 4317 浏览器服务；IMG-007 不改变运行服务，也不重复桌面交互验收。真实任务仍是原来的 1 个，没有新增付费生成，原图和密钥字节不变。39 项测试通过；历史 WebView2 离线交互证据位于 `.data/desktop-qa/`。旧 dist 浏览器 exe 保留，但不再作为默认入口。证据以 [verification](verification.md) 为准。

## IMG-007 发布交接

文档与公开目录边界已整理，Git 已初始化为 `main`，50 个文件已通过暂存区安全扫描，39 项离线测试和源码检查通过。已登录 GitHub `lanster-bear`，目标仓库 `IMAGE_GEN_TEST` 尚待创建/推送验收。不要把待验收写成远端已完成。

仓库仅交付源码：不提交密钥、`.data/`、`outputs/`、exe、旧 dist 或 Windows 缓存。新克隆通过 `npm start` 运行源码；桌面入口先 `npm ci`、`npm run portable`。本机目录保留原名和布局，不搬迁数据。

## 本地运行

- 双击 `Image Studio.exe` 或两份 Start 脚本，直接打开 WebView2 桌面窗口。重复打开只唤起同目录窗口。
- 内置服务使用临时端口，不打开外部浏览器；关闭窗口会停止服务，生成或落盘中拒绝退出。
- exe 在根目录，数据也在根目录的 `.data` 与 `outputs`，继续使用已有配置和历史。
- 运行不需要 Node.js，系统需 WebView2 Runtime 与 .NET Framework 4.6.2+；本机均可用，exe 未签名。
- `npm run portable` 重建约 33 MiB exe；`npm run qa:desktop` 执行原生窗口离线出图验收。二者只在构建机需要开发工具。
- `npm start` / `npm run dev` 保留源码版；不能与同目录桌面版并行。Stop Studio.cmd 只用于停止旧源码后台服务。
- `npm test`、`npm run check` 和 `npm run qa:desktop` 不消耗服务商额度。

## 数据与敏感信息

端点与 Key 来源是根目录 `Image_key.txt`；可用环境变量覆盖。不要打印该文件。任务在 `.data/jobs/*.json`，图片在 `outputs/日期/`，两者均不提交。备份时一起保留。

## 必须知道的限制

- 重启时未完成任务标为 interrupted；不自动续发，防止重复计费。
- 没有远端取消协议；原生窗口有退出保护。任务管理器强杀、系统掉电等仍可能中断任务。
- 只验证实际测试过的模型与参数；其它兼容协议选项不是能力承诺。
- 没有多用户认证或公网部署配置，不要将绑定改为 `0.0.0.0`。
- 生成失败后只能回填参数，由用户决定是否再生成。
- IMG-006 使用实际 WebView2 窗口的自测驱动真实页面事件与本机假 Provider，不能写成新增真实服务商出图。
- 无头 Chromium 实际最小视口为 500px；已核验截图是 500px，不是 390px 真机验收。
- 草稿和主题在正常退出时保存到 `.data/desktop-preferences.json`，用于跨临时端口恢复；强杀不能保证最新草稿保存。
- 原生壳互斥锁防重复窗口，服务锁防同目录多服务。异常退出后只有确认锁 PID 已死才恢复；不擅自删除仍由活进程持有的锁。

## 已修复的环境问题

默认候选端口 4310 被 QQ 占用，因此改为 4317，未停止或改动 QQ。Windows PowerShell 5 的 node -e 引号问题改为调用 `scripts/port.mjs`，一键脚本已实际运行通过。

## 实测产物

模型 flare；1024×1024；n=1；默认质量（不发送 quality 字段）；耗时 63.203 秒。任务 ID 和原始提示词仅留在本机 `.data/jobs/`，不公开。

原图保留在本机 `outputs/2026-10-09/`。不要清理该目录或任务记录；GitHub 克隆不包含这些数据。

## 下一位 Agent

先执行离线测试，读取验证记录，再决定当前任务。新增功能需用户明确要求；不要因看到待拓展项就自行实现。

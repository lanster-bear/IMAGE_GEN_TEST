# Publishing · GitHub 公开发布

更新：2026-10-10

## 仓库与授权范围

用户明确要求创建 public 仓库：[lanster-bear/IMAGE_GEN_TEST](https://github.com/lanster-bear/IMAGE_GEN_TEST)，默认分支 `main`。发布的是源码与维护文档，不是公网部署，不包含 exe、账号凭据或个人创作数据。

本轮未选择或新增开源许可证。公开可查看不等于授予任意再分发权；如需许可证，另行由维护者明确选择。

## 发布内容

提交 README、AGENTS、配置示例、包清单/锁文件、启动脚本，以及 `config/`、`server/`、`public/`、`desktop/`、`scripts/`、`tests/`、`docs/`。具体职责见 [directories](directories.md)。

禁止提交：

- `Image_key.txt`、真实 `.env`、API Key、Authorization、签名下载 URL。
- `.data/`、`outputs/`、个人任务和提示词、原图、截图与日志。
- `Image Studio.exe`、`dist/`、`node_modules/`、`%SystemDrive%/` 缓存。

文档只保留可公开的测试结论与本地证据位置，历史任务的私人提示词和标识不放入仓库。配置中的演示模板和离线测试夹具可公开。

## 每次推送前

1. 确认用户已授权当前远程写操作，检查 Git 根目录、分支、身份及 `origin`；不要输出凭据文件或带 token 的远端地址。
2. 运行 `npm test` 和 `npm run check`。首次安装开发测试依赖使用 `npm ci`；测试不调用付费 Provider。
3. 使用 `git status --short`、`git diff --cached --stat` 和 `git ls-files` 核对实际提交清单；`.gitignore` 不会自动排除已经追踪的文件。
4. 对暂存文件检查真实 Key 和敏感路径，仅输出通过/失败与文件名，不输出匹配内容。确认密钥、配置、exe、历史和原图与整理前校验基线一致。
5. 提交后普通推送，禁止 force push。核对 GitHub 可见性、默认分支与远端提交 SHA；记录测试与发布证据到 [verification](verification.md)。

仓库第一次创建使用 GitHub CLI 的当前登录账号。若同名仓库已存在，先核对归属与内容，不删除或覆盖。后续维护使用正常提交追加历史，不重新初始化、清空或改写远端历史。

## 克隆后的区别

源码启动用 `npm start`；桌面版先安装构建依赖并运行 `npm run portable`。克隆不会带回本机密钥、旧历史或 exe，必须自行配置。Windows 桌面运行环境与未验证项见 [portable](portable.md)。

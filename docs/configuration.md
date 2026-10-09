# Configuration · 本地配置

## 配置优先级

已存在的进程环境变量 > 根目录 `.env` > 原有 `Image_key.txt`（端点与密钥）> 默认值。Node.js 使用原生 loadEnvFile，不需要 dotenv。

`Image_key.txt` 支持当前两行格式（HTTP(S) 端点 + Key）、sk- 格式和 `API_KEY=...` 格式。不读取该文件到网页，不在示例里放真实凭据。

可选变量：

| 变量 | 用途 | 默认 |
| --- | --- | --- |
| IMAGE2_BASE_URL | 服务商基础地址 | 从 Image_key.txt 读取 |
| IMAGE2_API_KEY | 服务商 Key | 从 Image_key.txt 读取 |
| IMAGE2_MODEL | 优先选择的真实模型 ID | 返回的第一个生图模型 |
| IMAGE2_TIMEOUT | 生成请求超时秒数，10 到 1800 | 900 |
| PORT | 本地监听端口 | 4317 |

PORT 适用于源码/旧便携服务。WebView2 桌面壳为自己的隐藏服务选择空闲临时端口，不需要手动设置。连接参数与密钥仍按原优先级读取。

若要更改，参照根目录 [.env.example](../.env.example) 在本地创建 `.env`，不要提交真实 `.env`。修改端点、Key、端口、超时或 studio.json 后重启服务。

## 非敏感配置

[studio.json](../config/studio.json) 管理尺寸、默认尺寸、单次图片上限、提示词长度、队列上限和模板。当前保守地只允许一次 1 张。模板只有文本，无第三方图片或远端字体。

高级质量选项只做协议传参，不保证此服务商每个模型支持。未验证的横图、竖图、自动尺寸、高质量等可能返回参数错误或有不同费用，见 [verification](verification.md)。

## 排障

- 桌面版无法启动：检查 WebView2 Runtime、目录写入权限和 `.data/desktop.log`、`.data/portable.log`。无需安装 Node；不强制覆盖密钥。
- 源码版无法启动：检查 Node >=22、端口占用、`.data/server-error.log`。
- 无模型：刷新连接，检查服务商 Key 分组或额度；不要打印 Key 检查。
- HTTP 401/403：核对本地 Key 和服务商授权，不继续重试。
- 参数错误：回到默认尺寸/质量前先检查远端原请求是否计费；本项目不会自动替你再发一次。
- 页面提示 token 失效：刷新连接或刷新页面（服务重启后 token 会变化）。
- 超时或 interrupted：可能已计费，先查服务商记录，不能假定没有生成。

桌面版重复启动只唤起同目录窗口，关闭窗口时确认任务完成再停止自己的服务。Stop Studio.cmd 保留用于旧浏览器版的迁移停止；不要用任务管理器中断正在生成的服务。

## 便携版目录

exe 所在目录就是配置根目录，优先级不变：进程环境变量 > 该目录 `.env` > 该目录 `Image_key.txt`。不要把密钥打进 exe。当前根目录 Image Studio.exe 直接使用原有任务和图片；复制到其他目录则使用该目录的数据。见 [portable](portable.md)。

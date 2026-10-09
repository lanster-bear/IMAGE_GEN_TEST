# API · 接口契约

本地基础地址：`http://127.0.0.1:4317`。所有错误是 `{ "error": "已脱敏的说明" }`。服务仅对本机开放，不是外部托管 API。

上述固定地址只用于源码版。WebView2 桌面版由原生壳选择临时端口，并在启动会话文件中确认服务 PID、端口与本地 token，不公开服务商密钥。

## 本地接口

| 方法和路径 | 用途 |
| --- | --- |
| GET `/api/health` | app、服务状态、PID、未完成任务数量、落盘 busy 状态、本地图片目录 |
| GET `/api/config` | 模型列表、非敏感参数、模板、本地会话 token；从不返回 Key |
| POST `/api/models/refresh` | 重新读取模型，不会生成图片 |
| GET `/api/jobs` | 本地任务历史，按创建时间倒序 |
| GET `/api/jobs/:id` | 查询一个任务 |
| POST `/api/jobs` | 提交任务，返回 202 |
| GET `/outputs/日期/文件.png` | 原始图片；`?download=1` 返回下载头 |
| POST `/api/desktop/stop` | 仅桌面服务启用；带本地 token，忙碌返回 409，空闲时退出服务 |

POST 需要 `Content-Type: application/json` 与 `X-Studio-Token`（值取自 config）。浏览器必须使用本地同源 Origin；CLI 可以不提供 Origin，但必须带 token。

提交示例（参数示意，不含凭据）：

```json
{
  "requestId": "00000000-0000-4000-8000-000000000001",
  "prompt": "清晨的湖泊，自然光，无文字",
  "model": "exact-model-id-from-config",
  "size": "1024x1024",
  "quality": "auto",
  "n": 1
}
```

requestId 可省略（服务端生成）；需要防重复时使用 UUID v4。相同 ID、相同参数返回同一任务，不触发第二次调用；参数不同返回 409。任务字段含 id/prompt/model/size/quality/n/status/createdAt/images，终态带 finishedAt/elapsedMs，失败带 error。

## 服务商协议

- GET `{base}/models`，筛选生图模型，使用真实返回 ID。
- POST `{base}/images/generations`，JSON 发送 model、prompt、size、n。
- quality=`auto` 时不发送质量参数，使用服务商默认；其它值按原值发送。
- 支持 `data[].b64_json`、`data[].url` 以及常见 output/images/result 嵌套字段。
- API 根地址自动统一为带 `/v1` 的基础地址；非根自定义路径请先验证，不自动试探其它域名。
- 不依赖服务商异步/批量协议，不通过 GET 失败去推断未计费，不自动重试 POST。

标准尺寸与质量的兼容性必须按模型实测。本地提供选项，不会静默更换参数或模型来绕过错误。

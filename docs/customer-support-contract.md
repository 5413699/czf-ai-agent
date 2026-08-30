# 时栈小助手统一接口契约（初稿）

## 1. 边界

前端只调用统一客服接口，不传知识库 ID、模型、供应商、检索策略或调试开关。知识检索、RAG、内容安全和模型调用全部由后端负责。后端只允许返回可面向用户的信息；来源只有在明确标记为 `public: true` 时才会显示。

## 2. 请求

`POST /api/customer-support/conversations/messages`

```json
{
  "conversationId": "support-conversation-uuid",
  "messageId": "support-user-uuid",
  "question": "如何创建项目和任务？"
}
```

请求头：`Content-Type: application/json`、`Accept: text/event-stream`。

## 3. SSE 事件

每个事件使用标准 SSE 帧，即 `data: <JSON>\n\n`。首期按连接内顺序处理：

```text
start -> delta (0..n) -> complete | refusal | error
```

```json
{"type":"start","requestId":"request-uuid","conversationId":"conversation-uuid","messageId":"message-uuid"}
{"type":"delta","text":"进入专注页面，"}
{"type":"delta","text":"点击开始专注。"}
{"type":"complete","outcome":"answered","sources":[{"name":"公开使用指南","url":"https://example.com/help","public":true}]}
```

终止事件：

```json
{"type":"complete","outcome":"empty","sources":[]}
{"type":"refusal","reason":"safety"}
{"type":"error","code":"unavailable","message":"optional public message"}
{"type":"error","code":"timeout"}
{"type":"error","code":"internal"}
```

前端仅使用上述字段。非公开来源、知识库类型、切片、向量、内部文档地址和调试信息会被忽略。来源 URL 必须是 HTTP(S)。回答文本按不可信纯文本显示，不能返回或要求前端执行 HTML。

## 4. 中止与幂等

用户点击“停止生成”时，前端会中止 Fetch。后端应监听客户端断开并尽快取消下游生成。`messageId` 用于幂等：同一会话内收到重复 ID 时，后端不应创建两轮用户消息。

## 5. 后端状态建议

- HTTP 401/403：未来登录与权限；首期前端统一呈现服务不可用。
- HTTP 408/504 或 SSE `timeout`：超时，可重试。
- HTTP 429/5xx 或 SSE `unavailable`：暂时不可用，可重试。
- 安全策略拒绝必须使用 `refusal`，不要伪装成空结果。
- RAG 没有可靠资料时使用 `complete/outcome=empty`，不要让模型猜测。

# 番茄小助手前端接入说明

## 本地体验

复制 `.env.example` 为 `.env.local`，保持：

```text
VITE_CUSTOMER_SUPPORT_MODE=mock
```

运行 `pnpm dev` 后，右下角入口可独立完成流式 Mock 对话，不需要启动后端。Mock 支持三个开发触发词：`[模拟断网]`、`[模拟超时]`、`[模拟拒绝]`。

## 联调后端

启动 Spring Boot（默认 `http://localhost:8123`），再将 `.env.local` 改为：

```text
VITE_CUSTOMER_SUPPORT_MODE=api
```

开发环境的 Vite 会把 `/api` 代理到 Spring Boot。部署时可通过 `VITE_API_BASE_URL` 指定公开 API 源站，浏览器端不要配置模型密钥、知识库 ID 或供应商参数。

## 代码位置

- `src/domain/customer-support.ts`：前后端公开类型。
- `src/infrastructure/http/customer-support-api.ts`：SSE 客户端与响应校验。
- `src/infrastructure/http/customer-support-mock.ts`：可独立运行的 Mock 流。
- `src/features/customer-support/customer-support-store.ts`：单浏览器会话状态。
- `src/components/customer-support/CustomerSupportWidget.tsx`：全局入口与响应式会话界面。

客服组件由 `AppShell` 懒加载，打开或关闭不会触发路由变化。浏览器仅持久化 `conversationId` 和消息；刷新时未完成的流会标记为已停止。沉浸计时模式通过 `html[data-immersive='true']` 隐藏整个入口。

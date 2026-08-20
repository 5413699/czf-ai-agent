# 项目阅读指南

这是一份面向学习者的代码阅读路线。当前仓库把可离线运行的学习进度前端和 Spring Boot 后端放在同一个工程中；前端已经完成 React + TypeScript + Vite 的基础重构，后端 AI 接口仍处于逐步接入阶段。

## 1. 先看什么

建议按下面顺序阅读，先建立“启动入口—页面—状态—领域逻辑—基础设施”的地图，再深入某一项功能：

1. `frontend/package.json`：依赖和可执行脚本。
2. `frontend/src/main.tsx`：React 根节点、路由容器、Query 客户端和错误边界。
3. `frontend/src/App.tsx`：页面路由和懒加载。
4. `frontend/src/app/AppShell.tsx`：统一导航、主题切换、移动端导航。
5. `frontend/src/domain/models.ts` 与 `frontend/src/domain/defaults.ts`：数据契约和默认数据。
6. `frontend/src/features/workspace/workspace-store.ts`、`frontend/src/features/preferences/preferences-store.ts`：本地状态和持久化。
7. `frontend/src/pages/FocusPage.tsx`、`TasksPage.tsx`、`AiStudioPage.tsx`：用户流程如何组合领域能力。
8. `frontend/src/features/timer/timer-engine.ts`、`soundscape/soundscape-service.ts`：计时和音频的副作用边界。
9. `frontend/src/infrastructure/http/*`、`infrastructure/backup/backup-service.ts`：网络与备份适配层。

## 2. 目录结构

```text
frontend/
  public/assets/       静态图片、SVG、音乐和环境音
  src/
    app/               应用壳、错误边界、全局装配
    components/        可复用展示组件
    domain/            纯类型、默认值和领域模型
    features/          按业务能力组织的状态与服务
      timer/           计时引擎
      soundscape/      背景音、环境音和提示音
      workspace/       项目、任务、专注记录
      preferences/     主题、方案和直播显示偏好
    infrastructure/   HTTP、SSE、备份、IndexedDB 等外部适配
    pages/             路由页面
    shared/            日期、ID 等无业务偏好的小工具
```

根目录的 `frontend-legacy/` 是迁移期间保留的旧实现，不是新应用的入口。新代码的文件和目录使用英文；界面文案仍然是中文。

## 3. 启动和渲染链路

`main.tsx` 创建 `QueryClient`，再包裹 `HashRouter` 和 `AppErrorBoundary`。`App.tsx` 使用 `lazy` 加载五个页面，因此首屏不必立即下载全部页面代码。`AppShell` 负责稳定的布局和主题数据属性，页面只关心自己的业务内容。

这套分层的原因是：路由变化不应该重建全局状态；网络缓存不应该混进计时器；一个页面崩溃时也应该显示可恢复的错误界面。

## 4. 状态与数据流

工作区数据由 `useWorkspaceStore` 管理，包含 `projects` 和 `focusRecords`。项目下嵌套任务、子任务和知识链接；专注完成后写入 `FocusRecord`，再由 store 重建任务和子任务的番茄进度。`preferredFocusPresetId` 为空表示项目跟随当前方案。

偏好由 `usePreferencesStore` 管理，包括主题、方案顺序、音频顺序、沉浸/直播显示选项。两个 store 使用 Zustand `persist` 写入浏览器本地存储，所以关闭浏览器后数据仍然存在，但当前还没有登录和云端同步。

页面通常遵循这个方向：

```text
用户操作 -> 页面事件处理 -> Zustand action -> 持久化状态
                                      -> timer/soundscape 副作用
页面读取 Zustand snapshot ------------------------------^
```

`@tanstack/react-query` 已在应用根部装配，适合未来缓存后端报告、任务拆解结果和登录后的云端数据；本地状态不要为了“看起来统一”全部改成 Query。

## 5. 计时器怎么工作

`frontend/src/features/timer/timer-engine.ts` 是纯 UI 之外的计时核心。它维护 `idle / running / paused / waiting` 状态、当前阶段、轮次、开始/结束时间和高精度剩余毫秒数。界面显示整秒，但进度比例使用毫秒计算，所以环形或番茄蓄能动画不会一格一格跳动。

核心流程是：

1. 页面选择方案和项目，生成 `TimerSettings` 与 `FocusAssignment`。
2. `start()` 记录阶段结束时间，并通知 soundscape 播放对应音频。
3. `tick` 根据当前时间计算 `remainingMs` 和 `progress`，而不是每秒减一。
4. 阶段结束写入专注记录；自动循环时进入休息或下一轮专注。
5. 项目偏好方案在空闲时立即应用；运行或暂停时只作为待应用设置，在下一次阶段切换前生效。

计时器与页面解耦，便于未来把同一引擎用于沉浸模式、PWA 后台恢复或测试环境。

## 6. 音频边界

`soundscape-service.ts` 同时管理背景音乐和环境音，但两者是独立的 HTMLAudioElement：背景音乐使用原生 `loop`，不做交叉淡化，避免长音乐在循环点被压缩或失真；环境音使用本地生成的长版本 M4A，并按同一播放器原生循环。提示音在阶段开始/结束时单独播放。

`soundscape/catalog.ts` 只保存可展示的名称、描述、图标和静态资源路径；上传的自定义音频和图标由 IndexedDB 媒体仓库保存。不要把二进制文件塞进 Zustand 或 React props。

Vite PWA 配置故意不预缓存大音频，而是在运行时使用 CacheFirst 和 Range Requests 按需缓存。这样首屏更快，也不会把几百 MB 音频强行塞进安装包。

## 7. AI 功能与 HTTP 边界

`frontend/src/infrastructure/http/ai-api.ts` 定义番茄任务拆解请求，默认地址是 `/api/tomato-assistant/plans`，请求契约为：

```json
{
  "goal": "准备 Spring AI RAG 分享",
  "context": "本周有三个晚上，每次专注 25 分钟",
  "pomodoroMinutes": 25,
  "chatId": "uuid"
}
```

`http-client.ts` 统一处理 JSON、错误状态和 `VITE_API_BASE_URL`；`sse.ts` 解析标准 SSE 帧，并支持 token、工具调用和 artifact 等事件类型。AI 页面只负责表单、加载态和结果展示，不直接拼接 `fetch` 细节。

AI 拆解页有两种模式。直接拆解调用 `/api/tomato-assistant/plans`，对应 Spring AI 的结构化输出；Agent 梳理先调用 `/api/tomato-assistant/agent/runs` 创建带 Loop、模型、调度和能力快照的运行，再通过 Run 下的 `/resources` 上传文档、图片和文件夹，通过 `/messages` 发送对话、链接和启用的 Skill/MCP/Tool。Agent 只有在后端返回 `readiness=ready` 和标准化 `planRequest` 后，才允许继续调用 plans 接口。

Agent 工作台沿用直接拆解页相同的左右比例：左侧管理番茄节奏、运行配置、记忆与上下文，右侧是主要对话画布；需求画像、最终计划和运行轨迹是按需展开的紧凑辅助视图。自定义 Loop、模型、调度、Skill、MCP 和 Tool 可以从 JSON 清单导入、手动创建和删除，平台预设保持只读。当前浏览器只保存非敏感配置元数据，模型密钥和真正的长期记忆必须由后端负责。

`components/ai-workspace/AgentToolbox.tsx` 负责资料和能力选择，`AgentRuntimeConfig.tsx` 负责 Loop、模型和调度配置，`infrastructure/http/ai-api.ts` 负责请求与 Zod 响应校验。当前运行轨迹是前端会话内的预览；跨设备 Run 历史、回放、分叉以及 Memory、RAG、工具调用、MCP、Skills 插件执行仍属于后端待开发能力，界面不会把“已选择”误写成“已执行”。

当前后端尚未实现 plans 和 agent Controller，因此请求会得到 404；这不是前端静默失败，而是联调阶段必须先补齐的后端工作。同步结构化输出和 SSE 流式输出也应保持清晰的两个用例。

## 8. 备份与本地数据

`frontend/src/infrastructure/backup/backup-service.ts` 用 Zod 校验新版备份包，内容包括 workspace、preferences 和 IndexedDB 中的自定义媒体。导入前会验证 schema、媒体类型和大小，再替换本地数据。清空数据会停止计时和音频，重置两个 store，清理自定义媒体和 PWA 缓存。

当前按项目约定只支持新版备份包，不承诺旧 JSON 数组兼容。未来登录后云端同步应新增独立 repository/API 层，不要直接把远端请求写进页面组件。

## 9. 常见改动方式

- 新字段：先改 `domain/models.ts`，再改默认值、Zod 备份 schema、store action 和使用它的页面。
- 新页面：在 `pages/` 新建组件和 CSS Module，在 `App.tsx` 添加 lazy route，并检查移动端导航。
- 新音频：先放入 `public/assets` 或 IndexedDB 媒体仓库，再更新 catalog；不要在组件内硬编码大量路径。
- 新后端请求：在 `infrastructure/http` 建 API 函数和类型，页面通过 TanStack Query 或显式 mutation 调用。
- 计时行为：优先修改 timer-engine 的状态转换，再补页面按钮；不要用页面 `setInterval` 复制一份倒计时。

## 10. 已完成与待开发

已完成的前端基础包括：React/Vite/TypeScript 工程、响应式页面、Zustand 本地工作区、方案/任务/专注记录、音频独立播放、备份包、PWA、HTTP/SSE 客户端骨架和 AI 拆解页面。

明确待开发的后端能力包括：真正的 `/api/tomato-assistant/plans` 与 `/api/tomato-assistant/agent/*` Controller、DTO 校验、Spring AI 结构化输出、持久化 ChatMemory、资源解析、SSE Controller、登录与云端配置加载、PostgreSQL/pgvector RAG、Tool Calling、MCP、Skills 插件注册、ReAct Agent 和第三方搜索/图片接口。

阅读或修改代码时，请先确认需求属于哪一层。把后端凭据、数据库连接或音频副作用放进页面，会让后续联调和维护成本快速上升。

# 后端与 AI 联调指南

这份文档以当前仓库的真实代码为起点，目标是帮助学习者把本地前端逐步接到 Java 21 + Spring Boot 3 的 AI 服务。先做最小可用链路，再逐步加入结构化输出、记忆、RAG、工具和 Agent，避免一次引入所有概念。

## 1. 当前状态与边界

后端使用 Java 21、Spring Boot 3.4.4，端口是 `8123`，`server.servlet.context-path` 是 `/api`。因此健康检查完整地址为 `GET http://localhost:8123/api/health`。

当前后端只有 `/api/health` 真正的 Controller。`TomatoAssistantApp` 已经具备同步 Spring AI `ChatClient` 调用和内存 `ChatMemory` 示例，但尚未暴露 `/api/tomato-assistant/plans` HTTP 接口。前端已经把该路径作为默认 AI endpoint，所以在 Controller 完成前联调得到 404 是预期现象。

主实现路线建议选 Spring AI：它与现有 `ChatClient`、Advisor、Spring Boot 自动配置和未来 SSE/RAG 集成一致。LangChain4j 可以作为对照学习或独立实验，但不要把同一个请求链路混合成两套调用框架，否则依赖、异常、记忆和流式语义会重复。

## 2. 一次请求应该经过什么层

```text
React 表单
  -> POST /api/tomato-assistant/plans
  -> Controller: HTTP、校验、状态码
  -> Service: 业务规则、prompt 参数、领域转换
  -> ChatClient: Prompt + ChatMemory + 模型调用
  -> 结构化输出 TomatoTaskPlan
  -> Response DTO
  -> 前端展示计划并可导入本地任务
```

Controller 不应该持有 prompt 拼接细节，Service 也不要直接读取浏览器 localStorage。这样未来加入登录、数据库或 SSE 时，只需替换相应适配层。

## 3. 第一个可运行切片：DTO 和 Controller

下面是“待实现骨架”，不是当前已有代码。它先把 HTTP 契约固定下来，再接入 AI：

```java
public record TomatoPlanRequest(
        @NotBlank String goal,
        String context,
        @Min(5) @Max(120) int pomodoroMinutes,
        @NotBlank String chatId
) {}
```

```java
@RestController
@RequestMapping("/tomato-assistant")
@RequiredArgsConstructor
public class TomatoAssistantController {
    private final TomatoAssistantService service;

    @PostMapping("/plans")
    public TomatoPlanResponse create(
            @Valid @RequestBody TomatoPlanRequest request) {
        return service.createPlan(request);
    }
}
```

因为应用已经配置 `/api` context path，Controller 上写 `/tomato-assistant`，外部访问就是 `/api/tomato-assistant/plans`。不要再在 `@RequestMapping` 里重复写 `/api`。

建议响应 DTO 与前端的 `AiPlanResponse` 对齐：包含 `requestId`、`chatId`、`pomodoroMinutes` 和 `plan`。错误统一返回可读的 JSON（例如 `code`、`message`、`traceId`），不要把模型原始异常直接暴露给用户。

## 4. 两种 AI 模式与 Agent 预留接口

前端现在明确区分两条链路：

| 模式 | 当前前端入口 | 后端职责 |
| --- | --- | --- |
| 直接拆解 | 填写目标、背景和番茄方案后点击“开始拆解” | Spring AI 结构化输出，直接返回 `TomatoTaskPlan` |
| Agent 梳理 | 多轮对话、资料附件、Skill/MCP/Tool 选择 | 后续 Agent 编排；当前先实现 DTO 和占位接口，不应伪造 RAG、工具或 MCP 已执行 |

Agent 首先创建一次可追踪运行：

```text
POST /api/tomato-assistant/agent/runs
```

请求包含 `clientRunId`、运行配置快照和启用能力。运行配置由 `loop`、`model`、`scheduler` 三个插件选择组成，每项包含 `id`、`name`、`source` 和非敏感 `configuration`。后端返回稳定的 `runId`、`chatId`、状态和创建时间。模型 API Key 不得出现在该请求中；登录后的平台模型权限、自带模型凭据和计费应由后端鉴权与密钥管理实现。

Agent 资源随后通过 multipart 上传：

```text
POST /api/tomato-assistant/agent/runs/{runId}/resources
Content-Type: multipart/form-data

chatId=<uuid>
files=<一个或多个文件>
paths=<文件夹中的相对路径>
```

返回 `requestId`、`chatId` 和资源引用数组。后端必须校验文件大小、MIME、扩展名和解压路径，原始文件应进入对象存储或受控临时目录；不要允许模型直接读取服务器任意路径。

每轮 Agent 对话使用：

```json
{
  "chatId": "uuid",
  "message": "我需要在本周完成 RAG 演示",
  "pomodoroMinutes": 25,
  "resourceIds": ["resource-id"],
  "links": ["https://example.com/context"],
  "capabilities": [
    {
      "id": "skill-requirement-interview",
      "kind": "skill",
      "name": "需求访谈",
      "source": "preset"
    }
  ]
}
```

地址为 `POST /api/tomato-assistant/agent/runs/{runId}/messages`。每轮响应包含 `runId`、助手回复、结构化收集结果、缺失字段、`readiness`，以及准备就绪时的 `planRequest`：

```java
public record AgentTurnResponse(
        String requestId,
        String runId,
        String chatId,
        String assistantMessage,
        Readiness readiness,
        AgentCollectedInfo collected,
        List<String> missingFields,
        AgentPlanRequest planRequest
) {}
```

只有 `readiness == READY` 且 `planRequest` 非空时，前端才显示“现在进行拆解”。点击后仍调用 `/tomato-assistant/plans`，把“梳理需求”和“生成结构化计划”保持为两个可测试用例。

为了让每次运行都可追溯，后端应使用追加式事件表或事件流记录配置快照、系统 Prompt、用户输入、资源注入、模型输出、工具调用与结果、子 Agent 调度、错误和最终计划。建议预留：

```text
GET /api/tomato-assistant/agent/runs
GET /api/tomato-assistant/agent/runs/{runId}
GET /api/tomato-assistant/agent/runs/{runId}/events
POST /api/tomato-assistant/agent/runs/{runId}/cancel
POST /api/tomato-assistant/agent/runs/{runId}/fork
```

事件只能追加，不能为了“更新状态”覆盖历史事实；运行汇总状态可以单独投影。这样后续才能实现搜索、回放、继续运行和从任一节点分叉。当前前端先展示当前 Run 的本地轨迹预览，真正的跨设备历史需要登录和后端持久化。

后期可在 Agent Service 内逐层接入持久化 Memory、RAG、Tool Calling、MCP 和 Skills 插件注册表。自定义 Skill/MCP/Tool 必须经过用户权限、服务地址白名单、超时、审计和工具参数校验；前端传来的 capability 只能表达用户选择，不能直接授权执行危险工具。

前端允许用户创建、导入和删除自定义 Loop、模型、调度、Skill、MCP 与 Tool。运行配置清单使用下面的 JSON 形状：

```json
{
  "kind": "loop",
  "id": "interview-sprint",
  "name": "面试冲刺 Loop",
  "description": "优先收敛可以演示的成果",
  "configuration": {
    "pluginId": "interview-sprint"
  }
}
```

能力清单使用 `kind: skill | mcp | tool`，并包含 `id`、`name` 和 `description`。这些文件当前只导入非敏感元数据，删除也只影响浏览器中的用户配置。后端接入后必须把所有自定义 ID 视为不可信引用，通过登录用户的插件注册表解析；不得把前端传入的地址、命令或工具名直接当作执行授权。

## 5. Service 与结构化输出

当前 `TomatoAssistantApp#doChat` 使用 `.chatResponse()` 取字符串。结构化输出阶段应新增 Service，并让模型直接映射到 record：

```java
@Service
@RequiredArgsConstructor
public class TomatoAssistantService {
    private final ChatClient chatClient;

    public TomatoPlanResponse createPlan(TomatoPlanRequest request) {
        TomatoTaskPlan plan = chatClient.prompt()
                .user(user -> user.text("目标：{goal}\n背景：{context}\n每个番茄：{minutes} 分钟")
                        .param("goal", request.goal())
                        .param("context", Objects.toString(request.context(), ""))
                        .param("minutes", request.pomodoroMinutes()))
                .advisors(spec -> spec.param(ChatMemory.CONVERSATION_ID, request.chatId()))
                .call()
                .entity(TomatoTaskPlan.class);
        return TomatoPlanResponse.from(request, plan);
    }
}
```

这里的 `.entity()` 是后续待实现示例；当前代码实际使用 `.chatResponse()` 返回字符串。生产实现还应配置模型支持的 JSON schema/结构化输出，并对 `estimatedMinutes`、`pomodoroCount` 做服务端二次校验，不能完全信任模型。

## 6. Prompt 模板为什么独立

当前系统提示词位于 `src/main/resources/prompts/tomato-assistant.md`，并由 `application.yml` 中的 `ai.prompts.tomato-assistant.location` 加载。把角色、输出格式、拆解原则放在资源文件，业务代码只传入目标和背景，便于版本管理、评审和 A/B 测试。

推荐 Prompt 明确要求每个步骤包含：行动、产出、完成标准、预计分钟数和番茄数量；目标清楚时直接拆解，目标含糊时先提出少量澄清问题。模型输出后仍需 Java 校验和归一化。

## 7. ChatMemory：先内存，后持久化

当前 `TomatoAssistantApp` 使用 `InMemoryChatMemoryRepository` + `MessageWindowChatMemory(maxMessages=20)`，适合本地演示，不适合重启后保留会话，也不适合多实例部署。

迁移步骤：

1. 保留 `ChatMemory` 抽象和 `chatId` 作为 conversation id。
2. 设计 `conversation`、`conversation_message` 表，记录用户、助手、时间和序号。
3. 实现持久化 `ChatMemoryRepository`，或使用 Spring AI 提供的 JDBC/Redis 方案。
4. 为用户 ID 建索引，并限制单会话窗口，防止每次请求 token 无限增长。
5. 测试并发请求、删除会话和数据隔离。

登录和云端配置加载属于后续目标，不应在当前本地前端里伪造登录成功。未来 repository 可以做成官方云存储与用户自带 S3 的可替换实现。

## 8. SSE 流式输出

前端 `frontend/src/infrastructure/http/sse.ts` 已支持标准 SSE 解析，事件可包括 `meta`、`token`、`tool-call`、`tool-result`、`artifact`、`done`、`error`。后端可按以下方向实现（待开发）：

```java
@PostMapping(value = "/plans/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public Flux<ServerSentEvent<AssistantEvent>> stream(
        @Valid @RequestBody TomatoPlanRequest request) {
    return service.streamPlan(request)
            .map(event -> ServerSentEvent.builder(event).event(event.type()).build());
}
```

SSE 不是 WebSocket：它是客户端发起 HTTP 请求、服务端持续写事件。要处理断线、代理缓冲、心跳和取消订阅；`done` 事件后再关闭流。不要把模型内部 token 直接拼成可执行 HTML。

## 9. RAG 与 pgvector 路线

RAG 的核心不是“把所有文档塞进 prompt”，而是：收集文档 -> 清洗切割 -> embedding -> 向量存储 -> 查询相似片段 -> 拼入上下文 -> 生成回答。

建议分阶段：

1. 先用本地 Markdown 知识库验证 ETL 和检索结果。
2. 使用 PostgreSQL + pgvector 保存 embedding、原文片段、来源和权限字段。
3. 增加 metadata filter（用户、课程、项目、文档版本）。
4. 调整 chunk 大小、top-k、相似度阈值和查询增强器。
5. 记录命中文档，回答中展示引用，降低幻觉。

向量库 schema 需要保留原文和来源，不能只存向量。生产环境要为 embedding 模型版本、重建索引和删除文档设计运维命令。

## 10. Tool Calling、MCP 与 ReAct

Tool Calling 适合让模型请求明确的后端函数，例如查询用户任务、统计本周专注时长、创建拆解后的项目。工具参数必须使用强类型 DTO，并做权限、范围和幂等校验；模型只能提出调用，真正执行仍由服务端决定。

MCP 是工具与资源的标准协议。学习顺序建议是：先调用一个本地 MCP server，再理解 Spring AI MCP client/server 模式，最后部署带鉴权和审计的图片搜索或知识库 MCP。不要为了一个简单方法过早引入 MCP。

ReAct Agent 是“思考/行动/观察”的循环。实现时限制最大步数、总耗时和工具白名单，并保留每一步 trace。番茄任务拆解首先是结构化单次调用，只有在需要检索、日程查询和多工具协作时才升级为 Agent。

## 11. 第三方接口与多模态

SearchAPI、Pexels 等接口应由后端代理，密钥放环境变量或密钥管理系统，前端只拿到清洗后的结果。对超时、配额、重试和来源链接做统一封装。

多模态阶段可先支持图片作为任务背景或知识库文档，再扩展 OCR、图片搜索和图文 prompt。上传大小、MIME 类型和内容安全必须在 Controller 层校验。

## 12. CORS 与前端联调

开发时 Vite 将 `/api` 代理到 `http://localhost:8123`，因此浏览器访问前端 `http://127.0.0.1:4173` 时可以使用同源相对路径。若前后端分域部署，再配置 Spring CORS，只允许明确的前端 origin，不要直接 `*` 配合凭据。

联调顺序：

1. 启动后端，确认 `/api/health` 返回 `ok`。
2. 补齐 `/api/tomato-assistant/plans` Controller，用固定假数据先验证 HTTP。
3. 用浏览器 Network 检查请求 JSON、状态码和响应结构。
4. 接入 Spring AI 同步结构化输出。
5. 再接 `/plans/stream`，验证断线和取消。

## 13. 测试策略

- DTO：校验空目标、5/120 边界和非法分钟数。
- Controller：MockMvc 验证路径、状态码、错误 JSON 和 CORS。
- Service：mock `ChatClient`，验证 prompt 参数、chatId 和结构化映射。
- Prompt：固定输入做回归样例，检查字段完整性和数量范围。
- RAG：用小型固定文档集评估命中率与引用准确性。
- SSE：测试事件顺序 `meta -> token/tool -> done` 和错误事件。
- 浏览器：检查移动端表单、加载态、404/500 提示和结果导入任务。

模型调用测试应使用可控的 fake client；真实模型测试是有成本且可能不稳定的集成测试，单独标记并限制频率。

## 14. 分阶段路线

**阶段一：HTTP 最小闭环**：DTO、Controller、固定响应、CORS、MockMvc 和前端错误态。

**阶段二：Spring AI 结构化输出**：Prompt 模板、`TomatoTaskPlan`、字段校验、请求日志与 traceId。

**阶段三：记忆和报告**：持久化 ChatMemory，基于专注记录生成每周结构化报告。

**阶段四：RAG**：本地知识库、embedding、pgvector、检索引用和调优。

**阶段五：工具与 Agent**：任务统计工具、联网搜索、MCP、受限 ReAct 工作流。

**阶段六：服务化**：SSE、鉴权、限流、监控、Serverless 计算和云端/S3 可插拔存储。

每完成一个阶段都要保留前一阶段的可运行验收，不要让“引入新 AI 能力”破坏本地番茄钟。

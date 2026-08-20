# 部署与联调指南

本文面向第一次部署本项目的开发者。当前仓库包含一个 Vite + React 前端和一个 Java 21 + Spring Boot 后端；前端可以单独离线使用，AI 拆解功能则需要后端接口。

## 1. 运行前检查

请准备以下环境：

- Node.js 20 或更高版本，以及 `pnpm`。
- JDK 21，Maven Wrapper 已随仓库提供（Windows 使用 `mvnw.cmd`）。
- 可选：PostgreSQL 16+。当前代码还没有启用数据库，数据库属于后续持久化阶段。

先确认版本：

```powershell
node --version
pnpm --version
java --version
.\mvnw.cmd --version
```

不要把 API Key 写入源码或提交到 Git。使用本地环境变量或未提交的 `application-local.yml`。

## 2. 本地启动前端

```powershell
Set-Location E:\a_learning\czf-ai-agent\frontend
pnpm install
pnpm dev
```

浏览器访问 `http://127.0.0.1:4173/#/focus`。Vite 配置中的开发代理为：

| 前缀   | 目标                    |
| ------ | ----------------------- |
| `/api` | `http://localhost:8123` |

前端配置位于 `frontend/vite.config.ts`，开发服务和预览服务都固定使用 `127.0.0.1:4173`。如果该端口已被占用，应修改配置中的 `port`，并同步更新浏览器源地址。

生产构建和本地预览：

```powershell
Set-Location E:\a_learning\czf-ai-agent\frontend
pnpm typecheck
pnpm lint
pnpm build
pnpm preview
```

`pnpm build` 生成 `frontend/dist`。预览服务不会替代后端；要测试 AI 请求，后端仍需单独启动，或者由 Nginx 反向代理。

## 3. 本地启动 Spring Boot

在仓库根目录执行：

```powershell
Set-Location E:\a_learning\czf-ai-agent
.\mvnw.cmd spring-boot:run
```

打包并运行：

```powershell
.\mvnw.cmd clean package -DskipTests
java -jar target\czf-ai-agent-0.0.1-SNAPSHOT.jar
```

实际配置在 `src/main/resources/application.yml`：

- `server.port: 8123`
- `server.servlet.context-path: /api`
- 激活配置文件：`local`

因此健康检查完整地址是 `http://localhost:8123/api/health`。它返回纯文本 `ok`。

### 当前后端边界

当前后端只有 `/api/health` 真正的 Controller。`TomatoAssistantApp` 已经具备同步 Spring AI `ChatClient` 调用和内存 `ChatMemory` 示例，但尚未暴露 `/api/tomato-assistant/plans` HTTP 接口。

前端 `frontend/src/infrastructure/http/ai-api.ts` 将 AI 地址固定为：

```text
/api/tomato-assistant/plans
```

在后端 Controller 完成前，调用该功能得到 HTTP 404 是预期现象，不是 Vite 代理故障。建议先用健康检查验证网络，再实现 Controller，最后进行 AI 联调。

## 4. 环境变量与密钥

推荐为后端创建未纳入 Git 的 `src/main/resources/application-local.yml`，或直接设置环境变量。变量名应与后续 Spring AI 配置保持一致，例如：

```powershell
$env:DASHSCOPE_API_KEY = 'your-key'
$env:OPENAI_API_KEY = 'your-key'
.\mvnw.cmd spring-boot:run
```

前端暂时没有内置密钥。若未来需要 Vite 环境变量，只使用 `VITE_` 前缀，并且只放公开配置（接口地址、功能开关）；任何模型密钥都必须留在后端。

生产环境建议使用系统密钥管理器或 CI Secret，禁止把 `.env`、`application-local.yml`、Token 和数据库密码加入提交。

## 5. Nginx 部署前端与 `/api` 反代

构建前端后，将 `frontend/dist` 上传到例如 `/srv/tomato-study-room/frontend`。Nginx 示例：

```nginx
server {
    listen 80;
    server_name study.example.com;
    root /srv/tomato-study-room/frontend;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8123/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```

`proxy_pass` 末尾的 `/api/` 很重要：后端本身已经配置了 `/api` context path，生产环境应确认实际路径不会重复成 `/api/api`。上线前用 `curl` 验证：

```bash
curl -i https://study.example.com/api/health
```

## 6. HTTPS

生产环境应使用可信 CA 证书（例如 Let's Encrypt），并将 HTTP 重定向到 HTTPS。启用 HSTS 前先确认所有静态资源和接口都能通过 HTTPS 加载，否则浏览器会拦截混合内容。SSE 接口上线后，Nginx 需要关闭该 location 的响应缓冲：

```nginx
location /api/tomato-assistant/stream {
    proxy_pass http://127.0.0.1:8123/api/tomato-assistant/stream;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 1h;
}
```

## 7. systemd 运行后端（Linux）

创建 `/etc/systemd/system/tomato-ai.service`：

```ini
[Unit]
Description=Tomato AI Agent
After=network.target

[Service]
User=tomato
WorkingDirectory=/srv/tomato-ai
ExecStart=/usr/bin/java -jar /srv/tomato-ai/czf-ai-agent-0.0.1-SNAPSHOT.jar
EnvironmentFile=/etc/tomato-ai/environment
Restart=on-failure
RestartSec=5
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now tomato-ai
sudo systemctl status tomato-ai
journalctl -u tomato-ai -f
```

`/etc/tomato-ai/environment` 只授予服务用户读取权限，并存放模型和数据库密钥。

## 8. PostgreSQL 与 pgvector（后续阶段）

当前仓库没有 PostgreSQL、JPA 或 pgvector 配置，不能把数据库当作已完成能力。后续接入时建议：

1. 使用独立数据库和最小权限账号。
2. 安装与 PostgreSQL 主版本匹配的 `vector` 扩展。
3. 为文档表保存正文、来源、分块序号、embedding 和 metadata。
4. 通过 Flyway/Liquibase 管理 schema，不手工修改线上表。
5. 对 embedding 维度、距离函数和索引参数做基准测试，再决定 HNSW 或 IVFFlat。

示例初始化（需管理员权限）：

```sql
CREATE DATABASE tomato_ai;
\\c tomato_ai
CREATE EXTENSION IF NOT EXISTS vector;
```

数据库连接信息仍应放在环境变量中。RAG 检索失败时，应允许应用降级为无知识库回答，并在日志中记录原因。

## 9. 日志、备份与回滚

- 生产日志输出到 stdout，由 systemd 或容器采集；不要把日志写入仓库。
- 记录 request id、接口耗时、模型调用耗时和错误类型；不要记录 API Key、完整用户隐私和原始 Token。
- 前端本地数据由应用备份功能导出；上线前应验证导入、导出和清空数据流程。
- 数据库采用每日全量 + WAL/PITR（按业务重要性选择），定期做恢复演练。
- 发布时保留上一份前端 `dist` 和上一版本后端 jar，出现错误可快速切换 Nginx 根目录并重启服务。
- 回滚后检查前后端 API 契约、数据库迁移是否可逆，禁止只回滚 jar 而忽略已执行的破坏性迁移。

## 10. Docker 与 Serverless（可选）

Docker 适合统一开发和部署环境：前端可用 Nginx 镜像托管 `dist`，后端使用 JRE 21 镜像运行 jar，PostgreSQL 单独使用官方镜像并挂载持久卷。镜像中不应复制 `.env` 或本地密钥。

Serverless 适合无状态 HTTP、短时 AI 请求或异步任务。长连接 SSE、音频缓存和本地文件不适合直接依赖短生命周期实例；应把会话、任务和向量数据放到外部持久化服务，并设置超时、重试和幂等键。

## 11. 前后端联调顺序

1. 启动 Spring Boot，访问 `/api/health`。
2. 启动前端 Vite，确认页面静态资源正常。
3. 在浏览器 Network 面板确认请求 URL 是 `/api/...`，而不是把 `localhost:8123` 写死在前端。
4. 先用固定 JSON 响应验证表单、错误态和加载态。
5. 再接入 Spring AI 真实调用，并验证 `chatId` 对话记忆隔离。
6. 最后接入 SSE、数据库和鉴权。

## 12. 上线验收清单

- [ ] `pnpm typecheck`、`pnpm lint`、`pnpm test`、`pnpm build` 通过。
- [ ] 移动端和桌面端均能打开 `/focus`、`/tasks`、`/insights`、`/tutorial`。
- [ ] 极夜、永昼、护眼主题在普通模式和沉浸模式下可切换。
- [ ] 本地数据可导出、恢复；清空数据有二次确认。
- [ ] `https://域名/api/health` 返回 `ok`。
- [ ] AI 接口不再返回 404，并能正确处理 5–120 分钟边界。
- [ ] SSE 不被 Nginx 缓冲，断线能显示明确错误。
- [ ] 模型密钥、数据库密码未出现在 Git、构建产物和浏览器 Network 中。
- [ ] 备份恢复演练成功，回滚版本可启动。

## 13. 常见排错

**页面白屏或刷新 404**：检查 Nginx `try_files ... /index.html`，并确认使用 HashRouter 的 `/#/...` 地址。

**接口连接失败**：确认后端监听 `8123`，访问 `/api/health`；开发环境检查 `frontend/vite.config.ts` 的 proxy，生产环境检查 Nginx `/api/`。

**AI 规划返回 404**：当前后端尚未实现 `/api/tomato-assistant/plans` Controller，这是已知缺口，不是前端表单问题。

**CORS 错误**：优先使用同域 `/api` 反代；若前后端跨域，后端配置明确的生产域名、方法和 Header，禁止使用 `*` 搭配凭据。

**SSE 立即结束或延迟**：检查 Controller 是否返回 `text/event-stream`，Nginx 是否 `proxy_buffering off`，并确认网关超时足够长。

**音频在直播软件中失真**：优先使用 `frontend/public/assets/audio` 中的 M4A 长环境音；背景音乐原生循环，不做交叉淡化；检查浏览器源是否允许自动播放及音量是否被系统混音器压低。

**数据库连接失败**：确认扩展、账号权限、连接池和迁移状态；不要通过删除数据目录来“修复”，先保留日志和备份。

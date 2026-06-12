# ICP Fuzz Web Console（front-Kr-fixed）

本目录是 ICP Fuzz 的 Web 前端与 Web BFF。它不是纯静态 Vite 项目：浏览器只访问本目录提供的 Web BFF，Web BFF 再统一代理到一个或多个 Linux FastAPI 后端节点。

## 项目职责

- React + Vite：构建浏览器控制台页面。
- Fastify BFF：托管 `dist/`，维护统一账户、会话、节点列表、审计日志，并代理节点 API。
- 浏览器安全边界：浏览器只保存 HttpOnly session cookie 与 CSRF cookie，不保存后端节点 secret，不直连后端业务接口。

## 目录结构

```text
server/server.mjs          Fastify Web BFF，负责登录、节点管理、HTTP/WS 节点代理、SPA 托管
src/                       React 页面、组件、状态和 API service
src/lib/api/client.ts      前端 fetch 封装，要求 ApiEnvelope 响应
src/lib/api/url.ts         API/WS URL 收敛层，统一映射到 BFF
src/lib/api/services/      页面调用的业务 API service
docs/                      设计约束、API 契约、安全模型和修复记录
public/                    Vite public 资源
```

运行时目录不会入库：

```text
.bff-data/                 BFF SQLite、会话、节点元数据
dist/                      Vite 构建产物
.tmp-validation/           本地联调日志
.codex-log/                自动化工具日志
```

## 安装依赖

要求 Node.js `>= 22.5.0`。

```bash
npm install
```

建议不要提交 `node_modules/`、`.bff-data/`、`dist/`。`package-lock.json` 应保留，用于 Windows/Linux 复现依赖。

## 开发模式

开发时需要同时启动 BFF 和 Vite。Vite 通过 dev proxy 把 `/web-api`、`/node-api`、`/node-ws`、`/healthz` 转发给 BFF。

终端 1：

```bash
npm run serve
```

终端 2：

```bash
npm run dev
```

浏览器访问：

```text
http://127.0.0.1:5173
```

可通过环境变量修改 Vite 转发目标：

```bash
VITE_BFF_DEV_TARGET=http://127.0.0.1:8080 npm run dev
```

## 生产/正式本地运行

先构建静态资源：

```bash
npm run build
```

再由 BFF 托管 `dist/`：

```bash
npm run serve
```

浏览器访问：

```text
http://127.0.0.1:8080
```

`npm run serve` 现在会正确返回 SPA `index.html`。如果未构建 `dist/`，BFF 会返回明确的 503 提示，而不是 Fastify static 的 403 文本。

## Web BFF 环境变量

```bash
FUZZ_WEB_HOST=127.0.0.1
FUZZ_WEB_PORT=8080
FUZZ_WEB_SESSION_SECRET=replace-with-a-long-random-secret
FUZZ_WEB_BOOTSTRAP_PASSWORD=replace-bootstrap-admin-password
FUZZ_WEB_DATA_DIR=.bff-data
FUZZ_WEB_PROXY_TIMEOUT_MS=120000

# 首次启动且节点表为空时自动创建的默认节点
FUZZ_WEB_DEFAULT_NODE_ID=local
FUZZ_WEB_DEFAULT_NODE_NAME=本机后端
FUZZ_WEB_DEFAULT_NODE_BASE_URL=http://127.0.0.1:18000
FUZZ_WEB_DEFAULT_NODE_SECRET=change-me-node-secret
```

生产环境必须设置强随机 `FUZZ_WEB_SESSION_SECRET`。默认 bootstrap 管理员仅用于本地开发，首次登录后应修改密码或创建新管理员。

## API 与通信方式

浏览器侧固定访问 BFF：

```text
/web-api/*                         BFF 自身控制面，例如登录、用户、节点、仪表盘聚合
/node-api/{nodeId}/api/v1/*        BFF 代理到后端节点 HTTP API
/node-ws/{nodeId}/api/v1/*         BFF 代理到后端节点 WebSocket API
```

前端代码不要再拼接后端节点 `base_url`。统一入口是：

- `src/lib/api/client.ts`
- `src/lib/api/url.ts`
- `src/lib/api/services/*`

## 节点代理安全

BFF 到后端节点的每个业务请求都会注入：

- 短期 HS256 JWT
- `X-ICP-Timestamp`
- `X-ICP-Nonce`
- `X-ICP-Body-SHA256`
- `X-ICP-Signature`

WebSocket 升级请求同样通过 `/node-ws/*` 由 BFF 验证浏览器 session 后再签名转发。浏览器不能也不应该直接连接后端 WebSocket。

## Windows/Linux 注意事项

- Windows PowerShell 运行中文日志时建议使用 UTF-8：`chcp 65001`。
- Windows 与 Linux 都可以运行前端；正式构建产物不依赖平台。
- BFF 使用 Node 22 的 `node:sqlite`，请不要降级到 Node 20 或更低版本。

## 健康检查

```bash
curl http://127.0.0.1:8080/healthz
```

返回字段包括：

- `ok`
- `service`
- `dist_ready`
- `db_path`

## 本次修复重点

- 修复 `npm run serve` 访问 `/` 只显示 403 文本的问题。
- Vite dev server 增加 BFF proxy，避免开发模式 API 404。
- WebSocket 不再直连后端节点，统一走 BFF `/node-ws`。
- 自动初始化默认本机节点，避免依赖被打包进来的 `.bff-data`。
- 下载 URL 统一走 `resolveApiUrl`，支持跨前缀部署。
- 修复 Metrics history 对 `{ job_id, points }` 后端格式的兼容。
- 补充 `.gitignore`，排除运行时数据库、构建产物、日志和本地配置。

更多细节见：`docs/FIX_SUMMARY_2026-06-03.md`。

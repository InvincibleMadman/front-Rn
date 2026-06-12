# Frontend/BFF 修复记录（2026-06-03）

## 修改范围

本次仅修改前端运行、通信和文档层，不改页面组件渲染结构，不重做 UI 视觉：

- `server/server.mjs`
- `src/lib/api/url.ts`
- `src/lib/api/services/jobs.ts`
- `src/lib/api/services/reports.ts`
- `src/lib/api/services/assets.ts`
- `vite.config.ts`
- `.gitignore`
- `README.md`

## 对照 docs 设计要求

已按 `docs/CODEX_AR_API_CONTRACT.md`、`docs/CODEX_AR_SECURITY_MODEL.md`、`docs/CODEX_AR_PRODUCT_SPEC.md` 与 `docs/CODEX_AR_SNIPPETS_FRONTEND.md` 复核：

- 浏览器只访问 Web BFF，不再直接使用后端节点 `base_url`。
- HTTP 业务接口统一走 `/node-api/{nodeId}/api/v1/*`。
- WebSocket 业务接口统一走 `/node-ws/{nodeId}/api/v1/*`。
- BFF 保存节点 secret，浏览器不保存节点 token/secret。
- 非 GET 控制面请求继续使用 CSRF。
- 保留现有设计与组件，不改动组件渲染层。

## 已修复问题

### 1. `npm run serve` 打开 `/` 返回 403 文本

原因：`@fastify/static` 原配置禁止目录 index，访问 `/` 被静态插件按目录拒绝，SPA fallback 没有机会执行。

修复：

- `server/server.mjs` 将 static `index` 改为 `index.html`。
- 增加 `dist/index.html` 缺失时的明确 503 提示。
- 保留 SPA nested route fallback。

### 2. Vite 开发模式 API 不通

原因：`npm run dev` 只启动 Vite，浏览器请求 `/web-api`、`/node-api` 没有代理到 BFF。

修复：

- `vite.config.ts` 增加 `/web-api`、`/node-api`、`/node-ws`、`/healthz` 代理。
- `VITE_BFF_DEV_TARGET` 可修改代理目标。

### 3. WebSocket 绕过 BFF 直连后端

原因：`src/lib/api/url.ts` 原 `resolveWsUrl()` 会读取节点 `baseUrl` 并拼接后端地址。

修复：

- 删除浏览器侧后端节点 baseUrl 直连逻辑。
- `/api/v1/.../ws` 统一映射到 `/node-ws/{nodeId}/api/v1/.../ws`。
- BFF 负责校验浏览器 session 并签名升级请求。

### 4. 默认节点依赖打包进来的 `.bff-data`

原因：节点表为空时没有可靠的默认节点初始化机制，打包时又包含本地 SQLite，容易把开发机状态带到用户环境。

修复：

- BFF 首次启动且节点表为空时根据环境变量自动创建 `local` 节点。
- `.gitignore` 排除 `.bff-data/`、sqlite WAL、日志和本地配置。

### 5. Metrics history 前后端格式不一致

原因：后端返回 `{ job_id, points }`，前端只兼容数组或 `{ items }`。

修复：

- `jobsApi.getMetricsHistory()` 兼容 `{ points }`。

### 6. 下载 URL 在非根部署或 BFF 前缀下不稳定

原因：`reportsApi.downloadUrl()`、`assetsApi.getWorkspaceDownloadUrl()` 直接返回相对 `/node-api` 路径，没有经过统一 URL 解析。

修复：

- 下载 URL 统一使用 `resolveApiUrl()`。

### 7. BFF 节点配置缺少基础输入校验

修复：

- 节点 ID 统一 slug 化并限制长度。
- base URL 只允许 HTTP/HTTPS，拒绝账号密码和 fragment。
- node secret 最小长度校验。
- 节点 ping 改为签名代理请求。

## 验证结果

- `node --check server/server.mjs`：通过。
- `npm run build`：当前容器内的 `node_modules` 是空目录占位，缺少真实类型包，TypeScript 报 `Cannot find type definition file`。这不是本次源码修改产生的类型错误；在真实环境执行 `npm install` 或 `npm ci` 后再运行 `npm run build`。

## 后续建议

- 生产环境必须设置强随机 `FUZZ_WEB_SESSION_SECRET`。
- 首次启动后应修改 bootstrap admin 密码。
- 不要把 `.bff-data/`、`dist/`、`node_modules/` 打包进源码交付包。

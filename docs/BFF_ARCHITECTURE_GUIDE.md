# BFF 架构实现说明

## 1. BFF 的定位

本仓库中的 Node/Fastify 服务不是单纯的静态文件服务器，而是前端专用 BFF（Backend For Frontend）。其职责是：

- 承载 Web 登录与用户管理
- 存储后端节点目录
- 代浏览器向后端节点发起签名请求
- 代理 HTTP 与 WebSocket 到具体节点
- 提供前端专用聚合接口
- 在生产环境中直接服务 `dist/`

## 2. 为什么需要 BFF

浏览器不能直接访问后端节点 `/api/v1/*`，原因包括：

- 浏览器不应持有 node secret
- control plane JWT 与 HMAC 应在服务端生成
- 多节点切换需要统一入口
- Web 用户会话、CSRF、权限管理不应散落到后端节点
- 页面所需的聚合接口不适合直接让后端节点承担

## 3. 入口文件

- `server/server.mjs`：生产态 BFF 与静态资源服务入口
- `server/dev.mjs`：开发态协同启动脚本（BFF + Vite）

## 4. 核心能力

### 4.1 Web API
- `/web-api/auth/*`
- `/web-api/users*`
- `/web-api/nodes*`
- `/web-api/dashboard/overview`
- `/web-api/csrf`

### 4.2 节点代理
- HTTP：`/node-api/:nodeId/api/v1/*`
- WebSocket：`/node-ws/:nodeId/api/v1/*`

### 4.3 静态资源服务
- 生产态直接服务 `dist/`
- `/assets/*` 使用长期缓存
- `index.html` 使用 `no-cache`
- SPA fallback 只作用于页面请求，不吞掉 `/node-api/`

## 5. 本地持久化

BFF 使用 `node:sqlite` 管理本地 SQLite 数据。核心表至少包括：

- `users`
- `nodes`
- `audit_logs`

这意味着 Web 账户体系和节点目录都保存在前端服务侧，而不是后端执行节点侧。

## 6. 安全模型

### 6.1 Web 登录
- 用户对 BFF 登录
- 使用 Cookie 保存会话
- 通过 CSRF token 防护敏感操作

### 6.2 节点请求签名
BFF 转发到节点时会生成：
- 短时 JWT
- `X-ICP-Timestamp`
- `X-ICP-Nonce`
- `X-ICP-Body-SHA256`
- `X-ICP-Signature`

### 6.3 权限
- 管理员与普通用户角色不同
- 节点管理、用户管理等能力受角色保护

## 7. 聚合接口价值

例如 `/web-api/dashboard/overview` 不是简单透传，而是面向前端仪表盘整理后的聚合视图。它的价值在于：

- 避免浏览器对多个接口做繁重拼装
- 保持仪表盘数据模型稳定
- 让前端页面可以围绕产品语义开发，而不是围绕底层接口细节开发

## 8. 阅读建议

理解 BFF 时建议依次阅读：

1. `README.md`
2. `server/server.mjs`
3. `src/lib/api/url.ts`
4. `src/stores/auth-store.ts`
5. `src/stores/ui-store.ts`
6. `src/lib/api/services/*`

本项目的 BFF 是控制平面核心，不可视为可删掉的“转发层”。删掉 BFF 将直接破坏：

- 节点 secret 隐藏
- control plane 签名
- 多节点路由
- Web 会话
- CSRF
- 前端聚合视图

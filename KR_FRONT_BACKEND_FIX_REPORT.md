# front-Kr / fuzz-server-Kr 修复实施报告

生成日期：2026-06-03

## 一、修改前范围与设计

本次修改在应用补丁前确定以下边界：

- 不改前端组件渲染层，不重写页面布局，不调整视觉组件。
- 前端只改运行入口、BFF、API URL 收敛层、少量 API service 格式兼容、`.gitignore` 和 README。
- 后端只改控制面安全、WebSocket 鉴权、下载响应、异常格式、路径/导入安全、配置、`.gitignore`、README 和测试可验证部分。
- 不改协议分析、种子生成、风险分析、插桩、GDB、Runner 的核心算法。
- 读取并对照前后端 `docs/`：BFF 控制面、`/node-api`、CSRF、请求签名、workspace 引用、禁止 `shell=True`、安全解压、WebSocket 实时日志等要求。

## 二、前端修复清单

### 1. 修复 `npm run serve` 打开浏览器只有 403 文本

问题实现：`server/server.mjs` 原 `@fastify/static` 使用 `index:false`，访问 `/` 时静态目录请求被 Fastify 直接拒绝，SPA fallback 没有机会执行。

修改：

- `@fastify/static` 改为 `index: ["index.html"]`。
- `dist/index.html` 缺失时返回明确 503，提示先执行 `npm run build`。
- 保留 SPA nested route fallback。

### 2. 修复 Vite 开发模式 API 不通

问题实现：`vite.config.ts` 没有代理 `/web-api`、`/node-api`、`/node-ws`、`/healthz`。

修改：

- 增加 dev proxy。
- 默认代理目标为 `http://127.0.0.1:8080`。
- 支持 `VITE_BFF_DEV_TARGET` 覆盖。

### 3. 修复 WebSocket 绕过 BFF 直连后端

问题实现：`src/lib/api/url.ts` 的 `resolveWsUrl()` 从 UI store 取节点 `baseUrl` 并直接拼接后端 WS 地址。

修改：

- HTTP `/api/v1/*` 继续映射到 `/node-api/{nodeId}/api/v1/*`。
- WS `/api/v1/*/ws` 映射到 `/node-ws/{nodeId}/api/v1/*/ws`。
- 浏览器不再使用后端节点 `baseUrl` 直连业务接口。

### 4. 补全 BFF WebSocket 代理

问题实现：docs 已要求 BFF 统一节点代理，但 WebSocket 仍是未闭环项。

修改：

- `server/server.mjs` 增加 `/node-ws/{nodeId}/api/v1/*` upgrade 代理。
- BFF 校验浏览器 HttpOnly session。
- BFF 对上游 WS upgrade 注入短期 JWT 与 `X-ICP-*` HMAC 签名。

### 5. 修复默认节点初始化和运行时文件打包问题

问题实现：`.bff-data` SQLite 被包含在源码包中，节点列表依赖开发机旧数据。

修改：

- 节点表为空时根据环境变量自动创建默认 `local` 节点。
- 默认后端为 `http://127.0.0.1:18000`。
- 默认 secret 与后端 `config.yaml` 的 `change-me-node-secret` 对齐。
- `.gitignore` 排除 `.bff-data/`、sqlite、dist、node_modules、日志、本地配置。

### 6. 修复 API 格式对齐问题

- `jobsApi.getMetricsHistory()` 兼容后端 `{ job_id, points }`。
- `reportsApi.downloadUrl()` 和 `assetsApi.getWorkspaceDownloadUrl()` 使用 `resolveApiUrl()`，避免非根部署/开发代理下 URL 失效。

### 7. BFF 安全与复杂度优化

- 节点 ID 做 slug/长度校验。
- 节点 base URL 只允许 HTTP/HTTPS，拒绝账号密码和 fragment。
- node secret 最小长度校验。
- BFF proxy 超时值做数值兜底。
- 节点 ping 走签名代理请求。

## 三、后端修复清单

### 1. 修复 WebSocket 绕过控制面签名

问题实现：FastAPI HTTP middleware 不处理 WebSocket upgrade，原 jobs/debug/operations WS 路由可绕过 `control_plane`。

修改：

- `fuzz_core/api/security.py` 增加 `require_signed_websocket()`。
- `jobs.py`、`debug.py`、`operations.py` 在 `accept()` 前校验。
- 失败时关闭 WS，code `1008`。

### 2. 修复日志下载返回真实路径 JSON

问题实现：`/api/v1/jobs/{job_id}/logs/download` 返回 `{ path, download_url }`，不是文件下载，还泄露真实路径。

修改：

- 改为 `FileResponse`。
- 文件不存在返回 404。

### 3. 统一后端错误格式且兼容旧测试

问题实现：路由抛出的 HTTPException 使用 FastAPI 默认 `{detail}`，前端 envelope 解析和错误提示不统一。

修改：

- 增加 HTTPException handler。
- 增加 RequestValidationError handler。
- 返回 `{ ok:false, message, data }`，同时保留 `detail` 字段。

### 4. 修复 CORS/控制面 header 配置缺失

修改：

- 默认 methods 增加 `DELETE`。
- 默认 headers 和 `config.yaml` 增加 `X-CSRF-Token`、`X-ICP-Timestamp`、`X-ICP-Nonce`、`X-ICP-Body-SHA256`、`X-ICP-Signature`。

### 5. 修复压缩包解压安全风险

问题实现：tar 最终使用 `extractall()`，对复杂 tar entry 的安全性不足。

修改：

- tar/zip 统一手动逐项解压。
- 拒绝绝对路径、`..`、NUL、symlink、hardlink、device。
- 只允许普通文件和目录。

### 6. 修复 Git 导入参数安全

修改：

- Git host 使用 `workspace.allowed_git_hosts` 配置。
- 只允许 HTTPS。
- 禁止 URL 内嵌账号密码。
- branch 白名单校验，拒绝 `-` 开头。
- `git clone` 使用 `--` 截断参数解析，继续 `shell=False`。

### 7. 修复 GDB custom replay 的 `shell=True`

问题实现：`fuzz_core/debugger/replayer.py` 对 custom replay 使用 `subprocess.run(..., shell=True)`。

修改：

- 使用 `shell=False`。
- 字符串命令用 `shlex.split()`。
- 拒绝 bash/sh/python/curl/wget/ssh/sudo/rm/docker 等高风险解释器和系统命令。

### 8. 补充后端 `.gitignore`

排除：

- `.venv/`
- `workspace/`
- sqlite/WAL
- `__pycache__/`
- `.pytest_cache/`
- 构建产物
- 日志
- 本地配置覆盖和 `.env`

## 四、文档修改

前端：

- 重写 `README.md`，只描述 Web 前端/BFF 项目。
- 新增 `docs/FIX_SUMMARY_2026-06-03.md`。

后端：

- 重写 `README.md`，只描述 FastAPI 后端节点项目。
- 新增 `docs/FIX_SUMMARY_2026-06-03.md`。

## 五、验证结果

后端：

```text
python -m compileall -q fuzz_core
backend-compile-ok

python -m pytest -q tests
22 passed

TestClient direct protected API:
GET /api/v1/protocols -> 401 ok=false message="missing token"

TestClient anonymous health:
GET /api/v1/system/info -> 200 ok=true
```

前端：

```text
node --check server/server.mjs
通过，无语法输出
```

前端 `npm run build` 未能在当前容器内完成，原因是压缩包中的 `node_modules` 是空目录占位，缺少真实 `@types/*` 类型文件，报错形如：

```text
Cannot find type definition file for 'node'
Cannot find type definition file for 'react'
```

该失败不是代码补丁引入的语法错误。请在 Windows/Linux 实际环境执行：

```bash
rm -rf node_modules
npm install
npm run build
```

Windows PowerShell 可改用：

```powershell
Remove-Item -Recurse -Force node_modules
npm install
npm run build
```

## 六、仍需注意

- 生产环境必须替换默认 `FUZZ_WEB_SESSION_SECRET` 与 `control_plane.node_secret`。
- 若后端部署为多进程/多实例，应把 nonce cache 从内存迁移到共享存储。
- 大文件上传目前仍按当前阶段的最大上传大小处理，若后续上传更大源码包，应继续改为端到端流式 hash/代理。
- 本次未修改前端页面组件渲染代码，视觉问题不在本轮范围内。

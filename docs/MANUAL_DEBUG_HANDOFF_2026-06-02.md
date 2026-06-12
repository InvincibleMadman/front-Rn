# ICP Fuzz 手动调试交接说明（2026-06-02）

## 1. 当前结论

- 代码已经具备“手动启动 + 手动联调”的基础条件。
- 但我这边**没有把前后端进程稳定常驻到当前会话结束后**。
- 我已经确认过：
  - 后端命令可正常启动，并能响应 `GET http://127.0.0.1:18000/api/v1/system/info`
  - BFF 命令前台启动可监听 `127.0.0.1:8080`
  - BFF 登录、CSRF、`/web-api/auth/me`、用户管理、节点管理、仪表盘聚合、直连后端 401、nonce 重放 401、body 篡改签名失败，这些链路此前已经验证过
- 当前最适合的方式是：你按下面命令手动拉起两个服务，再按下面 checklist 逐项复测。

## 2. 手动启动命令

### 2.1 启动后端

在 `../fuzz-server-Ne` 目录执行：

```powershell
.\.venv\Scripts\python.exe -m uvicorn fuzz_core.api.app:create_app --factory --host 127.0.0.1 --port 18000
```

预期：

- 控制台出现 `Uvicorn running on http://127.0.0.1:18000`
- 浏览器或命令行访问：

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:18000/api/v1/system/info
```

应返回 `200`

### 2.2 启动 Web BFF

在 `front-Ne` 目录执行：

```powershell
node server/server.mjs
```

预期：

- 控制台出现 `Server listening at http://127.0.0.1:8080`
- 访问：

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8080/healthz
```

应返回 `200`

## 3. 我建议你优先手测的链路

### 3.1 BFF 基础链路

1. `GET /web-api/csrf`
2. `POST /web-api/auth/login`
3. `GET /web-api/auth/me`
4. `GET /web-api/nodes`
5. `GET /web-api/dashboard/overview`

预期：

- 浏览器只拿到 HttpOnly session，不拿到 node token
- `node_secret` 不应出现在节点列表响应中
- 仪表盘返回全局 KPI、节点健康、协议数、任务、Crash、漏洞、GDB、报告字段

### 3.2 节点鉴权链路

1. 直连后端：

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:18000/api/v1/protocols
```

预期：

- `401`

2. 通过 BFF 访问：

```text
GET /node-api/local/api/v1/protocols
```

预期：

- 登录后可通

3. 重放相同 nonce

预期：

- 第二次 `401`

4. 篡改 body 后再发给后端

预期：

- `401`
- message 接近 `body hash mismatch` / `invalid request signature`

### 3.3 配置 PATCH 链路

已修复一处之前的 bug：

- 症状：`PATCH /node-api/local/api/v1/config` 被误判为 `replayed request`
- 原因：中间件先验一次签名，路由 `Depends(require_signed_node_request)` 又验一次，同一 nonce 被重复消费
- 当前修复：复用 `request.state.node_user`

请重点手测：

```text
PATCH /node-api/local/api/v1/config
```

预期：

- 普通用户也可以通过 BFF 修改当前节点配置
- 不再出现 `replayed request`

### 3.4 资产中心链路

建议用一个最小 zip 手测：

- 内容示例：`main.c`
- 接口：
  - `POST /node-api/local/api/v1/protocols/{protocol}/source/upload-archive`
  - `GET /node-api/local/api/v1/protocols/{protocol}/workspace/tree?scope=source&path=/`
  - `GET /node-api/local/api/v1/protocols/{protocol}/workspace/preview?scope=source&path=/main.c`
  - `GET /node-api/local/api/v1/assets?protocol={protocol}`

我刚修过两处相关问题：

- BFF multipart 代理会错误透传 `Expect` header，导致 upstream fetch 报 `expect header not supported`
- 后端 `safe_resolve_virtual_path()` 对 `/`、`/main.c` 这种前端虚拟路径处理不正确，误判为 scope escape

这两处代码已经改了，但**我还没在你这边完整走完一轮“上传成功 -> tree -> preview”最终复测**，所以这是你最应该优先手测的一段。

### 3.5 Git 导入链路

已验证：

- 非 GitHub HTTPS URL 会被拒绝

请再手测：

```text
POST /node-api/local/api/v1/protocols/{protocol}/source/import-git
```

预期：

- `https://github.com/...` 才允许
- 其他 URL 拒绝

说明：

- 这个会受你本机网络与 git 可用性影响

### 3.6 构建 / LaunchProfile / JobCreate

当前机器缺少 `cmake`、`afl-fuzz`，所以我建议这样测：

1. 先用“无构建系统”的最小源码目录
2. 执行：
  - `GET /build/probe`
  - `POST /build/plans`
  - `POST /build/plans/{plan_id}/dry-run`
  - `POST /build/plans/{plan_id}/run`
  - `GET /build/targets`
  - `POST /fuzz/launch-profiles/predict`
  - `GET /fuzz/launch-profiles`

说明：

- 当前 `BuildAssistantService.run_plan()` 即使没有 cmake/make，只要 plan step 的 argv 为空，仍会生成一个 dummy target 文件
- 这意味着你可以先验证：
  - `BuildPlan -> BuildRun -> target -> LaunchProfile` 这条链的数据对象流转

再测正式任务创建：

```text
POST /node-api/local/api/v1/jobs
```

重点看两点：

1. `dry_run=false` 且没有 `launch_profile_id` 必须 `422`
2. 即使你在请求体里塞 `afl_path=/bin/bash`，正式执行也不应采信它，而应按后端 LaunchProfile / allowlist 处理

预期：

- 在当前 Windows 机器上，正式执行大概率会报 `afl-fuzz not found`
- 但**错误应指向 profile 中的 `afl-fuzz`，而不是你手工注入的 `/bin/bash`**

### 3.7 报告中心

建议测：

- `GET /node-api/local/api/v1/protocols/{protocol}/reports/summary`
- `POST /node-api/local/api/v1/protocols/{protocol}/reports/generate`
- `GET /node-api/local/api/v1/protocols/{protocol}/reports`
- `GET /node-api/local/api/v1/protocols/{protocol}/reports/{report_id}/download`

预期：

- 能生成 PDF
- 返回字段只出现 `workspace_ref` / `virtual_path`
- 不出现服务器绝对路径

## 4. 当前已知问题 / 未闭环项

### 4.1 BFF 后台常驻方式不稳定

- `node server/server.mjs` 前台跑是正常的
- 但我在当前 PowerShell 自动化里用 `Start-Process + RedirectStandardOutput/RedirectStandardError` 时，BFF 进程有时会起来后又退出
- 所以你手调时请优先直接前台运行，不要先依赖我之前的后台启动脚本

### 4.2 资产上传与文件树刚修完，未完成最终一轮闭环复测

- 已修代码，但我没有在最新补丁生效后完成：
  - 上传 zip
  - tree
  - preview
  - assets list
 这一整条链的最终通过确认

### 4.3 WebSocket 仍未通过 BFF 代理

这是当前最明确的结构性残留问题之一。

- 目前 HTTP `/api/v1/*` 已通过前端 URL 解析收口到 `/node-api/{selectedNodeId}/api/v1/*`
- 但 `resolveWsUrl()` 仍会把 `/api/v1/.../ws` 解析到当前节点 `baseUrl`
- 这意味着：
  - 浏览器仍可能直接连节点 WS
  - 这不符合“Browser 不直接访问后端 baseUrl”的最终约束
  - 任务详情、事件流、metrics/artifacts WS、debug/operation log WS 这类实时流功能需要继续补 BFF WS 代理，或改成别的受控通道

如果你接下来手测 Job Detail / Debug / 运行日志实时流，请优先怀疑这一点。

### 4.4 当前机器不适合做正式 AFL 运行正向验证

- 当前机器缺少：
  - `cmake`
  - `afl-fuzz`
- 所以：
  - BuildPlan/BuildRun/LaunchProfile 的对象流转可以部分验证
  - 正式 Fuzz 执行的“成功跑起来”建议到 Linux 环境复测

## 5. 关键实现文件路径

### 5.1 前端 / BFF

- `front-Ne/server/server.mjs`
- `front-Ne/package.json`
- `front-Ne/src/lib/api/client.ts`
- `front-Ne/src/lib/api/url.ts`
- `front-Ne/src/stores/ui-store.ts`
- `front-Ne/src/stores/auth-store.ts`
- `front-Ne/src/lib/api/services/auth.ts`
- `front-Ne/src/lib/api/services/nodes.ts`
- `front-Ne/src/lib/api/services/dashboard.ts`
- `front-Ne/src/lib/api/services/assets.ts`
- `front-Ne/src/lib/api/services/build-assistant.ts`
- `front-Ne/src/lib/api/services/reports.ts`
- `front-Ne/src/lib/api/services/system.ts`
- `front-Ne/src/features/dashboard/dashboard-view.tsx`
- `front-Ne/src/features/nodes/nodes-view.tsx`
- `front-Ne/src/features/jobs/job-detail-view.tsx`
- `front-Ne/src/components/common/node-switcher-dropdown.tsx`
- `front-Ne/src/components/common/protected-route.tsx`

### 5.2 后端

- `../fuzz-server-Ne/fuzz_core/api/app.py`
- `../fuzz-server-Ne/fuzz_core/api/security.py`
- `../fuzz-server-Ne/fuzz_core/api/routers/config_router.py`
- `../fuzz-server-Ne/fuzz_core/api/routers/assets.py`
- `../fuzz-server-Ne/fuzz_core/api/routers/build_assistant.py`
- `../fuzz-server-Ne/fuzz_core/api/routers/jobs.py`
- `../fuzz-server-Ne/fuzz_core/api/routers/reports.py`
- `../fuzz-server-Ne/fuzz_core/config.py`
- `../fuzz-server-Ne/fuzz_core/storage/path_resolver.py`
- `../fuzz-server-Ne/fuzz_core/services/source_import_service.py`
- `../fuzz-server-Ne/fuzz_core/services/workspace_tree_service.py`
- `../fuzz-server-Ne/fuzz_core/services/build_assistant_service.py`
- `../fuzz-server-Ne/fuzz_core/services/launch_profile_service.py`
- `../fuzz-server-Ne/fuzz_core/services/report_service.py`
- `../fuzz-server-Ne/fuzz_core/runner/models.py`
- `../fuzz-server-Ne/fuzz_core/runner/manager.py`

## 6. 我建议你的手动调试顺序

1. 启动后端
2. 启动 BFF
3. 测 `healthz` 与 `system/info`
4. 登录 BFF
5. 测 `dashboard/overview`
6. 测直连后端 401
7. 测 `PATCH /node-api/local/api/v1/config`
8. 测 zip 上传 -> tree -> preview -> assets
9. 测非 GitHub URL 拒绝
10. 测 BuildPlan -> BuildRun -> LaunchProfile
11. 测 JobCreate 正式执行拒绝规则
12. 测 reports generate/list/download
13. 最后再看 Job Detail / Debug 这种 WS 实时流，因为它当前最可能还不完全闭环

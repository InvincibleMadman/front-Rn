# CODEX_AR_SNIPPETS_FRONTEND.md

## 1. Frontend Control Plane Principles

- 浏览器只访问 Web BFF，不直接持有 FastAPI 节点凭证。
- 前端所有新增控制面接口统一走 `/web-api/*`。
- 现有节点业务接口后续统一收敛到 `/node-api/{nodeId}/api/v1/*`。
- 所有新增接口响应统一为 `{ ok, message, data }`。

## 2. Session And CSRF

- 登录态依赖 HttpOnly Cookie，会话信息不保存在 localStorage。
- 前端仅缓存非敏感 UI 状态，例如主题、当前节点、列表筛选。
- 非 `GET/HEAD/OPTIONS` 请求必须附带 `X-CSRF-Token`。
- 前端需要有独立的 `csrf` 获取与续期逻辑。

示例：

```ts
export interface ApiEnvelope<T> {
  ok: boolean;
  message: string;
  data: T;
}

export async function getCsrfToken(): Promise<string> {
  const res = await fetch("/web-api/csrf", {
    method: "GET",
    credentials: "include",
  });
  const json = (await res.json()) as ApiEnvelope<{ csrf_token: string }>;
  return json.data.csrf_token;
}
```

## 3. Frontend API Layer Direction

- 保留现有 `src/lib/api/client.ts` 作为基础封装。
- 阶段改造时优先在 URL 解析与调用入口层适配 BFF，不直接改动后端业务 service 契约。
- 真实节点切换应由 BFF 节点代理承担，浏览器不再直接拼接后端 `base_url`。

建议方向：

```ts
resolveApiUrl("/web-api/dashboard/overview")
resolveApiUrl(`/node-api/${nodeId}/api/v1/jobs`)
```

## 4. Auth State

- 建议新增 `auth` 查询：`/web-api/auth/me`
- 建议新增登录/退出：
  - `POST /web-api/auth/login`
  - `POST /web-api/auth/logout`
- 前端不保存密码，不缓存 node token，不展示 node_secret。

## 5. Node Management UI

- 节点列表改为读取 BFF 节点注册表，不再以 `public/fuzz-nodes.json` + localStorage 为主数据源。
- 普通用户可创建和编辑自己新增的节点。
- 管理员可删除节点、管理用户。
- 节点表单仅提交业务字段，不回显 `node_secret`。

## 6. Dashboard Aggregation UI

- Dashboard 总览页保留，并扩展为跨节点聚合概览。
- 页面仍复用现有 `Card`、`SummaryCard`、`StatusBadge`、`EChartsBase`。
- 总览需要支持：
  - 全局 KPI
  - 节点健康摘要
  - 当前节点明细
  - 最近任务 / 漏洞 / 调试 / 报告

## 7. Workspace Reference Rules

- 前端显示与传递路径时只使用 `workspace://{protocol}/{scope}/{virtual_path}`。
- 不展示服务器绝对路径。
- 文件树只读，不提供单文件编辑、重命名、删除入口。

## 8. Build And Launch Profile Direction

- BuildPlan / BuildRun / LaunchProfile 作为后续任务创建主链路。
- 正式任务创建仅提交 `launch_profile_id`。
- `target_cmd`、`fuzzer_args` 仅允许 `dry_run=true` 时作为草案输入。

## 9. Logging And Error Feedback

- 所有页面级运行输出最终进入全局底部日志栏。
- 错误展示采用 toast + 详情抽屉/弹窗 + 全局日志栏。
- 页面内大块日志/控制台卡片后续阶段应逐步清理。

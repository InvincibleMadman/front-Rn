# CODEX_PAGE_LOGIC_FIX_PLAN.md

## 读取过的 docs 文件列表

前端 docs:

- `front-Kr/docs/CODEX_AR_PRODUCT_SPEC.md`
- `front-Kr/docs/CODEX_AR_API_CONTRACT.md`
- `front-Kr/docs/CODEX_AR_SECURITY_MODEL.md`
- `front-Kr/docs/CODEX_AR_SNIPPETS_FRONTEND.md`
- `front-Kr/docs/CODEX_AR_SNIPPETS_BFF.md`
- `front-Kr/docs/redesign-plan.md`
- `front-Kr/docs/design-map.md`
- `front-Kr/docs/design-reference-map.md`
- `front-Kr/docs/FIX_SUMMARY_2026-06-03.md`

后端 docs:

- `fuzz-server-Kr/docs/CODEX_AR_BACKEND_DELTA.md`
- `fuzz-server-Kr/docs/CODEX_AR_SECURITY_MODEL.md`
- `fuzz-server-Kr/docs/CODEX_AR_SNIPPETS_BACKEND.md`
- `fuzz-server-Kr/docs/FIX_SUMMARY_2026-06-03.md`

辅助约束:

- `AGENTS.md`

## 读取过的旧前端仪表盘参考文件

- `front-Ar-6.1/src/features/dashboard/dashboard-view.tsx`
- `front-Ar-6.1/src/pages/console-page.tsx`
- `front-Ar-6.1/docs/design-map.md`
- `front-Ar-6.1/docs/design-reference-map.md`

## 从 docs 提取出的最终导航顺序

1. `仪表盘` -> `/console`
2. `资产中心` -> `/assets`
3. `协议准备工作台` -> `/offline?tab=protocol`
4. `Fuzz 任务` -> `/jobs`
5. `漏洞中心` -> `/vulns/history`
6. `GDB 调试` -> `/debug`
7. `产物中心` -> `/artifacts`
8. `报告中心` -> `/reports`
9. `节点管理` -> `/nodes`
10. `系统设置` -> `/settings`

## 资产中心职责

- 当前后端节点内的协议项目空间。
- 展示协议资产总览图。
- 支持源码压缩包导入和 GitHub HTTPS 导入。
- 展示虚拟文件树、文件预览、安全下载。
- 展示协议资产相关索引或摘要。
- 管理员可删除整个协议项目。
- 不承担跨协议证据搜索器职责。

## 产物中心职责

- 跨协议证据搜索器，不是第二个文件管理器。
- 以 `workspace_ref / scope / virtual_path / kind / name` 为主展示证据产物。
- 支持跨协议搜索、预览、下载、跳转。
- 不显示源码导入、Git 导入、虚拟文件树、删除协议项目、协议资产图编辑等资产中心能力。

## 协议准备工作台职责

- 保留原离线工作台业务能力，但用户可见名称统一改为 `协议准备工作台`。
- 保留协议提取、VulDoc 蒸馏、KB、种子生成、风险分析、风险预览、风险上传、插桩处理、构建 Fuzz 目标。
- 继续遵守 `Browser -> Web BFF -> FastAPI backend node`。
- 页面内错误继续通过现有全局错误中心与底部 Dock 统一处理。

## 仪表盘统计卡片职责

- 以 `GET /web-api/dashboard/overview` 为唯一总览入口。
- 第一组 KPI 固定为 8 项:
  - 节点总数
  - 在线节点
  - 协议资产数
  - 运行中任务
  - Crash 总数
  - 漏洞总数
  - GDB 会话数
  - 报告数
- 视觉仅在页面级实现彩色渐变卡片、图标背景、醒目数值、短说明和响应式布局。
- 不修改 `SummaryCard` 或全局样式系统。

## 页面级错误处理策略：Toast + 日志栏 + 页面空态

- 复用现有 `GlobalErrorCenter` 作为 timed toast host。
- 复用 `dockLog` / `ApiErrorReporter` 进入全局 Dock，避免重复造通知系统。
- 目标页面移除内联 `ApiErrorAlert` 错误块，改为:
  - timed toast
  - 页面或全局日志条目
  - 空态 / 占位 / skeleton / retry
- 不在卡片、表格、图表区域内显示 raw error、raw JSON、stack、AxiosError 风格文本。

## 需要补充的页面级业务显示项

- 仪表盘:
  - 按 docs 补齐 8 个 KPI。
  - 展示节点健康摘要、节点分布、当前节点协议资产图、近期事件。
- 资产中心:
  - 标题和描述改成资产中心语义。
  - 明确区分协议资产图、导入区、虚拟文件树、预览区、资产索引。
- 产物中心:
  - 独立标题、描述、跨协议搜索表格、预览、下载、跳转。

## 需要补充的页面级日志条目设计

资产中心:

- `Source archive upload started`
- `Source archive upload finished`
- `Git import started`
- `Git import finished`
- `Workspace tree refreshed`
- `Workspace file preview loaded`
- `Workspace file download requested`
- `Asset search executed`
- `Protocol project delete requested`
- `Protocol project deleted`
- `Asset operation failed`

产物中心:

- `Artifact search executed`
- `Artifact filter changed`
- `Artifact preview loaded`
- `Artifact download requested`
- `Artifact jump requested`
- `Artifact operation failed`

协议准备工作台:

- 使用英文阶段前缀:
  - `Protocol analysis`
  - `VulDoc distill`
  - `Knowledge base`
  - `Seed generation`
  - `Risk analysis`
  - `Risk preview`
  - `Risk upload`
  - `Instrumentation`

仪表盘:

- `Dashboard overview loaded`
- `Dashboard overview failed`

## BFF 控制台日志格式优化设计

- 新增 `front-Kr/server/logger.mjs` 统一输出。
- 输出格式采用 Vite-like 双列:
  - 第一列 `scope`
  - 第二列 `event`
  - 正文 `message + detail`
- 使用英文日志文本。
- 不打印 raw object、raw JSON、raw Error、headers、cookies、tokens、request、response。
- 支持:
  - `logReady(message, detail)`
  - `logInfo(scope, event, message, detail)`
  - `logWarn(scope, event, message, detail)`
  - `logError(scope, event, message, detail)`
- 支持 `NO_COLOR=1` 和非 TTY 自动禁用颜色。
- 支持自动换行和续行缩进。
- 替换 `server/server.mjs` 中启动、bootstrap、node proxy、websocket proxy、dashboard 聚合相关散乱日志。

## 本次允许修改的文件

- `front-Kr/src/app/router.tsx`
- `front-Kr/src/app/providers.tsx`
- `front-Kr/src/components/layout/sidebar.tsx`
- `front-Kr/src/components/layout/topbar.tsx`
- `front-Kr/src/features/dashboard/dashboard-view.tsx`
- `front-Kr/src/features/assets/assets-view.tsx`
- `front-Kr/src/features/offline/offline-studio-view.tsx`
- `front-Kr/src/pages/assets-page.tsx`
- `front-Kr/src/pages/console-page.tsx`
- `front-Kr/src/lib/api/services/assets.ts`
- `front-Kr/src/types/api/assets.ts`
- `front-Kr/src/lib/api/services/dashboard.ts`
- `front-Kr/src/types/api/dashboard.ts`
- `front-Kr/server/server.mjs`
- `front-Kr/server/logger.mjs`
- `front-Kr/README.md`
- `front-Kr/docs/CODEX_PAGE_LOGIC_FIX_PLAN.md`
- `front-Kr/docs/CODEX_PAGE_LOGIC_FIX_SUMMARY.md`

允许新增:

- `front-Kr/src/features/artifacts/artifacts-view.tsx`
- `front-Kr/src/pages/artifacts-page.tsx`

## 本次禁止修改的文件

- `front-Kr/src/styles/globals.css`
- `front-Kr/src/components/ui/**`
- `front-Kr/src/components/charts/**`
- `front-Kr/src/components/common/summary-card.tsx`
- `front-Kr/src/components/common/json-viewer.tsx`
- `front-Kr/src/components/common/operation-log-panel.tsx`
- 后端核心业务逻辑文件

## 是否需要后端改动的判断依据

- 只有在 docs 规定、前端必须调用的接口缺失或字段明显不兼容时，才考虑后端最小 adapter。
- 已检查后端现有接口，`assets / workspace / jobs summary / vulnerabilities summary / debug summary / reports summary / reports download / build assistant` 路由均已存在。
- 因此默认不修改后端。
- 如 dashboard 聚合缺少漏洞、GDB、报告统计，可优先在 BFF 的 `/web-api/dashboard/overview` 做最小增强，不改 FastAPI 核心服务。

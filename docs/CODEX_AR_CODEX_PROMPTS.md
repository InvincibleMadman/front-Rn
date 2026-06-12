# CODEX_AR_CODEX_PROMPTS.md

## 1. Phase Guardrail

- 阶段 0 只允许做目录确认、文档读取、结构识别、缺失文档补齐。
- 不进行大规模业务重写。
- 不改现有 API 访问代码与后端核心逻辑。

## 2. Frontend Refactor Prompt Baseline

后续阶段前端改造必须满足：

- 保留 Dashboard 总览页，不用资产中心替代。
- 保留现有视觉风格、浅深主题与 `src/styles/globals.css` token 体系。
- 新增 UI 复用现有组件：
  - `Card`
  - `Tabs`
  - `Table`
  - `Button`
  - `Input`
  - `Textarea`
  - `SummaryCard`
  - `StatusBadge`
  - `JsonViewer`
  - `EChartsBase`

## 3. BFF Migration Prompt Baseline

后续阶段控制面迁移必须满足：

- 正式服务使用 Node/Fastify BFF 托管 `dist/`。
- Browser 只持有 HttpOnly Session Cookie。
- 非 GET 请求有 CSRF 防护。
- Browser 不保存 node token，不保存 node_secret。
- 浏览器不直接请求 FastAPI 节点业务 API。
- BFF 到节点请求必须带：
  - short-lived JWT
  - timestamp
  - nonce
  - body_sha256
  - HMAC signature

## 4. Backend Compatibility Prompt Baseline

后续阶段后端增强必须满足：

- 保留现有协议提取、种子生成、VulDoc、KB、风险分析、插桩、GDB、Runner 核心逻辑。
- 仅允许在 router、security、workspace_ref、build assistant、report 等外围层兼容增强。
- 无认证访问节点业务 API 必须失败。
- nonce 重放必须 401。
- 禁止 `shell=True`。

## 5. Build Workflow Prompt Baseline

后续阶段构建链路必须满足：

- BuildPlan 由后端生成并保存。
- BuildRun 只能运行保存的 BuildPlan。
- LaunchProfile 由后端根据 BuildRun 结果生成并保存。
- 正式 JobCreate 只提交 `launch_profile_id`。
- `afl-fuzz` 参数预测走本地规则，不调用 LLM。

## 6. Verification Prompt Baseline

除非用户明确要求，不主动执行：

- `npm run build`
- `npm run lint`
- `npm run typecheck`

但每个阶段结束都应至少检查：

- API 边界是否被破坏
- 旧路径与旧固定骨架是否残留
- 页面内日志面板是否残留
- `src/lib/api` 是否被非必要改动

## 7. Output Prompt Baseline

每阶段输出至少包含：

- 已读取文档
- 已读取代码
- 修改文件清单
- API 文件是否修改
- 风险与不确定点
- 下一阶段建议

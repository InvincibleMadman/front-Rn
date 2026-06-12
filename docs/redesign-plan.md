# 前端重设计总纲 + 实施计划

## 一、总体信息架构

```
/                          首页（独立入口，无 Sidebar）
/console                   控制台（浅色高密度工作台）
/offline?tab=protocol      离线工作台（左侧表单 + 右侧结果 + 底部日志）
/jobs                      任务列表（轻量表格）
/jobs/new                  创建任务（表单）
/jobs/:jobId               任务详情/监控（指标 + 图表 + 产物 + 事件）
/debug                     GDB 调试（深色焦点分析舱）
/vulns/history             历史漏洞（过滤表格 + 详情）
/nodes                     节点管理（卡片 + 表单）
/settings                  系统设置（Tab 分组表单）
```

### 路由分层

| 层级 | 路由 | 壳层 | 主题 |
|------|------|------|------|
| L0 入口 | `/` | 无 Sidebar（全屏） | 深色科幻 |
| L1 控制台 | `/console` | AppShell | 浅色 |
| L2 离线工作台 | `/offline` | AppShell | 浅色 |
| L2 任务管理 | `/jobs`, `/jobs/new` | AppShell | 浅色 |
| L2 任务监控 | `/jobs/:jobId` | AppShell | 浅色/深色混合 |
| L2 GDB 调试 | `/debug` | AppShell | 深色 |
| L2 漏洞历史 | `/vulns/history` | AppShell | 浅色 |
| L2 节点管理 | `/nodes` | AppShell | 浅色 |
| L2 系统设置 | `/settings` | AppShell | 浅色 |

---

## 二、浅色主题配色 Token 方案

基于 `genr/3.png` + `ui案例/8abc00b2...jpg`（Zenith）+ `ui案例/IMG_1216.JPG`（销售仪表盘）：

```css
:root {
  /* ── 背景层 ── */
  --bg-primary: 220 14% 96%;          /* 主背景 #f0f2f5 */
  --bg-surface: 0 0% 100%;            /* 卡片/面板 #ffffff */
  --bg-surface-elevated: 0 0% 100%;   /* 弹窗/浮层 */
  --bg-sidebar: 220 14% 96%;          /* 侧栏背景 */
  --bg-topbar: 0 0% 100%;             /* 顶栏背景 */

  /* ── 文字层 ── */
  --text-primary: 224 30% 13%;        /* 主文字 #1a1d26 */
  --text-secondary: 220 9% 46%;       /* 辅助文字 #73777f */
  --text-tertiary: 220 9% 64%;        /* 弱化文字 #a3a6ad */
  --text-inverse: 0 0% 100%;          /* 反色文字 */

  /* ── 主重点色：深蓝 ── */
  --accent-blue: 224 76% 48%;         /* 主蓝 #2563eb */
  --accent-blue-light: 224 76% 95%;   /* 浅蓝背景 */
  --accent-blue-hover: 224 76% 42%;   /* 悬停蓝 */

  /* ── 辅助重点色：明橙 ── */
  --accent-orange: 24 90% 54%;        /* 辅橙 #f97316 */
  --accent-orange-light: 24 90% 95%;  /* 浅橙背景 */

  /* ── 语义色 ── */
  --color-success: 142 71% 45%;       /* 绿 #22c55e */
  --color-danger: 0 84% 60%;          /* 红 #ef4444 */
  --color-warning: 38 92% 50%;        /* 橙黄 #f59e0b */
  --color-info: 224 76% 48%;          /* 蓝（复用主蓝） */

  /* ── 边框 / 分隔 ── */
  --border-default: 220 13% 91%;      /* 默认边框 #e2e4e9 */
  --border-subtle: 220 13% 95%;       /* 微弱边框 */

  /* ── 阴影 ── */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.07);
  --shadow-lg: 0 10px 25px -5px rgba(0,0,0,0.08);

  /* ── 图表色板 ── */
  --chart-1: 224 76% 48%;             /* 蓝 */
  --chart-2: 24 90% 54%;              /* 橙 */
  --chart-3: 142 71% 45%;             /* 绿 */
  --chart-4: 0 84% 60%;               /* 红 */
  --chart-5: 262 83% 58%;             /* 紫 */
  --chart-6: 199 89% 48%;             /* 青 */

  /* ── 间距系统 ── */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;

  /* ── 圆角 ── */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;
}
```

---

## 三、深色主题配色 Token 方案

基于 `genr/6.png` + `ui案例/19b01db8...jpg`（Pixel Mags）+ `ui案例/IMG_1203.JPG`（深色 KPI）+ Grafana 深色：

```css
.dark {
  /* ── 背景层（必须有层次，不能糊在一起） ── */
  --bg-primary: 225 20% 7%;           /* 主背景 #0f1218 */
  --bg-surface: 225 18% 12%;          /* 卡片/面板 #1a1f2e — 必须比背景亮 */
  --bg-surface-elevated: 225 16% 16%; /* 弹窗/浮层 #242a3a */
  --bg-sidebar: 225 20% 7%;           /* 侧栏 */
  --bg-topbar: 225 18% 12%;           /* 顶栏 */

  /* ── 文字层 ── */
  --text-primary: 210 20% 93%;        /* 主文字 #e8eaed */
  --text-secondary: 220 10% 60%;      /* 辅助文字 #8b919a */
  --text-tertiary: 220 10% 45%;       /* 弱化文字 #6b7280 */
  --text-inverse: 225 20% 7%;         /* 反色文字 */

  /* ── 主重点色：深蓝（亮化） ── */
  --accent-blue: 224 82% 62%;         /* 亮蓝 #4f8ef7 */
  --accent-blue-light: 224 82% 15%;   /* 深蓝背景 */
  --accent-blue-hover: 224 82% 68%;   /* 悬停亮蓝 */

  /* ── 辅助重点色：明橙（亮化） ── */
  --accent-orange: 24 92% 62%;        /* 亮橙 #fb923c */
  --accent-orange-light: 24 92% 15%;  /* 深橙背景 */

  /* ── 语义色（亮化） ── */
  --color-success: 142 71% 55%;       /* 亮绿 #4ade80 */
  --color-danger: 0 84% 68%;          /* 亮红 #f87171 */
  --color-warning: 38 92% 58%;        /* 亮黄 #fbbf24 */

  /* ── 边框 ── */
  --border-default: 225 14% 22%;      /* 卡片边框 #2d3348 */
  --border-subtle: 225 14% 18%;       /* 微弱边框 */

  /* ── 阴影（深色模式用发光代替阴影） ── */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.4);
  --shadow-glow: 0 0 20px rgba(79,142,247,0.15);

  /* ── 图表色板（亮化） ── */
  --chart-1: 224 82% 62%;             /* 亮蓝 */
  --chart-2: 24 92% 62%;              /* 亮橙 */
  --chart-3: 142 71% 55%;             /* 亮绿 */
  --chart-4: 0 84% 68%;               /* 亮红 */
  --chart-5: 262 83% 68%;             /* 亮紫 */
  --chart-6: 199 89% 58%;             /* 亮青 */
}
```

### 深色模式关键规则

1. **背景层次**：`bg-primary`（`#0f1218`）→ `bg-surface`（`#1a1f2e`）→ `bg-surface-elevated`（`#242a3a`），三层必须可区分
2. **边框可见**：卡片边框 `border-default` 必须在深色背景下可见
3. **文字对比**：主文字 ≥ 4.5:1，辅助文字 ≥ 3:1
4. **语义色亮化**：深色模式下的 success/danger/warning 必须比浅色模式亮

---

## 四、组件级设计语言

### 4.1 KPI 卡片

```
┌──────────────────────────────┐
│  LABEL (10px 大写追踪宽)      │
│  1,420  (28px 粗体等宽数字)   │
│  ↗ +2% (sparkline 趋势)      │
└──────────────────────────────┘
```

- 浅色：白底 + 浅灰边框 + 深色数字
- 深色：`bg-surface` + `border-default` + 亮色数字
- 参考：Zenith KPI、Sugab 统计卡、IMG_1216 销售 KPI

### 4.2 图表卡片

```
┌──────────────────────────────┐
│  Title          [Daily][Weekly][Monthly] │
│  Description                 │
│  ┌──────────────────────────┐│
│  │     ECharts 图表          ││
│  └──────────────────────────┘│
└──────────────────────────────┘
```

- 图表容器：无边框，直接嵌入卡片
- 图表色板：使用 CSS 变量 `--chart-1` 到 `--chart-6`
- 参考：Zenith 趋势图、Sugab 统计图

### 4.3 表格

```
┌────────────────────────────────────────────┐
│  Search...        [Status ▾]  [Sort ▾]    │
├────────────────────────────────────────────┤
│  Name    │ Status │ Path    │ Updated │ ⋯  │
├────────────────────────────────────────────┤
│  job-1   │ ● 运行 │ /path  │ 2min    │ →  │
│  job-2   │ ○ 完成 │ /path  │ 1hr     │ →  │
└────────────────────────────────────────────┘
```

- 表头：深色背景（浅色模式 `--bg-surface-elevated`，深色模式 `--bg-surface`）
- 行：hover 高亮，交替色可选
- 参考：Linear Issues 表格、Zenith 表格、IMG_1217 过滤表格

### 4.4 状态标签 (Severity Chips)

```
● running   (绿色)
● finished  (蓝色)
● failed    (红色)
● starting  (黄色)
● stopping  (灰色)
```

- 圆形状态点 + 文字标签
- 参考：Wiz/Snyk severity chips

### 4.5 日志面板（Dock）

```
┌────────────────────────────────────────────┐
│  ▾ 日志  [offline ▾] [搜索...] [清空] [折叠] │
├────────────────────────────────────────────┤
│  14:23:01 [info] Protocol analysis done    │
│  14:23:02 [warn] Slow response 1200ms     │
│  14:23:03 [error] Seed file not found     │
└────────────────────────────────────────────┘
```

- 背景：深色（`#0b1020`）
- 文字：等宽字体，按级别着色
- 功能：折叠/展开、过滤、清空、来源分类、自动滚动/暂停
- 参考：VS Code Terminal、Datadog Logs Explorer

### 4.6 错误反馈

- **Toast**：简短错误提示（3s 自动消失）
- **详情弹窗/抽屉**：点击 toast 或错误行展开完整错误
- **全局日志**：所有错误同步写入 Dock
- **禁止**：大块错误信息塞在页面卡片内

---

## 五、图表信息密度策略

### 每页图表清单

| 页面 | 图表类型 | 信息 |
|------|---------|------|
| 控制台 | 趋势折线图 | 执行次数、覆盖率、崩溃数趋势 |
| 控制台 | 环图 | 任务状态分布 |
| 控制台 | 柱图 | 最新 Fuzz 指标 |
| 控制台 | sparkline × 4 | KPI 卡片内趋势 |
| 任务详情 | 趋势折线图 × 2 | 核心趋势 + 队列健康 |
| 任务详情 | 环图 × 2 | 样本占比 + 风险级别 |
| 任务详情 | 柱图 | 最新指标快照 |
| 离线工作台 | 结果 JSON 查看器 | 各步骤返回结果 |
| 历史漏洞 | 无图表，纯表格 | 漏洞列表 + 详情 |
| GDB 调试 | 结构化报告 | 调试结果展示 |

### 图表规则

1. 每个图表卡片有明确标题和描述
2. 图表色板统一使用 CSS 变量
3. 空数据时显示"暂无数据"提示
4. 加载时显示 skeleton
5. 支持 tooltip 显示精确值
6. 不使用过多装饰性动画

---

## 六、导航与顶栏固定策略

### Sidebar

- 固定在左侧，不跟主体滚动
- 宽度：`var(--sidebar-w)` = `clamp(15rem, 16vw, 18.5rem)`
- 收起态：`var(--sidebar-w-collapsed)` = `4.5rem`，仅显示图标
- 收起后必须有明确可见的展开按钮（`PanelLeftOpen` 图标）
- 折叠过渡：200ms ease
- 参考：Linear Sidebar 高亮 + WeHR 轻量侧栏

### Topbar

- 固定在顶部，sticky 定位
- 高度：`var(--topbar-h)` = `clamp(4.75rem, 7vh, 6.5rem)`
- 内容：页面标题 + 节点切换 + 健康状态 + 全局操作
- 参考：Google Cloud Console 顶部栏

### Dock（底部日志栏）

- 固定在底部，可折叠
- 高度：`var(--dock-h)` = `clamp(14rem, 26vh, 24rem)`（展开时）
- 收起时仅显示一行状态条
- 功能：过滤、清空、来源分类、自动滚动/暂停
- 所有页面的内部日志框全部取消，统一进入 Dock

---

## 七、响应式布局策略

### 断点

| 断点 | 宽度 | Sidebar | 布局 |
|------|------|---------|------|
| sm | < 768px | 折叠 | 单列 |
| md | 768-1024px | 折叠 | 两列 |
| lg | 1024-1440px | 展开 | 两到三列 |
| xl | > 1440px | 展开 | 三列+ |

### 布局 Token

```css
--sidebar-w: clamp(15rem, 16vw, 18.5rem);
--sidebar-w-collapsed: 4.5rem;
--topbar-h: clamp(4.75rem, 7vh, 6.5rem);
--dock-h: clamp(14rem, 26vh, 24rem);
--page-gutter: clamp(1rem, 2vw, 1.5rem);
--content-max: min(100%, 112rem);
```

### 布局规则

1. 禁止使用固定像素 `w-[296px]`、`h-[620px]` 等
2. 必须使用 CSS Variables、clamp()、grid/flex、minmax(0,1fr)
3. 页面主体区域单独滚动
4. 所有 `min-h-0 flex-1 overflow-hidden` 确保内容不溢出

---

## 八、安全与性能边界

### 安全

- 禁止 `dangerouslySetInnerHTML`
- 日志、路径、错误、命令输出按纯文本显示
- URL / Base URL / 节点地址必须校验，拒绝危险 scheme
- 不使用 `eval` / `new Function` / 动态注入脚本
- 不把敏感凭证存到 localStorage

### 性能

- 不全局引入完整 ECharts（已是按需引入）
- 精简 Vite optimizeDeps（已从 22 项减至 9 项）
- 避免 dashboard fan-out（已移除）
- 离开页面停止轮询和 WebSocket
- 大日志、大 JSON、大表格虚拟化或分页
- 首页粒子/网格动效用 CSS transform，不用 JS 运行时

---

## 九、文件操作清单

### 必须重写

| 文件 | 原因 |
|------|------|
| `src/styles/globals.css` | 配色 token 全面重做 |
| `src/features/home/home-view.tsx` | 首页重做（粒子动效 + Hero + 入口卡） |
| `src/features/dashboard/dashboard-view.tsx` | 仪表盘重做（新 KPI + 图表密度） |
| `src/features/jobs/job-detail-view.tsx` | 任务详情重做（深色分析模式） |
| `src/features/debug/debug-view.tsx` | GDB 调试重做（深色焦点舱） |
| `src/features/offline/offline-studio-view.tsx` | 离线工作台拆分子组件 |

### 必须新增

| 文件 | 原因 |
|------|------|
| `src/components/layout/dock.tsx` | 全局底部日志栏 |
| `src/components/common/error-toast.tsx` | 统一错误 toast |
| `src/components/common/error-detail-dialog.tsx` | 错误详情弹窗 |
| `src/components/common/kpi-card.tsx` | 新 KPI 卡片组件 |
| `src/components/common/severity-chip.tsx` | 状态/严重度标签 |

### 可保留（微调）

| 文件 | 状态 |
|------|------|
| `src/components/layout/sidebar.tsx` | 保留结构，微调视觉 |
| `src/components/layout/topbar.tsx` | 保留结构，微调视觉 |
| `src/components/layout/page-header.tsx` | 保留 |
| `src/features/jobs/jobs-view.tsx` | 保留，表格样式微调 |
| `src/features/jobs/job-create-view.tsx` | 保留 |
| `src/features/nodes/nodes-view.tsx` | 保留 |
| `src/features/settings/settings-view.tsx` | 保留 |
| `src/features/vuln-history/vuln-history-view.tsx` | 保留 |
| `src/lib/api/*` | 全部保留 |
| `src/stores/*` | 全部保留 |
| `src/types/api/*` | 全部保留 |
| `src/components/charts/*` | 保留 ECharts 封装 |

### 必须删除

| 文件 | 原因 |
|------|------|
| `src/components/common/operation-log-panel.tsx` | 被全局 Dock 替代 |
| `src/components/common/api-error-alert.tsx` | 被 error-toast + error-dialog 替代 |

---

## 十、分阶段实施计划

### 阶段 A：设计系统基础（CSS Token 重做）

**目标**：建立新的浅色 + 深色配色体系

1. 重写 `globals.css` — 新 token（深蓝主色 + 明橙辅色）
2. 重写 `ui-store.ts` — 增加 dock 状态
3. 验证：`npm run build`

### 阶段 B：全局日志栏（Dock）

**目标**：所有页面的内部日志框统一进入底部 Dock

1. 新增 `src/components/layout/dock.tsx`
2. 修改 `AppShell` 添加 Dock
3. 验证：`npm run build`

### 阶段 C：首页重做

**目标**：极简科幻入口页 + 粒子动效

1. 重写 `home-view.tsx` — 粒子/网格/协议流线动效
2. 修改路由：首页不使用 AppShell（全屏）
3. 验证：`npm run build`

### 阶段 D：控制台重做

**目标**：浅色高密度工作台 + 新 KPI + 图表

1. 新增 `kpi-card.tsx`、`severity-chip.tsx`
2. 重写 `dashboard-view.tsx` — 新 KPI + 图表密度
3. 微调 `sidebar.tsx`、`topbar.tsx` 视觉
4. 验证：`npm run build`

### 阶段 E：任务详情 + GDB 调试

**目标**：深色焦点分析舱

1. 重写 `job-detail-view.tsx` — 深色模式 + Dock 集成
2. 重写 `debug-view.tsx` — 深色分析舱
3. 验证：`npm run build`

### 阶段 F：离线工作台拆分

**目标**：1893 行 → 多个子组件

1. 拆分 `offline-studio-view.tsx` 为独立子组件
2. 统一使用 Dock 替代内部日志框
3. 验证：`npm run build`

### 阶段 G：错误反馈体系

**目标**：统一错误处理

1. 新增 `error-toast.tsx`、`error-detail-dialog.tsx`
2. 替换所有 `ApiErrorAlert`
3. 所有错误同步写入 Dock
4. 验证：`npm run build`

---

## 十一、建议写入 CLAUDE.md 的项目规则

见 `CLAUDE.md` 文件，已包含：
- 项目概述、命令、架构
- 设计范式（首页/控制台/分析舱三段式）
- 布局规则（固定骨架、响应式 token）
- API 规则（后端真实实现为准）
- 安全/性能规则
- 最终交付要求
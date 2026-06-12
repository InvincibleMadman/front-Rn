# 设计绑定映射表

## 一、读取的文件清单

### 前端源码

| 文件 | 用途 |
|------|------|
| `src/app/router.tsx` | 路由定义 |
| `src/components/layout/app-shell.tsx` | 应用壳层 Grid 布局 |
| `src/components/layout/sidebar.tsx` | 左侧导航栏 |
| `src/components/layout/topbar.tsx` | 顶部栏 |
| `src/components/layout/page-header.tsx` | 页面标题组件 |
| `src/components/common/operation-log-panel.tsx` | 日志面板 |
| `src/components/common/summary-card.tsx` | KPI 汇总卡片 |
| `src/components/common/status-badge.tsx` | 状态标签 |
| `src/components/common/json-viewer.tsx` | JSON 查看器 |
| `src/components/common/api-error-alert.tsx` | API 错误提示 |
| `src/components/charts/echarts-base.tsx` | ECharts 基础封装 |
| `src/components/charts/donut-chart.tsx` | 环形图 |
| `src/components/charts/line-area-chart.tsx` | 面积折线图 |
| `src/components/charts/bar-chart.tsx` | 柱状图 |
| `src/components/charts/task-timeline-chart.tsx` | 任务时间线 |
| `src/features/home/home-view.tsx` | 首页入口 |
| `src/features/dashboard/dashboard-view.tsx` | 控制台仪表盘 |
| `src/features/jobs/jobs-view.tsx` | 任务列表 |
| `src/features/jobs/job-create-view.tsx` | 创建任务 |
| `src/features/jobs/job-detail-view.tsx` | 任务详情/监控 |
| `src/features/debug/debug-view.tsx` | GDB 调试 |
| `src/features/offline/offline-studio-view.tsx` | 离线工作台 |
| `src/features/nodes/nodes-view.tsx` | 节点管理 |
| `src/features/settings/settings-view.tsx` | 系统设置 |
| `src/features/vuln-history/vuln-history-view.tsx` | 历史漏洞 |
| `src/lib/api/client.ts` | API 客户端 |
| `src/lib/api/services/*` | API 服务层 |
| `src/stores/ui-store.ts` | UI 状态管理 |
| `src/stores/workspace-store.ts` | 工作区状态 |
| `src/styles/globals.css` | 全局样式 + 主题 token |
| `src/types/api/*` | TypeScript 类型定义 |

### 设计参考图片

| 图片 | 用途 |
|------|------|
| `genr/1.png` | 首页结构基线（左 Hero + 右预览 + 下方入口卡） |
| `genr/2.png` | 安全/认证页（深色主题） |
| `genr/3.png` | 仪表盘结构基线（KPI + 图表 + 任务列表 + 日志） |
| `genr/4.png` | 离线工作台结构基线（表单 + 结果 + 日志） |
| `genr/5.png` | 任务详情/监控结构基线 |
| `genr/6.png` | GDB 调试结构基线（深色分析舱） |
| `ui案例/3fa3ae56...png` | 深色工业数字孪生（氛围参考） |
| `ui案例/bdfbfeca...png` | 深色科技背景（氛围参考） |
| `ui案例/50a36e8a...jpg` | WeHR 轻量侧栏 + 仪表盘 |
| `ui案例/82943305...jpg` | ET 工业大屏（深色 KPI + 图表） |
| `ui案例/95ad48ab...jpg` | Sugab Studio 仪表盘（环图 + 统计 + 活动） |
| `ui案例/8abc00b2...jpg` | Zenith Dashboard（KPI + 趋势图 + 环图 + 进度条） |
| `ui案例/ffbf94df...jpg` | Admin Dashboard（深蓝侧栏 + 表格 + 柱图） |
| `ui案例/19b01db8...jpg` | Pixel Mags 深色仪表盘（渐变 KPI + 趋势图 + 表格） |
| `ui案例/81818911...jpg` | Grafana Dashboards 列表 |
| `ui案例/b028ea80...jpg` | Grafana 深色侧栏 + 列表 |
| `ui案例/ffbf94df...jpg` | Grafana Play 深色入口 |
| `ui案例/IMG_1201.JPG` | 工业智能中枢仪表盘（浅色高密度） |
| `ui案例/IMG_1202.JPG` | 智能家居仪表盘（玻璃拟态） |
| `ui案例/IMG_1203.JPG` | 深色 KPI 仪表盘（渐变卡片 + 趋势） |
| `ui案例/IMG_1204.JPG` | 深色加密货币仪表盘（卡片 + 进度 + 表格） |
| `ui案例/IMG_1205.JPG` | 深色支付仪表盘（渐变条形图 + 列表） |
| `ui案例/IMG_1206.JPG` | 深色设置页（简洁卡片 + 表格） |
| `ui案例/IMG_1215.JPG` | Splunk 深色仪表盘（合规 + 图表 + 状态） |
| `ui案例/IMG_1216.JPG` | 浅色销售仪表盘（KPI + 趋势图 + 环图 + 进度） |
| `ui案例/IMG_1217.JPG` | 浅色仪表盘 + 通知弹窗 + 过滤表格 |

---

## 二、页面 -> 组件 -> 图片参考 -> 网站参考 -> 说明

### 2.1 首页 `/`

| 维度 | 映射 |
|------|------|
| **结构基线** | `genr/1.png` — 左侧 Hero 文案 + 右侧产品预览 + 下方入口能力卡 |
| **氛围参考** | `ui案例/3fa3ae56...png`（深色工业数字孪生）、`ui案例/bdfbfeca...png`（深色科技背景）— 仅借氛围，不做数字孪生 |
| **网站参考** | Apple 首页（标题留白节奏）、Vercel 首页（极简 CTA）、Figma 首页（产品展示区） |
| **借什么** | 左右分栏结构、大标题 + 副标题节奏、CTA 按钮层级、底部能力卡片网格、低强度背景粒子/网格 |
| **不借什么** | 不借 3D 工业大屏、不借营销站的 testimonials/pricing、不借登录表单 |
| **组件** | `HomeView` — Hero 区、状态胶囊、4 张入口卡片、底部 footer |
| **动效** | 低强度网格脉冲、协议流线粒子、节点脉冲、轻微视差（CSS transform） |
| **配色** | 深色背景（`#0a0f1a`）+ 亮色文字 + 主蓝渐变 + 辅橙点缀 |

### 2.2 应用壳层（AppShell + Sidebar + Topbar + Dock）

| 维度 | 映射 |
|------|------|
| **结构基线** | `genr/3.png`、`genr/4.png`、`genr/5.png`、`genr/6.png` — 固定左导航 + 固定顶栏 + 底部日志舱 |
| **Sidebar 参考** | `ui案例/50a36e8a...jpg`（WeHR 轻量侧栏）+ Linear Sidebar（高亮层级） |
| **Topbar 参考** | Google Cloud Console 顶部全局上下文栏 + `ui案例/50a36e8a...jpg` 简洁顶部 |
| **Dock 参考** | `genr/3.png`、`genr/4.png`、`genr/6.png` 底部日志区 + VS Code Terminal + Datadog Logs Explorer |
| **借什么** | 固定三栏骨架、折叠侧栏按钮、底部全局日志栏、高信息密度 |
| **不借什么** | 不借固定像素宽度、不借无展开按钮的收起态、不借内嵌日志框 |
| **组件** | `AppShell`（Grid）、`Sidebar`（折叠态）、`Topbar`（sticky）、`Dock`（可折叠日志栏） |
| **响应式** | CSS Variables + clamp() + Grid + flex/minmax(0,1fr) |

### 2.3 仪表盘 `/console`

| 维度 | 映射 |
|------|------|
| **结构基线** | `genr/3.png` — KPI 行 + 图表区 + 任务列表 + 日志区 |
| **KPI 卡片参考** | `ui案例/82943305...jpg`（ET 工业 KPI）、`ui案例/95ad48ab...jpg`（Sugab 统计卡）、`ui案例/IMG_1216.JPG`（销售 KPI） |
| **图表参考** | `ui案例/8abc00b2...jpg`（Zenith 趋势图 + 环图）、`ui案例/IMG_1201.JPG`（工业中枢仪表盘） |
| **网站参考** | Datadog Dashboard（KPI + 趋势图组合）、Grafana Dashboard（面板网格） |
| **借什么** | KPI 卡片带 sparkline、环图分布、趋势折线图、任务摘要列表、系统能力网格 |
| **不借什么** | 不借花哨渐变 KPI、不借过多装饰性动画 |
| **图表清单** | 趋势折线图（执行/覆盖/崩溃）、环图（任务状态/样本类型）、柱图（最新指标）、sparkline（KPI 卡片内） |
| **组件** | `DashboardView` — KpiCard、DonutChart、TaskTimelineChart、JobList、SystemCapabilities |

### 2.4 离线工作台 `/offline`

| 维度 | 映射 |
|------|------|
| **结构基线** | `genr/4.png` — 左侧步骤/表单 + 右侧结果/摘要 + 底部日志 |
| **视觉参考** | `ui案例/50a36e8a...jpg`、`ui案例/IMG_1215.JPG`（Splunk 面板）、`ui案例/IMG_1217.JPG`（表格过滤） |
| **网站参考** | Google Cloud Console 工作台组织（步骤 + 结果分栏） |
| **借什么** | 左右分栏、步骤表单、结果卡片、引用池列表、底部日志 |
| **不借什么** | 不借 1800 行巨型组件、不借固定高度 |
| **组件** | `OfflineStudioView` — 需拆分为子组件：ProtocolForm、SeedsForm、RiskForm、InstrumentForm、ResultPanel、RefPool |

### 2.5 任务列表 `/jobs`

| 维度 | 映射 |
|------|------|
| **结构基线** | `genr/3.png` 任务列表区 |
| **表格参考** | `ui案例/8abc00b2...jpg`（Zenith 表格）、`ui案例/IMG_1217.JPG`（过滤表格） |
| **网站参考** | Linear Issues 表格（轻量、可排序、行操作） |
| **借什么** | 轻量表格、状态标签、搜索过滤、分页 |
| **不借什么** | 不借复杂列分组、不借行内编辑 |
| **组件** | `JobsView` — SearchBar、StatusFilter、JobsTable |

### 2.6 任务详情 `/jobs/:id`

| 维度 | 映射 |
|------|------|
| **结构基线** | `genr/5.png` — 顶部指标 + 中部图表 + 事件/产物 + 日志 |
| **图表参考** | `ui案例/8abc00b2...jpg`（Zenith 趋势图）、`ui案例/95ad48ab...jpg`（Sugab 统计）、`ui案例/IMG_1216.JPG`（销售图表） |
| **网站参考** | Datadog Monitor Detail（趋势 + 状态 + 事件）、Grafana Panel（图表网格） |
| **借什么** | KPI 行、趋势折线图、环图、柱图、事件流列表、产物列表 |
| **不借什么** | 不借固定高度 `h-[620px]`、不借深色日志框（改用 Dock） |
| **图表清单** | 核心趋势（执行/覆盖/崩溃/挂起）、队列健康（待处理/循环）、样本占比环图、最新指标柱图、风险级别环图 |
| **组件** | `JobDetailView` — KpiMini、LineAreaChart、DonutChart、BarChart、EventList、ArtifactList |

### 2.7 GDB 调试 `/debug`

| 维度 | 映射 |
|------|------|
| **结构基线** | `genr/6.png` — 深色分析舱 |
| **深色参考** | `ui案例/19b01db8...jpg`（Pixel Mags 深色）、`ui案例/81818911...jpg`（Grafana 深色）、`ui案例/IMG_1203.JPG`（深色 KPI）、`ui案例/IMG_1204.JPG`（深色加密） |
| **网站参考** | VS Code Debug Panel（深色分析台）、Wiz/Snyk 安全分析页 |
| **借什么** | 深色背景、面板层次分明、日志区深色、报告区结构化 |
| **不借什么** | 不借浅色主题的卡片风格、不借工业 SCADA 风格 |
| **组件** | `DebugView` — 深色 header、CrashSeedSelector、DebugRequestForm、DebugReport、OperationLogPanel |

### 2.8 历史漏洞 `/vulns/history`

| 维度 | 映射 |
|------|------|
| **结构基线** | `genr/6.png` 表格区 |
| **表格参考** | `ui案例/IMG_1217.JPG`（过滤表格 + 详情面板） |
| **网站参考** | Wiz/Snyk 漏洞列表（severity chips + 筛选 + 详情） |
| **借什么** | 过滤器行、表格 + 详情分栏、severity 标签颜色 |
| **不借什么** | 不借复杂行内操作 |
| **组件** | `VulnHistoryView` — FilterBar、VulnTable、VulnDetail |

### 2.9 节点管理 `/nodes`

| 维度 | 映射 |
|------|------|
| **结构基线** | `genr/5.png` 配置区 |
| **视觉参考** | `ui案例/IMG_1206.JPG`（深色设置页）、`ui案例/50a36e8a...jpg`（WeHR 卡片） |
| **借什么** | 节点卡片、Ping 状态、表单 |
| **不借什么** | 不借复杂表单布局 |
| **组件** | `NodesView` — NodeCard、NodeForm、PingResult |

### 2.10 系统设置 `/settings`

| 维度 | 映射 |
|------|------|
| **结构基线** | `genr/5.png` 配置区 |
| **视觉参考** | `ui案例/IMG_1206.JPG`（深色设置页 Tab 布局） |
| **借什么** | Tab 分组、表单字段、开关行、JSON 折叠 |
| **不借什么** | 不借过度复杂的设置面板 |
| **组件** | `SettingsView` — SettingsForm、SwitchRow、ConfigJsonViewer |

---

## 三、配色方案参考

### 浅色主题

| 参考来源 | 借什么 |
|---------|--------|
| `genr/3.png` | 白色背景 + 浅灰卡片 + 深蓝侧栏 |
| `ui案例/8abc00b2...jpg` | 白底 + 深蓝主色 + 明橙辅助色 + 浅灰边框 |
| `ui案例/95ad48ab...jpg` | 白底 + 蓝色渐变 KPI + 浅色卡片 |
| `ui案例/IMG_1216.JPG` | 白底 + 深蓝主色 + 黑色数字 + 彩色图表 |

### 深色主题

| 参考来源 | 借什么 |
|---------|--------|
| `genr/6.png` | 深灰背景（`#0f1218`）+ 深色卡片（`#1a1f2e`）+ 蓝色强调 |
| `ui案例/19b01db8...jpg` | 深灰底 + 渐变 KPI + 青色/绿色图表线 |
| `ui案例/IMG_1203.JPG` | 深灰底 + 白色数字 + 霓虹色图表 |
| `ui案例/IMG_1204.JPG` | 深灰底 + 深色卡片 + 亮色文字 + 绿色进度条 |
| Grafana 深色 | 深蓝灰背景 + 高对比面板 + 橙色/绿色/蓝色数据色 |

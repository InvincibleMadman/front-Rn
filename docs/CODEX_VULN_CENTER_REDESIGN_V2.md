# 漏洞中心重构方案 V2（统计图表优先 / 列表遍历 / 详情查看）

> 仅允许修改 `front-Xe`。禁止修改 `fuzz-server-Xe`。
> Codex 工作目录为 `front-Xe` 根目录 `Xe`。
> 本文已经根据当前源码实现和成熟产品参考，固定了页面结构、组件职责、数据映射和修改顺序。不要让 Codex 再自行做交互规划。

---

## 一、先读当前源码，再开始改

必须先阅读这些文件，不能跳过：

- `src/features/vuln-history/vuln-history-view.tsx`
- `src/pages/vuln-history-page.tsx`
- `src/lib/api/services/vuln-history.ts`
- `src/lib/api/services/debug.ts`
- `src/lib/api/services/jobs.ts`
- `src/types/api/vuln-history.ts`
- `src/components/common/summary-card.tsx`
- `src/components/charts/bar-chart.tsx`
- `src/components/charts/donut-chart.tsx`
- `src/styles/globals.css`

当前真实页面结构（以源码为准，不要猜）：

1. 顶部 `PageHeader`
2. 第一行：4 个 `SummaryCard`
3. 第二行：左侧双 donut（`coarse_type` / `CWE`），右侧 `Crash / Risk / GDB` 汇总
4. 第三行：左筛选、中表格、右详情三栏

当前必须顺手修复的两个真实问题：

1. `historyQuery` 的 `queryKey` 只包含 `protocol` 和 `coarseType`，没有包含 `keyword`、`cwe`、`sortOrder`。现在切换关键字和 CWE 时不会正确触发独立缓存维度。
2. `src/lib/api/services/vuln-history.ts` 里的 `qs()` 没有把 `keyword` 和 `cwe` 写进 query string，所以当前关键字 / CWE 筛选实际上不会生效。

这两个问题与“列表遍历条目”直接相关，本次必须一起修复。

---

## 二、设计目标（这次必须严格遵守）

页面必须突出这 3 个核心点，优先级按顺序排列：

1. **总览漏洞 / crash 数与类型分布等统计图表**
2. **列表遍历条目**
3. **详情信息查看**

因此页面不能再按“4 小卡 + 双圆环 + 三栏”思路组织，而要改成：

- 首屏先给强统计感的总览区
- 第二优先级给分布图和 compact 汇总
- 第三优先级给列表浏览和右侧详情

不要再做我上一版那种“把统计过度弱化”的结构。

---

## 三、参考产品如何落地到本项目（不要照搬外观，学习结构）

### 1）GitHub Security Overview —— 学“顶部工具栏 + 筛选驱动整页”

落地方式：

- 不要让页面标题单独占一整行大空间。
- 页面顶部改为**紧凑工具栏**：左侧放“漏洞中心 / 协议 / 更新时间”，右侧放“刷新 / 导出 / 跳转报告”。
- 所有统计、列表、详情都由当前协议与筛选条件驱动。

### 2）Elastic CNVM / Findings —— 学“先关键统计，再分布，再 Findings 列表”

落地方式：

- 把“漏洞类型分布”提升为主分析图，不再使用两个 donut。
- 主图使用横向条形统计，更适合比较不同漏洞类型数量。
- 列表区要成为主工作区之一，不要把筛选区挤占太多空间。

### 3）Material 3 + Apple HIG —— 学“克制卡片、轻视觉、强层级”

落地方式：

- 顶部关键指标不能是大面积纯色块。
- 使用卡片基础背景 + 左 accent 条 + 内嵌 mini 可视化。
- 标题字号提高，数字醒目但不夸张。
- hover 只做轻边框增强，不做夸张动画。

---

## 四、固定信息架构（必须按这个布局做）

### 顶部：紧凑页面工具栏（单独一行，但不是大标题区）

布局：`左 70% / 右 30%`

左侧内容顺序固定：

1. `漏洞中心` 小标题
2. 当前协议选择器
3. 最近更新时间 / 当前记录数

右侧内容顺序固定：

1. 刷新按钮
2. 导出 / 查看报告入口
3. 如果已有报告页路由，使用按钮或 ghost button，不能改全局导航

实现要求：

- 不用单独的大 `PageHeader` 占一整块高度。
- 允许继续使用 `PageHeader` 组件，但要将 `title`、`description` 收紧为一行工具栏式布局；如果 `PageHeader` 不好复用，则只在本页内改为普通 `Card` 顶部工具栏，不要动全局 `PageHeader` 组件。

---

## 五、第一行：关键指标总览区（替代旧 4 张平权小卡）

这一行不是简单 4 等宽卡。改成 **1 个大总览卡 + 3 个紧凑指标卡**。

布局固定：

- 左侧 `Overview Hero Card` 占 `56% ~ 62%`
- 右侧三张紧凑指标卡纵向排列，占 `38% ~ 44%`
- 小屏降级为上下堆叠

### A. 左侧大卡：Overview Hero Card

这是整页第一视觉中心，必须突出 **漏洞总数 + crash 总数**。

内部布局固定为两列：

#### 左半部分：核心数字

从上到下：

1. 小标题：`运行产出总览`
2. 大数字行：
   - 左：`漏洞记录` 数量（来自 `records.length`）
   - 右：`Crash 相关` 数量（来自 `jobsSummaryQuery.data?.crash_count ?? 0`）
3. 副说明一行：当前协议、最近更新时间、是否有高置信度记录

#### 右半部分：总览 mini composition bar

不要使用图表库，使用纯 `div + CSS grid + width` 实现一个**横向分段堆叠条**。

固定分段来源：

- `highConfidence`
- `protocolMachine`
- `memoryRelated`
- `others = total - above dedup-aware sum`（注意不能简单减法重复计数；如果无法精确去重，就只把这条定义为 `remaining records`，基于不属于上面 3 类的 `coarse_type` 计算）

显示规则：

- 整条高度 `10px ~ 12px`
- 底层永远有轨迹底色
- 每段用低饱和 token 色，不允许荧光高饱和
- 下方显示 4 个 legend chips：label + count
- 当 `total = 0` 时，只显示轨迹条与 `0 records`

### B. 右侧三张紧凑指标卡（竖排）

顺序固定：

1. 高置信度
2. 协议状态机
3. 内存相关

每张卡的结构必须一致：

- 左上：标题
- 左下：数字 + 简短说明
- 右侧：一个轻量 mini 可视化

#### 高置信度卡 mini 可视化：mini progress gauge

不要用图表库，直接用 CSS `conic-gradient` + 内层圆实现环形 gauge。

映射：

- 百分比 = `highConfidence / total`
- 若 `total = 0`，显示空态圆环，不显示彩色填充
- 圆环尺寸 `46px ~ 56px`

#### 协议状态机卡 mini 可视化：node-link glyph

使用纯 CSS + 3 个小圆点 + 2 条连接线组成状态机 glyph：

- 当数量为 0：3 个节点全部低亮
- 数量 > 0：前 1 个节点高亮
- 数量 >= 3：前 2 个节点高亮
- 数量 >= 6：3 个节点全高亮

注意：它不是精确图表，只是语义 glyph，表达“状态链路存在”。

#### 内存相关卡 mini 可视化：segmented memory bar

使用 6 到 8 个小矩形块：

- 高亮块数 = `round(memoryRelated / max(total,1) * segmentCount)`
- 块与块之间保留 4px 间距
- 当总数为 0，只显示浅轨迹块

---

## 六、第二行：主分析区（重点是类型分布，不再是双圆环）

布局固定：

- 左侧 `Type Distribution Panel`：`62% ~ 68%`
- 右侧 `Compact Summary Panel`：`32% ~ 38%`

### A. 左侧：漏洞类型分布条形统计图（主视觉）

**必须删除两个 donut**。

**必须改成横向条形统计图**。

不能继续用 ECharts donut。优先使用纯 `div` 条形图，降低加载成本。

#### 数据来源

优先使用：

- `summaryQuery.data?.by_coarse_type`

如果已有 summary 结构不完整，则增加一个前端归一化函数：

```ts
function normalizeVulnerabilityTypeCounts(
  summary: Record<string, unknown> | undefined,
  records: VulnHistoryRecord[],
): Array<{ key: string; label: string; count: number }> {
  const baseOrder = [
    "memory-corruption",
    "protocol-state-machine",
    "parser-state",
    "bounds-check",
    "null-deref",
    "use-after-free",
    "integer-issue",
    "resource-exhaustion",
    "auth-logic",
    "unknown",
  ];

  const summaryMap = (summary?.by_coarse_type as Record<string, number> | undefined) ?? {};
  const fallbackMap = records.reduce<Record<string, number>>((acc, item) => {
    const key = String(item.coarse_type ?? "unknown");
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const source = Object.keys(summaryMap).length ? summaryMap : fallbackMap;

  return baseOrder.map((key) => ({
    key,
    label: key,
    count: Number(source[key] ?? 0),
  }));
}
```

Codex 必须保留这个函数名，不要改名。

#### 视觉规则

每一行固定三段：

- 左：类型名
- 中：bar track + fill
- 右：数量

实现规则：

- 使用 `grid-template-columns: minmax(128px, 1.15fr) minmax(220px, 3fr) 56px`
- bar 轨迹高度 `10px`
- fill 高度与轨迹一致
- 轨迹底色使用 `border/input/muted` 组合，不要纯黑纯白
- fill 颜色使用按类型映射的低饱和 token
- 类型数量为 0 也必须显示浅轨迹，保证结构稳定
- 若最大值为 0，则所有行都只显示轨迹，不显示彩色 fill
- 默认按数量降序，但 `unknown` 固定放最后；若需要稳定顺序，则“有值的按数量降序 + 无值按 baseOrder 尾部保持”

#### 类型颜色映射（只能用 CSS 变量，不要写死 hex）

建议：

- memory-corruption → `hsl(var(--accent-orange) / 0.72)`
- protocol-state-machine → `hsl(var(--accent-pink) / 0.72)`
- parser-state → `hsl(var(--accent-blue) / 0.72)`
- bounds-check → `hsl(var(--chart-3) / 0.72)`
- null-deref → `hsl(var(--color-danger) / 0.66)`
- use-after-free → `hsl(var(--chart-5) / 0.72)`
- integer-issue → `hsl(var(--chart-6) / 0.72)`
- resource-exhaustion → `hsl(var(--chart-4) / 0.72)`
- auth-logic → `hsl(var(--accent-blue) / 0.52)`
- unknown → `hsl(var(--muted-foreground) / 0.42)`

### B. 右侧：Compact Summary Panel

这一块不是大图，不占太大面积。固定拆成两个子块：

#### 上半：Top CWE / 最近记录摘要

显示：

- Top 3 CWE chips
- 最近 7 天记录数
- 最新一条记录时间

#### 下半：Crash / Risk / GDB compact summary rail

必须缩小，不准再留大空白。

结构固定为 3 行：

- Crash
- Risk
- GDB

每一行固定 4 列：

1. 小色点 / 小图标
2. label
3. count
4. mini progress 或 trend mark

规则：

- 每行高 `36px ~ 42px`
- 统一圆角背景，不能拆成 3 大块
- 总面积不超过第二行右侧面板下半区
- 如果没有 Risk summary 真值，就显示 `-`，不要伪造

---

## 七、第三行：条目列表 + 详情信息查看

这是页面的主工作区。布局固定：

- 左：`Records List Panel` 占 `58% ~ 64%`
- 右：`Detail Panel` 占 `36% ~ 42%`

### A. 左侧 Records List Panel

不要再保留独立左筛选栏占一整列。

筛选控件必须上移到列表卡头部区域，做成**内嵌筛选工具条**。

卡头布局：

- 第一行：标题 + 记录总数 + group by
- 第二行：协议、类型、关键词、CWE、排序（紧凑排布）

这样可以把横向空间让给列表本体。

#### 列表呈现方式

保留 Table 方案，不要发明复杂瀑布流。

但要做 4 个改进：

1. 当前选中行必须有明显 active 状态（边框或背景增强）
2. 第一列标题区增加副文本（crash signature）
3. “关联”列改为 badge 行，不再是 2 句纯文本
4. 表头 sticky 保留

建议列：

- 标题
- 类型
- CWE
- 关联
- 位置
- 时间

### B. 右侧 Detail Panel

右侧详情继续保留，不能降级成抽屉。

但内容顺序要更清晰：

1. 根因摘要（仍保留当前彩色 detail hero 的思路，但面积适度收紧）
2. 定位
3. PoC / 修复建议
4. 会话关联
5. 原始详情折叠区

要求：

- `details/summary` 的原始 JSON 折叠区继续保留
- 右侧面板在桌面端使用 `sticky top-*`，跟随主容器滚动区，不要固定到全局 topbar 上

---

## 八、组件级实现说明（写给 Codex，禁止自由发挥）

### 1）不要新引入依赖

禁止新增：

- 新图表库
- 新 UI 库
- 新状态管理
- 新 CSS-in-JS 方案

### 2）允许新增的文件范围

推荐只改这些文件：

- `src/features/vuln-history/vuln-history-view.tsx`
- `src/lib/api/services/vuln-history.ts`
- `src/styles/globals.css`

如果你觉得 `vuln-history-view.tsx` 太长，允许新增：

- `src/features/vuln-history/vuln-history-visuals.tsx`

但不要拆太多文件。

### 3）顶部总览卡不要复用 `SummaryCard`

原因：

- `SummaryCard` 是统一彩色壳子，不适合这次“轻底色 + 内嵌 mini visual”的要求。
- 本页需要新的视觉层级。

因此：

- 只在本页新增本地卡片结构
- 不要修改全局 `SummaryCard` 组件，以免影响 dashboard 等其他页面

### 4）主分布图不要复用 donut-chart.tsx

因为：

- 这次明确要去掉双圆环
- 条形统计用纯 `div` 更轻
- 可避免 ECharts 在本页首屏多图表开销

### 5）只在 `globals.css` 新增本页专属 class

新增 class 命名统一用：

- `.vuln-center-*`

禁止修改已有：

- `.summary-card-*`
- `.shell-topbar`
- `.glass-card`
- `.console-data-card`

除非只是新增不影响旧值。

---

## 九、必须给 Codex 的代码原型（直接照着做）

### 1）修复 query string 的最小改法

```ts
function qs(params: { coarse_type?: string; keyword?: string; cwe?: string; limit?: number; offset?: number }): string {
  const query = new URLSearchParams();
  (Object.entries(params) as Array<[string, string | number | undefined]>).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  const text = query.toString();
  return text ? `?${text}` : "";
}
```

`historyQuery` 的 `queryKey` 改为：

```ts
queryKey: ["vuln-history", protocol, coarseType, keyword, cwe, sortOrder]
```

### 2）类型条形统计的组件原型

```tsx
function VulnerabilityTypeBars({
  items,
}: {
  items: Array<{ key: string; label: string; count: number; toneClass: string }>;
}): JSX.Element {
  const max = Math.max(...items.map((item) => item.count), 0);

  return (
    <div className="vuln-center-type-bars">
      {items.map((item) => {
        const width = max > 0 ? `${(item.count / max) * 100}%` : "0%";
        return (
          <div key={item.key} className="vuln-center-type-row">
            <div className="vuln-center-type-label">{item.label}</div>
            <div className="vuln-center-type-track">
              <div className={`vuln-center-type-fill ${item.toneClass}`} style={{ width }} />
            </div>
            <div className="vuln-center-type-count">{item.count}</div>
          </div>
        );
      })}
    </div>
  );
}
```

### 3）compact summary rail 原型

```tsx
function CompactSummaryRail({
  rows,
}: {
  rows: Array<{ label: string; count: string; toneClass: string; mark?: string }>;
}): JSX.Element {
  return (
    <div className="vuln-center-summary-rail">
      {rows.map((row) => (
        <div key={row.label} className="vuln-center-summary-row">
          <span className={`vuln-center-summary-dot ${row.toneClass}`} />
          <span className="vuln-center-summary-label">{row.label}</span>
          <span className="vuln-center-summary-count">{row.count}</span>
          <span className="vuln-center-summary-mark">{row.mark ?? "—"}</span>
        </div>
      ))}
    </div>
  );
}
```

### 4）高置信度 gauge 原型

```tsx
function MiniGauge({ ratio, toneClass }: { ratio: number; toneClass: string }): JSX.Element {
  const safe = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
  return (
    <div
      className={`vuln-center-mini-gauge ${toneClass}`}
      style={{ ["--gauge-progress" as string]: `${safe * 360}deg` }}
      aria-hidden="true"
    >
      <div className="vuln-center-mini-gauge-inner" />
    </div>
  );
}
```

CSS 原型：

```css
.vuln-center-mini-gauge {
  width: 52px;
  height: 52px;
  border-radius: 999px;
  background:
    conic-gradient(var(--gauge-fill) 0deg var(--gauge-progress), hsl(var(--border) / 0.5) var(--gauge-progress) 360deg);
  display: grid;
  place-items: center;
}

.vuln-center-mini-gauge-inner {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border) / 0.75);
}
```

### 5）状态机 glyph 原型

```tsx
function StateMachineGlyph({ level }: { level: 0 | 1 | 2 | 3 }): JSX.Element {
  return (
    <div className="vuln-center-state-glyph" aria-hidden="true">
      <span className={`node ${level >= 1 ? "active" : ""}`} />
      <span className={`link ${level >= 2 ? "active" : ""}`} />
      <span className={`node ${level >= 2 ? "active" : ""}`} />
      <span className={`link ${level >= 3 ? "active" : ""}`} />
      <span className={`node ${level >= 3 ? "active" : ""}`} />
    </div>
  );
}
```

---

## 十、分步提示词（按顺序发给 Codex）

## 第 1 步：修复当前页面的筛选与数据归一化基础

```text
你现在工作在 front-Xe 根目录 Xe。
本步骤只允许修改 front-Xe，不要修改 fuzz-server-Xe。

任务：先修复漏洞中心页面的数据筛选基础，不做视觉大改。

必须先阅读：
- src/features/vuln-history/vuln-history-view.tsx
- src/lib/api/services/vuln-history.ts
- src/types/api/vuln-history.ts

强制要求：
1. 修复 src/lib/api/services/vuln-history.ts 里的 qs()，把 keyword 和 cwe 一并写入 query string。
2. 修复 vuln-history-view.tsx 中 historyQuery 的 queryKey，使其至少包含：protocol、coarseType、keyword、cwe、sortOrder。
3. 在 vuln-history-view.tsx 内新增 normalizeVulnerabilityTypeCounts(summary, records) 函数，函数名必须完全一致。
4. 该函数优先使用 summary.by_coarse_type；为空时退化为 records 中 coarse_type 的前端聚合。
5. 不要改变任何后端 API，不要更改接口路径。
6. 本步骤完成后只保证数据层正确，不做大规模布局修改。

静态检查：
cd front-Xe
npm exec tsc -- -p tsconfig.app.json --noEmit

输出：
- 修改的文件列表
- qs 修复说明
- queryKey 修复说明
- normalizeVulnerabilityTypeCounts 的实现说明
完成后停止。
```

## 第 2 步：重构顶部为“紧凑工具栏 + 总览 Hero + 右侧三指标卡”

```text
你现在继续工作在 front-Xe 根目录 Xe。
本步骤只允许修改 front-Xe，不要修改 fuzz-server-Xe。

任务：重构漏洞中心页面顶部区域，删除旧的 4 张 SummaryCard 布局，改成“紧凑工具栏 + 左大总览卡 + 右侧 3 张紧凑指标卡”。

必须先阅读：
- src/features/vuln-history/vuln-history-view.tsx
- src/styles/globals.css
- src/components/common/summary-card.tsx
- src/components/ui/card.tsx

设计必须固定如下：
1. 顶部不再使用大标题独立一整块空间。
2. 页面最顶部改成紧凑工具栏：
   - 左侧：漏洞中心、小协议选择器、更新时间/记录数
   - 右侧：刷新、导出/查看报告入口
3. 删除旧的 4 个 SummaryCard 调用。
4. 第一行改成：
   - 左侧 Overview Hero Card，占 56%~62%
   - 右侧三张竖排紧凑指标卡，占 38%~44%
5. Overview Hero Card 内必须突出：
   - 漏洞记录总数（records.length）
   - Crash 相关数量（jobsSummaryQuery.data?.crash_count ?? 0）
   - 一个横向 mini composition bar，表示 highConfidence / protocolMachine / memoryRelated / remaining
6. 右侧三张指标卡顺序固定：
   - 高置信度：CSS conic-gradient mini gauge
   - 协议状态机：3 node + 2 link 的 state machine glyph
   - 内存相关：segmented memory bar
7. 不允许继续使用大面积纯色 summary-card-shell 作为顶部主视觉。
8. 不能修改全局 SummaryCard 组件，新的顶部卡片只在本页内部实现。
9. 需要继承现有浅深主题变量，文本颜色必须跟随主题。
10. hover 仅允许轻边框高亮，不允许大动画。

请在 globals.css 仅新增本页专属 class，统一前缀：
- .vuln-center-*

禁止删除或修改已有全局 class 的旧语义。

静态检查：
cd front-Xe
npm exec tsc -- -p tsconfig.app.json --noEmit

输出：
- 新顶部结构说明
- Overview Hero Card 的内部布局
- 三张指标卡各自 mini 可视化实现方式
- 新增的 .vuln-center-* class 列表
完成后停止。
```

## 第 3 步：删掉双圆环，改成横向条形统计主分析区

```text
你现在继续工作在 front-Xe 根目录 Xe。
本步骤只允许修改 front-Xe，不要修改 fuzz-server-Xe。

任务：删除漏洞中心中的两个 donut 圆环，改成“左侧横向条形统计主图 + 右侧 compact summary panel”。

必须先阅读：
- src/features/vuln-history/vuln-history-view.tsx
- src/components/charts/donut-chart.tsx
- src/components/charts/bar-chart.tsx
- src/styles/globals.css

本步骤严格按以下方案执行：
1. 删除页面中 coarse_type donut 与 cwe donut 的双圆环布局。
2. 新主分析区布局固定：
   - 左侧 Type Distribution Panel，占 62%~68%
   - 右侧 Compact Summary Panel，占 32%~38%
3. 左侧主图必须使用纯 div + CSS 实现横向条形统计，不要引入新依赖。
4. 数据来自 normalizeVulnerabilityTypeCounts(summaryQuery.data, records)。
5. 每一行固定三段：类型名 / bar / 数量。
6. 类型数量为 0 时仍显示浅轨迹条，保持稳定结构。
7. 最大值为 0 时所有条都只显示轨迹，不显示彩色填充。
8. 颜色只能使用 CSS 变量组合，不允许写死高饱和 hex。
9. 右侧 Compact Summary Panel 固定包含：
   - Top 3 CWE chips
   - 最近 7 天记录数
   - 最新一条记录时间
   - Crash / Risk / GDB compact summary rail
10. Crash / Risk / GDB compact summary rail 必须是 3 行紧凑结构，不能再占大面积空白。
11. 本步骤不要动第三行列表与详情区。

若现有页面已有 EchartsBase 引用，只删除本页对 donut 的依赖，不要影响其他页面。

静态检查：
cd front-Xe
npm exec tsc -- -p tsconfig.app.json --noEmit

输出：
- 双圆环删除说明
- 新横向条形统计图的数据映射说明
- Compact Summary Panel 的内部结构
- Crash / Risk / GDB 为何缩小、如何缩小
完成后停止。
```

## 第 4 步：把筛选并入列表卡头，重构“列表遍历条目 + 详情查看”

```text
你现在继续工作在 front-Xe 根目录 Xe。
本步骤只允许修改 front-Xe，不要修改 fuzz-server-Xe。

任务：把漏洞中心第三行改成“左列表 + 右详情”，取消独立左筛选栏，把筛选并入列表卡头。

必须先阅读：
- src/features/vuln-history/vuln-history-view.tsx
- src/components/ui/table.tsx
- src/components/common/status-badge.tsx
- src/components/common/json-viewer.tsx
- src/styles/globals.css

设计固定如下：
1. 删除当前左侧独立“筛选条件”卡片。
2. 第三行改成两栏：
   - 左侧 Records List Panel，占 58%~64%
   - 右侧 Detail Panel，占 36%~42%
3. 筛选控件并入列表卡头：
   - 第一行：标题、记录总数、group by（如果不做真正分组，可先保留入口但不启用复杂逻辑）
   - 第二行：协议、类型、关键词、CWE、排序
4. 表格保留 Table 方案，不要改成瀑布流。
5. 表格必须增强：
   - 当前选中行 active 态明显
   - 第一列保留标题 + crash signature 副文本
   - 关联列改为 badge 行，不再是 2 句纯文本
   - sticky 表头保留
6. 右侧详情区继续保留，不做抽屉，不跳转页面。
7. 详情区内容顺序固定：
   - 根因摘要
   - 定位
   - PoC / 修复建议
   - 会话关联
   - 原始详情折叠区
8. 右侧详情区桌面端使用 sticky，但只相对于主滚动容器，不要去改全局 topbar 或 shell 布局。
9. 不要删除 JsonViewer 和原始详情折叠区。

静态检查：
cd front-Xe
npm exec tsc -- -p tsconfig.app.json --noEmit

输出：
- 筛选栏如何并入列表卡头
- 列表遍历体验如何增强
- 详情区如何保持稳定查看
完成后停止。
```

## 第 5 步：样式收口与最终检查

```text
你现在继续工作在 front-Xe 根目录 Xe。
本步骤只允许修改 front-Xe，不要修改 fuzz-server-Xe。

任务：对漏洞中心重构结果做样式收口，确保浅深主题、字体颜色、边框层级和响应式都正常；不得波及其他页面。

必须先阅读：
- src/features/vuln-history/vuln-history-view.tsx
- src/styles/globals.css

要求：
1. 所有新增 class 必须统一为 .vuln-center-* 前缀。
2. 所有文本颜色必须使用现有 token：foreground / muted-foreground / text-primary / text-secondary 等，不允许硬编码颜色。
3. 所有背景和边框必须继承 card / border / muted / input 等变量。
4. 所有 mini visual 的颜色必须可在浅深主题自动切换。
5. 仅允许新增样式，不允许破坏 dashboard、assets、debug、jobs 等已有页面。
6. 检查小屏响应式：
   - 顶部 Hero 与三指标卡可以折叠为上下布局
   - 主分析区可折叠为上下布局
   - 列表与详情区可折叠为上下布局
7. 不得引入新的运行依赖。

最终静态检查：
cd front-Xe
npm exec tsc -- -p tsconfig.app.json --noEmit

最终输出必须包含：
- 修改/新增文件列表
- 新漏洞中心布局分区
- 顶部总览 Hero 与三指标卡的可视化方式
- 漏洞类型分布如何从双圆环改为横向条形统计
- 旧 API 数据如何映射
- Crash / Risk / GDB 汇总如何缩小
- 关键筛选 bug 修复说明
- 静态检查结果
完成后停止。
```

---

## 十一、这次不要做的事情

- 不要修改后端
- 不要新增依赖
- 不要把页面改成完全不同的路由
- 不要重写全局 PageHeader / SummaryCard / shell 布局
- 不要把详情区删掉或弹窗化
- 不要继续保留双圆环
- 不要让 Crash / Risk / GDB 汇总占据大面积空白
- 不要把筛选栏继续独立占一整列
- 不要写死不随主题变化的文本颜色


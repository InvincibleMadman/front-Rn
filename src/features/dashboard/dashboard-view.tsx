import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Bug,
  DatabaseZap,
  FileText,
  Gauge,
  Network,
  Radar,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { DashboardMetricRing } from "@/features/dashboard/dashboard-metric-ring";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/common/status-badge";
import {
  EchartsBase,
  useEchartsPalette,
  type ChartOption,
} from "@/components/charts/echarts-base";
import { dashboardApi } from "@/lib/api/services/dashboard";
import { cn } from "@/lib/utils/cn";
import { formatDateTime, formatNumber } from "@/lib/utils/format";
import type { DashboardMetricOverview } from "@/types/api/dashboard";

const EMPTY_METRICS: DashboardMetricOverview = {
  nodeStatus: {
    total: 0,
    online: 0,
    offline: 0,
    checking: 0,
    onlineRate: 0,
    onlinePercent: 0,
  },
  protocolAssets: { total: 0, byScope: {}, byKind: {}, protocolCount: 0 },
  runningJobs: {
    running: 0,
    total: 0,
    byStatus: {},
    recentJobs: [],
    trend: [],
  },
  crashFindings: {
    crashes: 0,
    hangs: 0,
    totalFindings: 0,
    byKind: { crash: 0, hang: 0 },
    recentFindings: [],
    trend: [],
  },
  vulnerabilities: {
    total: 0,
    highConfidence: 0,
    byCoarseType: {},
    byCwe: {},
    recentRecords: [],
  },
  debugSessions: { total: 0, byStatus: {}, byCoarseType: {} },
  reports: { total: 0, byKind: {}, recentReports: [] },
};

interface ChipItem {
  label: string;
  value: string | number;
  variant?:
    | "default"
    | "secondary"
    | "success"
    | "danger"
    | "warning"
    | "outline";
}

interface MetricCardProps {
  title: string;
  value: string;
  description: string;
  icon: typeof Activity;
  option?: ChartOption;
  chips?: ChipItem[];
  hero?: boolean;
  accent?: "blue" | "cyan" | "emerald" | "amber" | "violet" | "rose" | "slate";
  chartHeight?: number | string;
  ring?: {
    value: number;
    max: number;
    centerValue: string | number;
    label?: string;
    size?: number | string;
    strokeWidth?: number;
  };
}

function emptySparklineOption(color = "#94a3b8"): ChartOption {
  const values = [2, 2, 2, 2, 2, 2, 2];

  return {
    color: [color],
    grid: { left: 4, right: 4, top: 16, bottom: 4 },
    tooltip: { show: false },
    xAxis: {
      type: "category",
      data: values.map((_, index) => String(index + 1)),
      boundaryGap: false,
      show: false,
    },
    yAxis: { type: "value", show: false, min: 0, max: 4 },
    series: [
      {
        type: "line",
        data: values,
        smooth: true,
        symbol: "none",
        silent: true,
        animation: false,
        lineStyle: { width: 3, opacity: 0.42, type: "dashed" },
        areaStyle: { opacity: 0.08 },
      },
    ],
  };
}

function emptyVerticalBarsOption(color = "#94a3b8"): ChartOption {
  return {
    color: [color],
    grid: { left: 4, right: 4, top: 16, bottom: 4 },
    tooltip: { show: false },
    xAxis: { type: "category", data: ["A", "B", "C", "D", "E"], show: false },
    yAxis: { type: "value", show: false, min: 0, max: 4 },
    series: [
      {
        type: "bar",
        data: [2, 2, 2, 2, 2],
        barWidth: 9,
        silent: true,
        animation: false,
        itemStyle: { opacity: 0.24, borderRadius: [6, 6, 0, 0] },
      },
    ],
  };
}

function emptySegmentedBarOption(colors: string[]): ChartOption {
  const palette = colors.length ? colors : ["#94a3b8"];

  return {
    color: palette,
    grid: { left: 4, right: 4, top: 30, bottom: 4 },
    tooltip: { show: false },
    xAxis: {
      type: "value",
      show: false,
      min: 0,
      max: Math.max(palette.length, 1),
    },
    yAxis: { type: "category", data: [""], show: false },
    series: palette.slice(0, 4).map((_, index) => ({
      name: `Empty ${index + 1}`,
      type: "bar",
      stack: "total",
      data: [1],
      barWidth: 18,
      silent: true,
      animation: false,
      itemStyle: { opacity: 0.22, borderRadius: 8 },
    })),
  };
}

function emptyHorizontalBarsOption(color = "#94a3b8"): ChartOption {
  return {
    color: [color],
    grid: { left: 14, right: 8, top: 10, bottom: 10 },
    tooltip: { show: false },
    xAxis: { type: "value", show: false, min: 0, max: 4 },
    yAxis: { type: "category", data: ["", "", ""], show: false },
    series: [
      {
        type: "bar",
        data: [2, 2, 2],
        barWidth: 8,
        silent: true,
        animation: false,
        itemStyle: { opacity: 0.24, borderRadius: [0, 8, 8, 0] },
      },
    ],
  };
}

function emptyDonutOption(centerText = "0", color = "#94a3b8"): ChartOption {
  return {
    color: [color, "rgba(148, 163, 184, 0.18)"],
    tooltip: { show: false },
    graphic: {
      type: "text",
      left: "center",
      top: "center",
      style: { text: centerText, fill: color, fontSize: 16, fontWeight: 800 },
    },
    series: [
      {
        name: centerText,
        type: "pie",
        radius: ["62%", "82%"],
        center: ["50%", "50%"],
        silent: true,
        animation: false,
        label: { show: false },
        labelLine: { show: false },
        data: [
          { name: "Empty", value: 1 },
          { name: "Rest", value: 3 },
        ],
      },
    ],
  };
}

function recordTotal(record: Record<string, number>): number {
  return Object.values(record).reduce(
    (sum, value) => sum + (Number.isFinite(value) ? value : 0),
    0,
  );
}

function topRecordEntries(
  record: Record<string, number>,
  limit = 4,
): Array<[string, number]> {
  return Object.entries(record)
    .filter(([, value]) => Number.isFinite(value) && value > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit);
}

function firstNonEmptyRecord(
  ...records: Array<Record<string, number>>
): Record<string, number> {
  return records.find((record) => recordTotal(record) > 0) ?? {};
}

function compactTime(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(5, 16).replace("T", " ");
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function sparklineOption(
  points: Array<{ time: string; value: number }>,
  palette: string[],
  _fallbackTitle: string,
): ChartOption {
  if (!points.length) return emptySparklineOption(palette[0]);
  return {
    color: [palette[0]],
    grid: { left: 4, right: 4, top: 16, bottom: 4 },
    tooltip: { trigger: "axis", formatter: "{b}<br/>Value: {c}" },
    xAxis: {
      type: "category",
      data: points.map((point) => compactTime(point.time)),
      boundaryGap: false,
      show: false,
    },
    yAxis: { type: "value", show: false, min: 0 },
    series: [
      {
        type: "line",
        data: points.map((point) => point.value),
        smooth: true,
        symbol: "none",
        lineStyle: { width: 3 },
        areaStyle: { opacity: 0.18 },
      },
    ],
  };
}

function segmentedBarOption(
  record: Record<string, number>,
  palette: string[],
  _fallbackTitle: string,
): ChartOption {
  const entries = topRecordEntries(record, 5);
  if (!entries.length) return emptySegmentedBarOption(palette);
  return {
    color: palette,
    grid: { left: 4, right: 4, top: 30, bottom: 4 },
    tooltip: { trigger: "item" },
    xAxis: {
      type: "value",
      show: false,
      max: Math.max(recordTotal(record), 1),
    },
    yAxis: { type: "category", data: [""], show: false },
    series: entries.map(([name, value]) => ({
      name,
      type: "bar",
      stack: "total",
      data: [value],
      barWidth: 18,
      itemStyle: { borderRadius: 8 },
    })),
  };
}

function donutOption(
  entries: Array<{ name: string; value: number }>,
  centerText: string,
  palette: string[],
  _fallbackTitle: string,
): ChartOption {
  const data = entries.filter(
    (entry) => Number.isFinite(entry.value) && entry.value > 0,
  );
  if (!data.length) return emptyDonutOption(centerText, palette[0]);
  return {
    color: palette,
    tooltip: { trigger: "item", formatter: "{b}: {c}" },
    graphic: {
      type: "text",
      left: "center",
      top: "center",
      style: {
        text: centerText,
        fill: palette[0],
        fontSize: 18,
        fontWeight: 800,
      },
    },
    series: [
      {
        type: "pie",
        radius: ["62%", "82%"],
        center: ["50%", "50%"],
        label: { show: false },
        labelLine: { show: false },
        data,
      },
    ],
  };
}

function horizontalBarsOption(
  record: Record<string, number>,
  palette: string[],
  _fallbackTitle: string,
  limit = 4,
): ChartOption {
  const entries = topRecordEntries(record, limit).reverse();
  if (!entries.length) return emptyHorizontalBarsOption(palette[0]);
  return {
    color: [palette[0]],
    grid: { left: 64, right: 8, top: 8, bottom: 10 },
    tooltip: { trigger: "axis" },
    xAxis: { type: "value", show: false, min: 0 },
    yAxis: {
      type: "category",
      data: entries.map(([name]) => name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        fontSize: 10,
        color: "#94a3b8",
        width: 58,
        overflow: "truncate",
      },
    },
    series: [
      {
        type: "bar",
        data: entries.map(([, value]) => value),
        barWidth: 8,
        itemStyle: { borderRadius: [0, 8, 8, 0] },
      },
    ],
  };
}

function discoveryBarsOption(
  points: Array<{ time: string; crashes: number; hangs: number }>,
  byKind: { crash: number; hang: number },
  palette: string[],
): ChartOption {
  if (points.length) {
    return {
      color: [palette[3], palette[4]],
      grid: { left: 4, right: 4, top: 16, bottom: 4 },
      tooltip: { trigger: "axis" },
      xAxis: {
        type: "category",
        data: points.map((point) => compactTime(point.time)),
        show: false,
      },
      yAxis: { type: "value", show: false, min: 0 },
      series: [
        {
          name: "Crash",
          type: "bar",
          stack: "findings",
          data: points.map((point) => point.crashes),
          barWidth: 10,
          itemStyle: { borderRadius: [6, 6, 0, 0] },
        },
        {
          name: "Hang",
          type: "bar",
          stack: "findings",
          data: points.map((point) => point.hangs),
          barWidth: 10,
          itemStyle: { borderRadius: [6, 6, 0, 0] },
        },
      ],
    };
  }
  const crashHangRecord = { Crash: byKind.crash, Hang: byKind.hang };
  if (recordTotal(crashHangRecord) > 0) {
    return segmentedBarOption(
      crashHangRecord,
      [palette[3], palette[4]],
      "No findings",
    );
  }
  return emptyVerticalBarsOption(palette[3]);
}

function riskOption(
  metrics: DashboardMetricOverview["vulnerabilities"],
  palette: string[],
): ChartOption {
  const distribution = firstNonEmptyRecord(metrics.byCoarseType, metrics.byCwe);
  if (recordTotal(distribution) > 0)
    return horizontalBarsOption(
      distribution,
      [palette[4], palette[3], palette[2]],
      "No records",
      4,
    );
  if (metrics.total > 0) {
    const high = Math.min(metrics.highConfidence, metrics.total);
    return donutOption(
      [
        { name: "High confidence", value: high },
        { name: "Other", value: Math.max(metrics.total - high, 0) },
      ],
      `${metrics.total}`,
      [palette[4], palette[1]],
      "No records",
    );
  }
  return emptyHorizontalBarsOption(palette[4]);
}

function reportActivityOption(
  recentReports: Array<Record<string, unknown>>,
  fallbackRecord: Record<string, number>,
  palette: string[],
): ChartOption {
  const buckets = new Map<string, number>();
  for (const report of recentReports) {
    const raw =
      report.updated_at ??
      report.created_at ??
      report.time ??
      report.generated_at;
    const bucket =
      typeof raw === "string" || typeof raw === "number"
        ? compactTime(String(raw))
        : "";
    if (!bucket) continue;
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }
  const points = Array.from(buckets.entries()).slice(-8);
  if (points.length) {
    return {
      color: [palette[2]],
      grid: { left: 4, right: 4, top: 12, bottom: 4 },
      tooltip: { trigger: "axis" },
      xAxis: {
        type: "category",
        data: points.map(([time]) => time),
        show: false,
      },
      yAxis: { type: "value", show: false, min: 0 },
      series: [
        {
          type: "bar",
          data: points.map(([, value]) => value),
          barWidth: 10,
          itemStyle: { borderRadius: [6, 6, 0, 0] },
        },
      ],
    };
  }
  if (recordTotal(fallbackRecord) > 0) {
    return horizontalBarsOption(fallbackRecord, [palette[2]], "No reports", 3);
  }
  return emptyVerticalBarsOption(palette[2]);
}

const metricAccentStyle = {
  blue: {
    text: "text-[hsl(var(--accent-blue))]",
    icon: "text-[hsl(var(--accent-blue))]",
    iconBg: "bg-[hsl(var(--accent-blue)/0.12)]",
    ring: "ring-[hsl(var(--accent-blue)/0.18)]",
  },
  cyan: {
    text: "text-[hsl(var(--chart-6))]",
    icon: "text-[hsl(var(--chart-6))]",
    iconBg: "bg-[hsl(var(--chart-6)/0.12)]",
    ring: "ring-[hsl(var(--chart-6)/0.18)]",
  },
  emerald: {
    text: "text-[hsl(var(--color-success))]",
    icon: "text-[hsl(var(--color-success))]",
    iconBg: "bg-[hsl(var(--color-success)/0.12)]",
    ring: "ring-[hsl(var(--color-success)/0.18)]",
  },
  amber: {
    text: "text-[hsl(var(--accent-orange))]",
    icon: "text-[hsl(var(--accent-orange))]",
    iconBg: "bg-[hsl(var(--accent-orange)/0.12)]",
    ring: "ring-[hsl(var(--accent-orange)/0.18)]",
  },
  violet: {
    text: "text-[hsl(var(--chart-5))]",
    icon: "text-[hsl(var(--chart-5))]",
    iconBg: "bg-[hsl(var(--chart-5)/0.12)]",
    ring: "ring-[hsl(var(--chart-5)/0.18)]",
  },
  rose: {
    text: "text-[hsl(var(--chart-4))]",
    icon: "text-[hsl(var(--chart-4))]",
    iconBg: "bg-[hsl(var(--chart-4)/0.12)]",
    ring: "ring-[hsl(var(--chart-4)/0.18)]",
  },
  slate: {
    text: "text-[hsl(var(--text-secondary))]",
    icon: "text-[hsl(var(--text-secondary))]",
    iconBg: "bg-[hsl(var(--text-secondary)/0.12)]",
    ring: "ring-[hsl(var(--text-secondary)/0.18)]",
  },
} satisfies Record<
  NonNullable<MetricCardProps["accent"]>,
  { text: string; icon: string; iconBg: string; ring: string }
>;

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  option,
  chips = [],
  hero = false,
  accent = "blue",
  chartHeight = hero ? "6.5rem" : "5.25rem",
  ring,
}: MetricCardProps): JSX.Element {
  const style = metricAccentStyle[accent];
  const [ringActive, setRingActive] = useState(false);
  const hasRing = Boolean(ring);

  return (
    <Card
      onMouseEnter={hasRing ? () => setRingActive(true) : undefined}
      onMouseLeave={hasRing ? () => setRingActive(false) : undefined}
      onFocus={hasRing ? () => setRingActive(true) : undefined}
      onBlur={hasRing ? () => setRingActive(false) : undefined}
      className={cn(
        "overflow-hidden border-border/65 bg-[hsl(var(--bg-surface))] shadow-[0_14px_32px_rgba(15,23,42,0.07)]",
        "dark:border-[hsl(var(--border)/0.9)] dark:bg-[hsl(var(--bg-surface-elevated))] dark:shadow-[0_18px_38px_rgba(0,0,0,0.26)]",
        "transition-shadow hover:shadow-[0_18px_42px_rgba(15,23,42,0.10)]",
        hero ? "min-h-[11.5rem]" : "min-h-[8.875rem]",
      )}
    >
      <CardContent
        className={cn(
          "grid h-full gap-3 p-4",
          hero
            ? "grid-cols-[minmax(0,1fr)_minmax(8.5rem,0.82fr)]"
            : "grid-cols-[minmax(0,1fr)_minmax(5.75rem,6.5rem)]",
        )}
      >
        <div className="flex min-w-0 flex-col justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-xl ring-1",
                  style.iconBg,
                  style.icon,
                  style.ring,
                  hero ? "size-10" : "size-9",
                )}
              >
                <Icon className={cn(hero ? "size-5" : "size-4")} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold leading-5 text-foreground">
                  {title}
                </p>
                <p className="truncate text-[13px] text-muted-foreground">
                  {description}
                </p>
              </div>
            </div>
            <p
              className={cn(
                "font-semibold tracking-tight",
                style.text,
                hero ? "text-4xl" : "text-3xl",
              )}
            >
              {value}
            </p>
          </div>
          {chips.length ? (
            <div className="flex flex-wrap gap-1.5">
              {chips.slice(0, hero ? 4 : 3).map((chip) => (
                <Badge
                  key={`${chip.label}-${chip.value}`}
                  variant={chip.variant ?? "outline"}
                  className="bg-background/55 px-2 py-0.5 text-[11px]"
                >
                  {chip.label} {chip.value}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
        <div
          className={cn(
            "relative min-w-0 self-center",
            hasRing
              ? "flex items-center justify-center p-1"
              : "rounded-2xl border border-border/45 bg-background/55 p-2",
          )}
        >
          {ring ? (
            <DashboardMetricRing
              value={ring.value}
              max={ring.max}
              centerValue={ring.centerValue}
              label={ring.label ?? title}
              size={ring.size ?? "min(5.75rem, 100%)"}
              strokeWidth={ring.strokeWidth ?? 10}
              colorClassName={style.text}
              active={ringActive}
            />
          ) : option ? (
            <EchartsBase option={option} height={chartHeight} />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

interface DashboardToastState {
  title: string;
  message: string;
  level: "warning" | "error";
}

function DashboardFloatingToast({
  toast,
  onClose,
}: {
  toast: DashboardToastState | null;
  onClose: () => void;
}): JSX.Element | null {
  if (!toast) return null;

  return (
    <div className="pointer-events-none fixed right-5 top-5 z-[120] w-[min(24rem,calc(100vw-2.5rem))]">
      <div
        className={cn(
          "pointer-events-auto rounded-2xl border bg-[hsl(var(--bg-surface))] px-4 py-3 shadow-[0_20px_48px_rgba(15,23,42,0.18)] backdrop-blur-xl",
          "dark:bg-[hsl(var(--bg-surface-elevated)/0.96)]",
          toast.level === "error"
            ? "border-[hsl(var(--color-danger)/0.35)] text-[hsl(var(--color-danger))]"
            : "border-[hsl(var(--accent-orange)/0.35)] text-[hsl(var(--accent-orange))]",
        )}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{toast.title}</p>
            <p className="mt-1 text-xs leading-5 text-[hsl(var(--text-secondary))]">
              {toast.message}
            </p>
          </div>
          <button
            type="button"
            className="rounded-full px-2 py-1 text-xs text-[hsl(var(--text-tertiary))] transition hover:bg-background/70 hover:text-foreground"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function DashboardView(): JSX.Element {
  const palette = useEchartsPalette();
  const overviewQuery = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: dashboardApi.getOverview,
    refetchInterval: 30_000,
  });
  const overview = overviewQuery.data;
  const metrics = overview?.metrics ?? EMPTY_METRICS;
  const [dashboardLogs, setDashboardLogs] = useState<string[]>([]);
  const [toast, setToast] = useState<DashboardToastState | null>(null);
  const lastErrorRef = useRef<string | null>(null);

  function appendDashboardLog(message: string): void {
    const time = new Date().toLocaleTimeString();
    setDashboardLogs((current) =>
      [`${time} ${message}`, ...current].slice(0, 80),
    );
  }

  useEffect(() => {
    if (!overviewQuery.isError) return;

    const errorText =
      overviewQuery.error instanceof Error
        ? overviewQuery.error.message
        : "Dashboard overview request failed";
    if (lastErrorRef.current === errorText) return;
    lastErrorRef.current = errorText;

    setToast({
      level: "warning",
      title: "仪表盘数据加载失败",
      message: "已使用 0 值空态渲染，请检查 BFF 与后端节点连接状态。",
    });
    appendDashboardLog(`Dashboard overview failed: ${errorText}`);
    appendDashboardLog("Dashboard rendered with zero-value fallback state.");
  }, [overviewQuery.error, overviewQuery.isError]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4_500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const runningOption = useMemo<ChartOption>(() => {
    if (metrics.runningJobs.trend.length)
      return sparklineOption(
        metrics.runningJobs.trend,
        [palette[0]],
        "No trend",
      );
    return segmentedBarOption(
      metrics.runningJobs.byStatus,
      palette,
      "No trend",
    );
  }, [metrics.runningJobs.byStatus, metrics.runningJobs.trend, palette]);

  const crashOption = useMemo<ChartOption>(
    () =>
      discoveryBarsOption(
        metrics.crashFindings.trend,
        metrics.crashFindings.byKind,
        palette,
      ),
    [metrics.crashFindings, palette],
  );

  const vulnerabilityOption = useMemo<ChartOption>(
    () => riskOption(metrics.vulnerabilities, palette),
    [metrics.vulnerabilities, palette],
  );

  const nodeStatusOption = useMemo<ChartOption>(
    () =>
      donutOption(
        [
          { name: "Online", value: metrics.nodeStatus.online },
          { name: "Offline", value: metrics.nodeStatus.offline },
          { name: "Checking", value: metrics.nodeStatus.checking },
        ],
        `${metrics.nodeStatus.onlinePercent}%`,
        [palette[2], palette[3], palette[1]],
        "0%",
      ),
    [metrics.nodeStatus, palette],
  );

  const protocolAssetsOption = useMemo<ChartOption>(() => {
    if (recordTotal(metrics.protocolAssets.byScope) > 0) {
      return donutOption(
        topRecordEntries(metrics.protocolAssets.byScope, 4).map(
          ([name, value]) => ({ name, value }),
        ),
        `${metrics.protocolAssets.protocolCount}`,
        palette,
        "No assets",
      );
    }
    if (recordTotal(metrics.protocolAssets.byKind) > 0)
      return horizontalBarsOption(
        metrics.protocolAssets.byKind,
        [palette[1]],
        "No assets",
        3,
      );
    return donutOption(
      [{ name: "Protocols", value: metrics.protocolAssets.protocolCount }],
      `${metrics.protocolAssets.protocolCount}`,
      [palette[1]],
      "No assets",
    );
  }, [metrics.protocolAssets, palette]);

  const debugOption = useMemo<ChartOption>(() => {
    if (recordTotal(metrics.debugSessions.byStatus) > 0)
      return segmentedBarOption(
        metrics.debugSessions.byStatus,
        palette,
        "No sessions",
      );
    if (recordTotal(metrics.debugSessions.byCoarseType) > 0)
      return horizontalBarsOption(
        metrics.debugSessions.byCoarseType,
        [palette[4]],
        "No sessions",
        3,
      );
    return donutOption(
      [{ name: "Sessions", value: metrics.debugSessions.total }],
      `${metrics.debugSessions.total}`,
      [palette[4]],
      "No sessions",
    );
  }, [metrics.debugSessions, palette]);

  const protocolAssetDisplayTotal =
    metrics.protocolAssets.protocolCount || metrics.protocolAssets.total;
  const protocolAssetMax = Math.max(
    recordTotal(metrics.protocolAssets.byScope),
    metrics.protocolAssets.total,
    metrics.protocolAssets.protocolCount,
    0,
  );
  const dominantDebugStatus =
    topRecordEntries(metrics.debugSessions.byStatus, 1)[0]?.[1] ??
    metrics.debugSessions.total;

  const reportsOption = useMemo<ChartOption>(
    () =>
      reportActivityOption(
        metrics.reports.recentReports,
        metrics.reports.byKind,
        palette,
      ),
    [metrics.reports, palette],
  );

  const taskDistributionOption = useMemo<ChartOption>(() => {
    const items = overview?.cross_node.task_distribution ?? [];
    if (!items.length) return emptyVerticalBarsOption(palette[0]);
    return {
      color: [palette[0]],
      grid: { left: 48, right: 20, top: 44, bottom: 28 },
      xAxis: { type: "category", data: items.map((item) => item.name) },
      yAxis: { type: "value" },
      tooltip: { trigger: "axis" },
      series: [
        {
          type: "bar",
          barWidth: 24,
          data: items.map((item) => item.value),
          itemStyle: { borderRadius: [8, 8, 0, 0] },
        },
      ],
    };
  }, [overview?.cross_node.task_distribution, palette]);

  const crashDistributionOption = useMemo<ChartOption>(() => {
    const items = overview?.cross_node.crash_distribution ?? [];
    if (!items.length) return emptyDonutOption("0", palette[3]);
    return donutOption(
      items.map((item) => ({ name: item.name, value: item.value })),
      formatNumber(metrics.crashFindings.crashes),
      [palette[3], palette[4], palette[1]],
      "No findings",
    );
  }, [
    metrics.crashFindings.crashes,
    overview?.cross_node.crash_distribution,
    palette,
  ]);

  const currentNodeJobTrendOption = useMemo<ChartOption>(() => {
    const items = overview?.current_node.job_trend ?? [];
    if (!items.length) return emptySegmentedBarOption(palette);
    return segmentedBarOption(
      Object.fromEntries(items.map((item) => [item.status, item.value])),
      palette,
      "当前节点任务状态",
    );
  }, [overview?.current_node.job_trend, palette]);

  const currentNodeGraphOption = useMemo<ChartOption>(() => {
    const nodes = overview?.current_node.protocol_graph.nodes ?? [];
    if (!nodes.length) return emptyHorizontalBarsOption(palette[2]);
    const categoryCount = nodes.reduce<Record<string, number>>(
      (record, node) => {
        const key = String(node.category ?? "protocol");
        record[key] = (record[key] ?? 0) + 1;
        return record;
      },
      {},
    );
    return horizontalBarsOption(
      categoryCount,
      [palette[2]],
      "当前节点协议资产图",
      4,
    );
  }, [overview?.current_node.protocol_graph.nodes, palette]);

  return (
    <div className="space-y-5">
      <DashboardFloatingToast toast={toast} onClose={() => setToast(null)} />
      <PageHeader
        eyebrow="仪 表 盘"
        title="系统总览"
        description="通过 Web BFF 聚合节点、任务、Crash 发现、漏洞、GDB 与报告摘要；卡片图形均响应真实 API 数据。"
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <MetricCard
          hero
          accent="emerald"
          title="运行中任务"
          value={formatNumber(metrics.runningJobs.running)}
          description="Active fuzz jobs"
          icon={Activity}
          option={runningOption}
          chips={[
            {
              label: "Starting",
              value: metrics.runningJobs.byStatus.starting ?? 0,
              variant: "outline",
            },
            {
              label: "Running",
              value:
                metrics.runningJobs.byStatus.running ??
                metrics.runningJobs.running,
              variant: "success",
            },
            {
              label: "Stopping",
              value: metrics.runningJobs.byStatus.stopping ?? 0,
              variant: "warning",
            },
            {
              label: "Total",
              value: metrics.runningJobs.total,
              variant: "secondary",
            },
          ]}
        />
        <MetricCard
          hero
          accent="amber"
          title="Crash 总数"
          value={formatNumber(metrics.crashFindings.crashes)}
          description="Fuzz 发现结果"
          icon={Radar}
          option={crashOption}
          chips={[
            {
              label: "Crashes",
              value: metrics.crashFindings.crashes,
              variant: "warning",
            },
            {
              label: "Hangs",
              value: metrics.crashFindings.hangs,
              variant: "outline",
            },
            {
              label: "Findings",
              value: metrics.crashFindings.totalFindings,
              variant: "secondary",
            },
          ]}
        />
        <MetricCard
          hero
          accent="rose"
          title="漏洞总数"
          value={formatNumber(metrics.vulnerabilities.total)}
          description="Confirmed vulnerability records"
          icon={ShieldCheck}
          option={vulnerabilityOption}
          chips={[
            {
              label: "High confidence",
              value: metrics.vulnerabilities.highConfidence,
              variant: "danger",
            },
            {
              label: "Types",
              value:
                topRecordEntries(
                  metrics.vulnerabilities.byCoarseType,
                  1,
                )[0]?.[0] ?? "—",
              variant: "outline",
            },
            {
              label: "CWE",
              value:
                topRecordEntries(metrics.vulnerabilities.byCwe, 1)[0]?.[0] ??
                "—",
              variant: "secondary",
            },
          ]}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          accent="blue"
          title="节点状态"
          value={`${formatNumber(metrics.nodeStatus.online)} / ${formatNumber(metrics.nodeStatus.total)}`}
          description="Online backend nodes"
          icon={Network}
          ring={{
            value: metrics.nodeStatus.online,
            max: metrics.nodeStatus.total,
            centerValue: `${metrics.nodeStatus.onlinePercent}%`,
            label: "Online node ratio",
          }}
          chips={[
            {
              label: "Online",
              value: metrics.nodeStatus.online,
              variant: "success",
            },
            {
              label: "Offline",
              value: metrics.nodeStatus.offline,
              variant: "warning",
            },
          ]}
        />
        <MetricCard
          accent="cyan"
          title="协议资产数"
          value={formatNumber(protocolAssetDisplayTotal)}
          description="Protocol workspaces"
          icon={DatabaseZap}
          ring={{
            value: metrics.protocolAssets.protocolCount,
            max: protocolAssetMax,
            centerValue: formatNumber(protocolAssetDisplayTotal),
            label: "Protocol workspace share",
          }}
          chips={topRecordEntries(metrics.protocolAssets.byScope, 2).map(
            ([label, value]) => ({ label, value, variant: "outline" as const }),
          )}
        />
        <MetricCard
          accent="violet"
          title="GDB 会话数"
          value={formatNumber(metrics.debugSessions.total)}
          description="Debug sessions"
          icon={Bug}
          ring={{
            value: dominantDebugStatus,
            max: metrics.debugSessions.total,
            centerValue: formatNumber(metrics.debugSessions.total),
            label: "Dominant debug status share",
          }}
          chips={topRecordEntries(metrics.debugSessions.byStatus, 2).map(
            ([label, value]) => ({ label, value, variant: "outline" as const }),
          )}
        />
        <MetricCard
          accent="slate"
          title="报告数"
          value={formatNumber(metrics.reports.total)}
          description="Generated reports"
          icon={FileText}
          option={reportsOption}
          chartHeight="5.375rem"
          chips={topRecordEntries(metrics.reports.byKind, 2).map(
            ([label, value]) => ({ label, value, variant: "outline" as const }),
          )}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.95fr)]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Gauge className="size-4 text-[hsl(var(--accent-blue))]" />
              跨节点运行任务分布
            </CardTitle>
            <CardDescription>
              由 `/web-api/dashboard/overview` 聚合各节点 `/api/v1/jobs/summary`
              返回。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EchartsBase option={taskDistributionOption} height="17.5rem" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-[hsl(var(--accent-orange))]" />
              跨节点 Crash 发现分布
            </CardTitle>
            <CardDescription>
              Crash 是 Fuzz 发现结果，不表示平台异常或系统故障。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EchartsBase option={crashDistributionOption} height="17.5rem" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Workflow className="size-4 text-[hsl(var(--accent-pink))]" />
              节点健康表
            </CardTitle>
            <CardDescription>
              离线节点保留在表内，不让仪表盘崩溃或缺失结构。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(overview?.nodes ?? []).length === 0 ? (
              <div className="rounded-[var(--radius-lg)] border border-border/50 bg-background/60 px-4 py-10 text-center text-sm text-muted-foreground">
                暂无节点摘要数据。
              </div>
            ) : (
              overview?.nodes.map((node) => (
                <div
                  key={node.node_id}
                  className="grid gap-3 rounded-[var(--radius-lg)] border border-border/50 bg-background/60 px-4 py-3 lg:grid-cols-[minmax(0,1.2fr)_7rem_6rem_6rem_6rem_8rem]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">
                        {node.name}
                      </p>
                      <StatusBadge
                        status={node.status === "online" ? "running" : "failed"}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {node.last_seen_at
                        ? `最后活跃：${formatDateTime(node.last_seen_at)}`
                        : "当前无活跃心跳"}
                    </p>
                  </div>
                  <div className="text-sm">
                    <span className="block text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      协议
                    </span>
                    {formatNumber(node.protocol_count)}
                  </div>
                  <div className="text-sm">
                    <span className="block text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      运行
                    </span>
                    {formatNumber(node.running_jobs)}
                  </div>
                  <div className="text-sm">
                    <span className="block text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      Crash
                    </span>
                    {formatNumber(node.crash_count)}
                  </div>
                  <div className="text-sm">
                    <span className="block text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      漏洞
                    </span>
                    {formatNumber(node.vulnerability_count)}
                  </div>
                  <div className="text-sm">
                    <span className="block text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      GDB/报告
                    </span>
                    {formatNumber(node.debug_session_count)} /{" "}
                    {formatNumber(node.report_count)}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <DatabaseZap className="size-4 text-[hsl(var(--accent-blue))]" />
              当前节点协议资产概览
            </CardTitle>
            <CardDescription>
              以当前节点协议资产图数据派生分类统计，不展示真实服务器路径。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EchartsBase option={currentNodeGraphOption} height="20rem" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-4 text-[hsl(var(--color-success))]" />
              当前节点任务状态
            </CardTitle>
            <CardDescription>
              基于当前节点 `jobs/summary.by_status` 的紧凑视图。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EchartsBase option={currentNodeJobTrendOption} height="17.5rem" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4 text-[hsl(var(--accent-pink))]" />
              最近事件
            </CardTitle>
            <CardDescription>
              当前节点与跨节点最近任务事件的降级汇总。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(overview?.cross_node.recent_events ?? []).length === 0 ? (
              <div className="rounded-[var(--radius-lg)] border border-border/50 bg-background/60 px-4 py-10 text-center text-sm text-muted-foreground">
                暂无最近事件。
              </div>
            ) : (
              overview?.cross_node.recent_events.map((event, index) => (
                <div
                  key={`${event.node_id}-${event.label}-${index}`}
                  className="rounded-[var(--radius-lg)] border border-border/50 bg-background/60 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{event.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {event.node_name} · {event.status}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {event.updated_at
                        ? formatDateTime(event.updated_at)
                        : "—"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Workflow className="size-4 text-[hsl(var(--accent-blue))]" />
            仪表盘日志
          </CardTitle>
          <CardDescription>
            页面级数据加载与降级渲染记录。错误不再嵌入卡片区域显示。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-44 overflow-y-auto rounded-xl border border-border/60 bg-background/72 p-3 font-mono text-xs">
            {dashboardLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Dashboard ready. Waiting for BFF overview data.
              </p>
            ) : (
              <div className="space-y-2">
                {dashboardLogs.map((item, index) => (
                  <p
                    key={`${item}-${index}`}
                    className="break-all text-[hsl(var(--text-secondary))]"
                  >
                    {item}
                  </p>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

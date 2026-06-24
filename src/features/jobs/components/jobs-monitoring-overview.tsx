import { useEffect, useMemo, useState } from "react";
import { Activity, ChartNoAxesCombined, FileWarning, Radar, ScanSearch, SlidersHorizontal, TerminalSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineAreaChart } from "@/components/charts/line-area-chart";
import { JobsEmptyState } from "@/features/jobs/components/jobs-empty-state";
import type { ArtifactRecord, Job, JobsActivity, LogsTailResponse, Metrics } from "@/types/api/jobs";
import { formatDateTime, formatNumber } from "@/lib/utils/format";
import { jobName, jobProtocol } from "@/features/jobs/job-presenters";

const METRIC_LABELS: Record<string, string> = {
  cycles_done: "cycles_done",
  cur_item: "cur_item",
  corpus_count: "corpus_count",
  execs_done: "execs_done",
  execs_per_sec: "execs_per_sec",
  exec_timeout: "exec_timeout",
  execs_since_crash: "execs_since_crash",
  paths_total: "paths_total",
  paths_favored: "paths_favored",
  paths_found: "paths_found",
  paths_imported: "paths_imported",
  max_depth: "max_depth",
  pending_total: "pending_total",
  pending_favs: "pending_favs",
  stability: "stability",
  bitmap_cvg: "bitmap_cvg",
  saved_crashes: "saved_crashes",
  saved_hangs: "saved_hangs",
  unique_crashes: "unique_crashes",
  unique_hangs: "unique_hangs",
  last_find: "last_find",
  last_crash: "last_crash",
  last_hang: "last_hang",
  run_time: "run_time",
  slowest_exec_ms: "slowest_exec_ms",
  peak_rss_mb: "peak_rss_mb",
  cpu_affinity: "cpu_affinity",
  edges_found: "edges_found",
  variable_paths: "variable_paths",
};

const DEFAULT_METRIC_KEYS = ["execs_done", "execs_per_sec", "paths_total", "pending_total", "unique_crashes", "unique_hangs", "bitmap_cvg", "stability"];

const METRIC_GROUPS = [
  {
    key: "core",
    label: "核心总览",
    helper: "执行速率、覆盖、pending、稳定性",
    metrics: ["execs_done", "execs_per_sec", "paths_total", "pending_total", "bitmap_cvg", "stability"],
  },
  {
    key: "coverage",
    label: "覆盖/路径组",
    helper: "路径发现、深度、边覆盖变化",
    metrics: ["paths_total", "paths_found", "paths_imported", "paths_favored", "max_depth", "edges_found", "variable_paths", "bitmap_cvg"],
  },
  {
    key: "throughput",
    label: "执行性能组",
    helper: "exec 速率、超时、慢执行、运行时长",
    metrics: ["execs_done", "execs_per_sec", "exec_timeout", "slowest_exec_ms", "run_time", "cycles_done", "cur_item"],
  },
  {
    key: "crash",
    label: "Crash/Hang 组",
    helper: "唯一崩溃、挂起、上次命中时间",
    metrics: ["unique_crashes", "saved_crashes", "unique_hangs", "saved_hangs", "execs_since_crash", "last_crash", "last_hang", "last_find"],
  },
  {
    key: "queue",
    label: "队列/语料组",
    helper: "corpus、pending、favored 队列压力",
    metrics: ["corpus_count", "pending_total", "pending_favs", "paths_favored", "cur_item"],
  },
  {
    key: "resource",
    label: "资源/稳定性组",
    helper: "稳定性、RSS、CPU 绑定、超时",
    metrics: ["stability", "peak_rss_mb", "cpu_affinity", "exec_timeout", "slowest_exec_ms"],
  },
] as const;

function parseNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return null;
  const matched = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!matched) return null;
  const parsed = Number(matched[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function metricTimestamp(metric: Metrics): string {
  return metric.timestamp ?? metric.at ?? new Date().toISOString();
}

function metricStats(metric: Metrics | null | undefined): Record<string, unknown> {
  if (!metric) return {};
  const raw = typeof metric.raw === "object" && metric.raw ? metric.raw : {};
  const fuzzStats = typeof metric.fuzzer_stats === "object" && metric.fuzzer_stats ? metric.fuzzer_stats : {};
  return { ...raw, ...fuzzStats };
}

function labelForMetric(key: string): string {
  return METRIC_LABELS[key] ?? key;
}

function runtimeRows(job?: Job): Array<[string, string]> {
  const afl = (job?.afl ?? {}) as Record<string, unknown>;
  return [
    ["AFL++", String(afl.afl_binary ?? job?.afl_path ?? "—")],
    ["target", String(afl.target_binary ?? job?.target_cmd?.[0] ?? "—")],
    ["workers", String(afl.workers ?? job?.metadata?.workers ?? "—")],
    ["input / output", `${String(afl.input_dir ?? job?.input_dir ?? "—")} → ${String(afl.output_dir ?? job?.output_dir ?? "—")}`],
    ["cwd", String(afl.run_cwd ?? job?.cwd ?? "—")],
    ["source / build", `${String(afl.source_dir ?? "—")} · ${String(afl.build_dir ?? "—")}`],
    ["transport", String(job?.debug?.transport_type ?? "stdin")],
    ["env", `${Object.keys((afl.env ?? {}) as Record<string, string>).length} vars`],
  ];
}

function RecentTaskActivityFeed({ jobs, selectedJobId, onSelectJob }: { jobs: Job[]; selectedJobId?: string; onSelectJob: (jobId: string) => void }): JSX.Element {
  if (!jobs.length) return <JobsEmptyState title="暂无活跃任务" description="当前筛选范围内还没有产生可展示的任务活动。" />;
  return (
    <div className="space-y-3">
      {jobs.slice(0, 8).map((job) => {
        const active = selectedJobId === job.job_id;
        return (
          <button key={job.job_id} type="button" onClick={() => onSelectJob(job.job_id)} className="block w-full text-left">
            <div className={`rounded-[var(--radius-lg)] border p-3 ${active ? "border-primary/60 bg-primary/8" : "border-border/60 bg-background/60"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{jobName(job)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{jobProtocol(job)} · {job.status}</p>
                </div>
                <p className="text-xs text-muted-foreground">{formatDateTime(job.updated_at ?? job.created_at)}</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function RecentArtifactsFeed({ items }: { items: ArtifactRecord[] }): JSX.Element {
  if (!items.length) return <JobsEmptyState title="暂无近期产物" description="当前没有新的 crash / hang / queue 产物记录。" />;
  return (
    <div className="space-y-3">
      {items.slice(0, 8).map((item, index) => (
        <div key={`${item.artifact_id ?? index}`} className="rounded-[var(--radius-lg)] border border-border/60 bg-background/60 p-3 text-sm">
          <div className="flex items-center justify-between gap-3"><span className="font-medium">{item.kind ?? "artifact"}</span><span className="text-xs text-muted-foreground">{String(item.protocol ?? "—")}</span></div>
          <p className="mt-2 break-all text-xs text-muted-foreground">{item.path ?? item.seed_path ?? item.artifact_id ?? "—"}</p>
        </div>
      ))}
    </div>
  );
}

function AlertTimelineStrip({ items }: { items: JobsActivity["alert_timeline"] }): JSX.Element {
  if (!items.length) return <JobsEmptyState title="暂无异常信号" description="当前时间窗内没有关键事件时间线。" />;
  return (
    <div className="space-y-2">
      {items.slice(0, 8).map((item, index) => (
        <div key={`${item.kind ?? "event"}-${index}`} className="rounded-[var(--radius-lg)] border border-border/60 bg-background/60 px-3 py-2 text-sm">
          <div className="flex items-center justify-between gap-3"><span>{item.message ?? item.kind}</span><span className="text-xs text-muted-foreground">{formatDateTime(item.time ?? item.at)}</span></div>
        </div>
      ))}
    </div>
  );
}

export function JobsMonitoringOverview({
  activity,
  jobs = [],
  selectedJobId,
  onSelectJob,
  focusedJob,
  focusedMetrics,
  focusedMetricsHistory = [],
  focusedArtifacts = [],
  focusedLogs = [],
}: {
  activity?: JobsActivity;
  jobs?: Job[];
  selectedJobId?: string;
  onSelectJob: (jobId: string) => void;
  focusedJob?: Job;
  focusedMetrics?: Metrics | null;
  focusedMetricsHistory?: Metrics[];
  focusedArtifacts?: ArtifactRecord[];
  focusedLogs?: string[];
}): JSX.Element {
  const latestStats = useMemo(() => metricStats(focusedMetrics ?? null), [focusedMetrics]);

  const numericMetricKeys = useMemo(() => {
    const seen = new Set<string>();
    for (const point of focusedMetricsHistory ?? []) {
      const topLevel = Object.entries(point).filter(([key]) => !["timestamp", "at", "raw", "fuzzer_stats", "stats_file_path", "job_id", "status"].includes(key));
      for (const [key, value] of topLevel) {
        if (parseNumeric(value) !== null) seen.add(key);
      }
      for (const [key, value] of Object.entries(metricStats(point))) {
        if (parseNumeric(value) !== null) seen.add(key);
      }
    }
    return Array.from(seen).sort((left, right) => {
      const leftIndex = DEFAULT_METRIC_KEYS.indexOf(left);
      const rightIndex = DEFAULT_METRIC_KEYS.indexOf(right);
      if (leftIndex !== -1 || rightIndex !== -1) {
        return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
      }
      return left.localeCompare(right);
    });
  }, [focusedMetricsHistory]);

  const [selectedMetricKeys, setSelectedMetricKeys] = useState<string[]>([]);
  const [activeMetricGroupKey, setActiveMetricGroupKey] = useState<string>("core");

  useEffect(() => {
    if (!numericMetricKeys.length) {
      setSelectedMetricKeys([]);
      return;
    }
    setSelectedMetricKeys((current) => {
      const kept = current.filter((item) => numericMetricKeys.includes(item));
      if (kept.length) return kept;
      const defaults = DEFAULT_METRIC_KEYS.filter((item) => numericMetricKeys.includes(item));
      return defaults.length ? defaults : numericMetricKeys.slice(0, Math.min(6, numericMetricKeys.length));
    });
    setActiveMetricGroupKey((current) => {
      if (current === "all") return current;
      if (METRIC_GROUPS.some((group) => group.key === current && group.metrics.some((metricKey) => numericMetricKeys.includes(metricKey)))) {
        return current;
      }
      const fallback = METRIC_GROUPS.find((group) => group.metrics.some((metricKey) => numericMetricKeys.includes(metricKey)));
      return fallback?.key ?? "core";
    });
  }, [selectedJobId, numericMetricKeys]);

  const availableMetricGroups = useMemo(() => {
    return METRIC_GROUPS.map((group) => ({
      ...group,
      availableMetrics: group.metrics.filter((metricKey) => numericMetricKeys.includes(metricKey)),
    })).filter((group) => group.availableMetrics.length > 0);
  }, [numericMetricKeys]);

  const activeMetricGroup = useMemo(
    () => availableMetricGroups.find((group) => group.key === activeMetricGroupKey) ?? availableMetricGroups[0] ?? null,
    [activeMetricGroupKey, availableMetricGroups],
  );

  const selectedTrendSeries = useMemo(() => {
    return selectedMetricKeys.map((metricKey) => ({
      name: labelForMetric(metricKey),
      data: (focusedMetricsHistory ?? []).flatMap((point) => {
        const topLevelValue = parseNumeric(point[metricKey]);
        if (topLevelValue !== null) return [[metricTimestamp(point), topLevelValue] as [string, number]];
        const statValue = parseNumeric(metricStats(point)[metricKey]);
        return statValue !== null ? [[metricTimestamp(point), statValue] as [string, number]] : [];
      }),
    }));
  }, [focusedMetricsHistory, selectedMetricKeys]);

  const allStatRows = useMemo(() => {
    const latestEntries = Object.entries(latestStats);
    const previous = metricStats((focusedMetricsHistory ?? []).at(-2));
    return latestEntries
      .map(([key, value]) => {
        const currentNumber = parseNumeric(value);
        const previousNumber = parseNumeric(previous[key]);
        return {
          key,
          label: labelForMetric(key),
          value: String(value ?? "—"),
          numericValue: currentNumber,
          delta: currentNumber !== null && previousNumber !== null ? currentNumber - previousNumber : null,
        };
      })
      .sort((left, right) => {
        const leftIndex = DEFAULT_METRIC_KEYS.indexOf(left.key);
        const rightIndex = DEFAULT_METRIC_KEYS.indexOf(right.key);
        if (leftIndex !== -1 || rightIndex !== -1) {
          return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
        }
        return left.key.localeCompare(right.key);
      });
  }, [latestStats, focusedMetricsHistory]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_0.95fr]">
        <Card className="card-surface overflow-hidden">
          <CardHeader className="border-b border-border/50 pb-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base"><ChartNoAxesCombined className="size-4.5" /> AFL++ 实时指标主趋势图</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">主图直接消费焦点任务的 `fuzz_stats / metrics history`；可切换 6 个监控组，也可展开全部数值项。</p>
              </div>
              <div className="rounded-[var(--radius-lg)] border border-border/60 bg-background/55 px-3 py-2 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">当前焦点任务</p>
                <p className="mt-1 break-all">{selectedJobId ?? focusedJob?.job_id ?? "未选择任务"}</p>
                <p className="mt-1">{jobProtocol(focusedJob) ?? "—"} · {focusedJob?.status ?? "unknown"}</p>
                <p className="mt-1">最后采样：{focusedMetrics?.timestamp || focusedMetrics?.at ? formatDateTime(focusedMetrics?.timestamp ?? focusedMetrics?.at) : "—"}</p>
              </div>
            </div>
            <div className="mt-4 rounded-[var(--radius-lg)] border border-border/60 bg-background/50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  <SlidersHorizontal className="size-3.5" /> 指标勾选器
                </span>
                <Button
                  size="sm"
                  variant={activeMetricGroupKey === "core" ? "secondary" : "ghost"}
                  className="h-7 px-2.5 text-xs"
                  onClick={() => {
                    const defaults = DEFAULT_METRIC_KEYS.filter((item) => numericMetricKeys.includes(item));
                    setActiveMetricGroupKey("core");
                    setSelectedMetricKeys(defaults.length ? defaults : numericMetricKeys.slice(0, Math.min(6, numericMetricKeys.length)));
                  }}
                >
                  核心总览
                </Button>
                {availableMetricGroups.filter((group) => group.key !== "core").map((group) => (
                  <Button
                    key={group.key}
                    size="sm"
                    variant={activeMetricGroupKey === group.key ? "secondary" : "ghost"}
                    className="h-7 px-2.5 text-xs"
                    onClick={() => {
                      setActiveMetricGroupKey(group.key);
                      setSelectedMetricKeys(group.availableMetrics);
                    }}
                  >
                    {group.label}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant={activeMetricGroupKey === "all" ? "secondary" : "ghost"}
                  className="h-7 px-2.5 text-xs"
                  onClick={() => {
                    setActiveMetricGroupKey("all");
                    setSelectedMetricKeys(numericMetricKeys);
                  }}
                >
                  全部数值项
                </Button>
              </div>
              <div className="mt-3 grid gap-2 lg:grid-cols-2 2xl:grid-cols-3">
                {availableMetricGroups.map((group) => {
                  const active = activeMetricGroupKey === group.key;
                  return (
                    <button
                      key={group.key}
                      type="button"
                      onClick={() => {
                        setActiveMetricGroupKey(group.key);
                        setSelectedMetricKeys(group.availableMetrics);
                      }}
                      className={`rounded-[var(--radius-lg)] border px-3 py-2 text-left transition ${active ? "border-primary/60 bg-primary/10" : "border-border/60 bg-background/55 hover:border-primary/30"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className={`text-sm font-medium ${active ? "text-primary" : "text-foreground"}`}>{group.label}</span>
                        <span className="rounded-full border border-border/60 bg-background/70 px-2 py-0.5 text-[11px] text-muted-foreground">{group.availableMetrics.length} 项</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{group.helper}</p>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 rounded-[var(--radius-lg)] border border-dashed border-border/60 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">当前分组：</span>{" "}
                {activeMetricGroupKey === "all"
                  ? `全部数值项（当前任务实际回传的 ${numericMetricKeys.length} 个可绘图字段）`
                  : activeMetricGroup
                    ? `${activeMetricGroup.label} · ${activeMetricGroup.helper}`
                    : "当前任务尚未形成可用分组"}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {numericMetricKeys.length ? numericMetricKeys.map((metricKey) => {
                  const selected = selectedMetricKeys.includes(metricKey);
                  return (
                    <button
                      key={metricKey}
                      type="button"
                      onClick={() => setSelectedMetricKeys((current) => selected ? current.filter((item) => item !== metricKey) : [...current, metricKey])}
                      className={`rounded-full border px-3 py-1.5 text-xs transition ${selected ? "border-primary/60 bg-primary/10 text-primary" : "border-border/70 bg-background/75 text-muted-foreground hover:border-primary/30 hover:text-foreground"}`}
                    >
                      {labelForMetric(metricKey)}
                    </button>
                  );
                }) : <span className="text-sm text-muted-foreground">当前任务尚未回收到可绘制的 fuzz_stats 数值字段。</span>}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            <LineAreaChart title="AFL++ 全字段趋势" series={selectedTrendSeries} height={360} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="card-surface">
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Activity className="size-4.5" /> 当前采样快照</CardTitle></CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {DEFAULT_METRIC_KEYS.filter((key) => allStatRows.some((row) => row.key === key)).map((key) => {
                const row = allStatRows.find((item) => item.key === key);
                if (!row) return null;
                return (
                  <div key={row.key} className="rounded-[var(--radius-lg)] border border-border/60 bg-background/55 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="font-semibold">{row.numericValue !== null ? formatNumber(row.numericValue) : row.value}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {row.delta === null ? "较上一采样暂无可计算变化" : `Δ ${row.delta > 0 ? "+" : ""}${formatNumber(row.delta)}`}
                    </p>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="card-surface">
            <CardHeader className="pb-3"><CardTitle className="text-base">AFL++ 运行参数回显</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {runtimeRows(focusedJob).map(([label, value]) => (
                <div key={label} className="rounded-[var(--radius-lg)] border border-border/60 bg-background/55 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="max-w-[14rem] truncate font-medium">{value}</span>
                  </div>
                </div>
              ))}
              <div className="rounded-[var(--radius-lg)] border border-border/60 bg-background/55 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">后端最终 command</p>
                <p className="mt-2 break-all">{focusedJob?.command?.join(" ") ?? "—"}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="card-surface">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base"><Radar className="size-4.5" /> fuzz_stats 全字段实时面板</CardTitle>
            <span className="text-xs text-muted-foreground">直接展示当前焦点任务返回的 AFL `fuzzer_stats` 最新字段。</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {allStatRows.length ? allStatRows.map((row) => (
              <div key={row.key} className="rounded-[var(--radius-lg)] border border-border/60 bg-background/55 px-3 py-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{row.label}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{row.key}</p>
                  </div>
                  {row.delta !== null ? (
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${row.delta > 0 ? "bg-primary/10 text-primary" : row.delta < 0 ? "bg-amber-500/10 text-amber-600 dark:text-amber-300" : "bg-muted text-muted-foreground"}`}>
                      Δ {row.delta > 0 ? "+" : ""}{formatNumber(row.delta)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 break-all text-sm text-foreground">{row.value}</p>
              </div>
            )) : (
              <div className="rounded-[var(--radius-lg)] border border-dashed border-border/60 bg-background/40 px-4 py-6 text-sm text-muted-foreground">
                当前所选任务尚未产出 `fuzzer_stats` 字段，请先选择运行中的任务或等待后端采样。
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr_0.9fr]">
        <Card className="card-surface">
          <CardHeader className="pb-3"><CardTitle className="text-base">最近活跃任务流</CardTitle></CardHeader>
          <CardContent><RecentTaskActivityFeed jobs={jobs} selectedJobId={selectedJobId} onSelectJob={onSelectJob} /></CardContent>
        </Card>
        <Card className="card-surface">
          <CardHeader className="pb-3"><CardTitle className="text-base">最近产物流</CardTitle></CardHeader>
          <CardContent><RecentArtifactsFeed items={focusedArtifacts.length ? focusedArtifacts : (activity?.recent_artifacts as ArtifactRecord[] | undefined) ?? []} /></CardContent>
        </Card>
        <Card className="card-surface">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><ScanSearch className="size-4.5" /> 异常信号带</CardTitle></CardHeader>
          <CardContent><AlertTimelineStrip items={activity?.alert_timeline ?? []} /></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card className="card-surface">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><TerminalSquare className="size-4.5" /> 日志尾部</CardTitle></CardHeader>
          <CardContent>
            {focusedLogs.length ? (
              <div className="rounded-[var(--radius-lg)] border border-border/60 bg-background/60 p-3 text-xs text-muted-foreground">
                <div className="max-h-72 space-y-1 overflow-auto font-mono">
                  {focusedLogs.slice(-60).map((line, index) => <p key={`${index}-${line.slice(0, 12)}`} className="break-all">{line}</p>)}
                </div>
              </div>
            ) : <JobsEmptyState title="暂无日志尾部" description="当前焦点任务还没有新的日志输出。" />}
          </CardContent>
        </Card>
        <Card className="card-surface">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><FileWarning className="size-4.5" /> 监控说明</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>如果你现在能看到“覆盖/路径组、执行性能组、Crash/Hang 组、队列/语料组、资源/稳定性组”，说明这次替换已经生效。</p>
            <p>如果只看到最基础按钮，通常是当前焦点任务还没采到相应 `fuzzer_stats` 字段，或者后端历史点里尚未形成对应数值。</p>
            <p>如果页面完全没有变化，优先检查你替换的是不是 <code>front/src/features/jobs/components/jobs-monitoring-overview.tsx</code>，并重启前端开发服务器。</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

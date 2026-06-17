import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, PauseCircle, PlayCircle, RefreshCcw, ShieldAlert, Sparkles, Workflow } from "lucide-react";
import { jobsApi } from "@/lib/api/services/jobs";
import type { AnalysisResult, ArtifactRecord, EventMessage, Job, Metrics } from "@/types/api/jobs";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineAreaChart } from "@/components/charts/line-area-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { BarChart } from "@/components/charts/bar-chart";
import { EmptyState } from "@/components/common/empty-state";
import { JsonViewer } from "@/components/common/json-viewer";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatNumber, formatPercent, lastN } from "@/lib/utils/format";
import { useWebSocketStream } from "@/hooks/use-websocket-stream";
import { useUiStore } from "@/stores/ui-store";
import { translateArtifactKind, translateJobStatus } from "@/lib/utils/display";
import { dockLog } from "@/components/layout/dock";
import { ApiErrorReporter } from "@/components/common/api-error-alert";

function metricTime(item: Metrics): string {
  return item.timestamp ?? new Date().toISOString();
}

function jobName(job: Job): string {
  return job.name ?? job.job_id;
}

function reqStr(job: Job, key: string): string | undefined {
  const r = job.request;
  if (!r || typeof r !== "object") return undefined;
  const v = r[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function jobTarget(job: Job): string {
  if (job.target_cmd?.length) return job.target_cmd.join(" ");
  const reqCmd = job.request?.target_cmd;
  if (Array.isArray(reqCmd) && reqCmd.length) return reqCmd.join(" ");
  return job.afl?.target_binary ?? "-";
}

function jobInput(job: Job): string {
  return job.input_dir ?? reqStr(job, "input_dir") ?? job.afl?.input_dir ?? "-";
}

function jobOutput(job: Job): string {
  return job.output_dir ?? reqStr(job, "output_dir") ?? job.afl?.output_dir ?? "-";
}

function jobCwd(job: Job): string {
  return job.cwd ?? reqStr(job, "cwd") ?? job.afl?.run_cwd ?? "-";
}

function jobAflPath(job: Job): string {
  return job.afl_path ?? reqStr(job, "afl_path") ?? job.afl?.afl_binary ?? "-";
}

function jobWorkers(job: Job): string {
  return String(job.afl?.workers ?? 1);
}

function mergeMetrics(existing: Metrics[], incoming: Metrics): Metrics[] {
  const seen = new Map(existing.map((item) => [metricTime(item), item]));
  seen.set(metricTime(incoming), incoming);
  return Array.from(seen.values())
    .sort((a, b) => metricTime(a).localeCompare(metricTime(b)))
    .slice(-300);
}

function mergeArtifact(existing: ArtifactRecord[], incoming: ArtifactRecord): ArtifactRecord[] {
  const seen = new Map(existing.map((item) => [item.artifact_id, item]));
  seen.set(incoming.artifact_id, incoming);
  return Array.from(seen.values()).sort((a, b) => String(a.discovered_at ?? "").localeCompare(String(b.discovered_at ?? "")));
}

function mergeEvent(existing: EventMessage[], incoming: EventMessage): EventMessage[] {
  return [...existing, incoming].slice(-200);
}

function KpiMini({ label, value, color }: { label: string; value: string; color: string }): JSX.Element {
  return (
    <div className="console-data-card p-4">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
    </div>
  );
}

function EventSummaryCard({ event }: { event: EventMessage }): JSX.Element {
  return (
    <div className="console-data-card p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium">{event.event_type ?? event.type ?? "事件"}</span>
        <span className="text-[10px] text-muted-foreground">
          {event.status ? `状态 ${event.status}` : formatDateTime(event.timestamp)}
        </span>
      </div>
      {event.log_tail?.length ? (
        <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-xs text-muted-foreground">
          {event.log_tail.join("\n")}
        </p>
      ) : event.payload ? (
        <div className="mt-2 text-xs text-muted-foreground">
          <JsonViewer data={event.payload} compact />
        </div>
      ) : null}
    </div>
  );
}

export function JobDetailView(): JSX.Element {
  const { jobId = "" } = useParams();
  const selectedNodeId = useUiStore((s) => s.selectedApiNodeId);

  const jobQuery = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => jobsApi.getJob(jobId),
    enabled: Boolean(jobId),
    refetchInterval: 5_000,
  });

  const metricsHistoryQuery = useQuery({
    queryKey: ["job-metrics-history", jobId],
    queryFn: () => jobsApi.getMetricsHistory(jobId, 200),
    enabled: Boolean(jobId),
    refetchInterval: 5_000,
  });

  const artifactsQuery = useQuery({
    queryKey: ["job-artifacts", jobId],
    queryFn: () => jobsApi.listArtifacts(jobId),
    enabled: Boolean(jobId),
    refetchInterval: 5_000,
  });

  const [metricsHistory, setMetricsHistory] = useState<Metrics[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactRecord[]>([]);
  const [events, setEvents] = useState<EventMessage[]>([]);
  const [actionResult, setActionResult] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    if (metricsHistoryQuery.data) setMetricsHistory(metricsHistoryQuery.data);
  }, [metricsHistoryQuery.data]);

  useEffect(() => {
    if (artifactsQuery.data) setArtifacts(artifactsQuery.data);
  }, [artifactsQuery.data]);

  const eventsState = useWebSocketStream({
    url: jobId ? jobsApi.eventsWsUrl(jobId) : undefined,
    enabled: Boolean(jobId),
    parse: jobsApi.parseEventMessage,
    onMessage: (message) => setEvents((current) => mergeEvent(current, message)),
  });

  const metricsState = useWebSocketStream({
    url: jobId ? jobsApi.metricsWsUrl(jobId) : undefined,
    enabled: Boolean(jobId),
    parse: jobsApi.parseMetricsMessage,
    onMessage: (message) => setMetricsHistory((current) => mergeMetrics(current, message)),
  });

  const artifactsState = useWebSocketStream({
    url: jobId ? jobsApi.artifactsWsUrl(jobId) : undefined,
    enabled: Boolean(jobId),
    parse: jobsApi.parseArtifactMessage,
    onMessage: (items) => setArtifacts((current) => items.reduce((acc, item) => mergeArtifact(acc, item), current)),
  });

  const stopJobMutation = useMutation({
    mutationFn: () => jobsApi.stopJob(jobId),
    onSuccess: async () => {
      dockLog("warn", "job-control", `stop requested for ${jobId}`);
      await jobQuery.refetch();
    },
  });

  const replayMutation = useMutation({
    mutationFn: ({ artifactId }: { artifactId: string }) => jobsApi.replayArtifact(jobId, artifactId),
    onSuccess: (result, variables) => {
      setActionResult(result);
      dockLog("success", "job-artifact", `replay finished: ${variables.artifactId}`, result);
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: ({ artifactId }: { artifactId: string }) => jobsApi.analyzeArtifact(jobId, artifactId),
    onSuccess: (result, variables) => {
      setActionResult(result);
      dockLog("success", "job-artifact", `analysis finished: ${variables.artifactId}`, result);
    },
  });

  const job = jobQuery.data;
  const latestMetric = metricsHistory.at(-1) ?? job?.last_metrics ?? null;

  const chartSeries = useMemo(
    () => ({
      coverage: metricsHistory.map((item) => [metricTime(item), item.bitmap_cvg ?? 0] as [string, number]),
      execs: metricsHistory.map((item) => [metricTime(item), item.execs_done ?? 0] as [string, number]),
      crashes: metricsHistory.map((item) => [metricTime(item), item.unique_crashes ?? 0] as [string, number]),
      hangs: metricsHistory.map((item) => [metricTime(item), item.unique_hangs ?? 0] as [string, number]),
      pending: metricsHistory.map((item) => [metricTime(item), item.pending_total ?? 0] as [string, number]),
      cycles: metricsHistory.map((item) => [metricTime(item), item.cycles_done ?? 0] as [string, number]),
    }),
    [metricsHistory],
  );

  const artifactPie = useMemo(() => {
    const counts = artifacts.reduce<Record<string, number>>((acc, artifact) => {
      acc[artifact.kind ?? "unknown"] = (acc[artifact.kind ?? "unknown"] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([name, value]) => ({ name: translateArtifactKind(name), value }));
  }, [artifacts]);

  const riskPie = useMemo(() => {
    const counts = events.reduce<Record<string, number>>((acc, event) => {
      const sev = typeof event.payload?.severity === "string" ? event.payload.severity : undefined;
      if (sev) acc[sev] = (acc[sev] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [events]);

  const coreTrendSeries = useMemo(
    () => [
      { name: "execs", data: chartSeries.execs },
      { name: "coverage", data: chartSeries.coverage },
      { name: "crashes", data: chartSeries.crashes },
      { name: "hangs", data: chartSeries.hangs },
    ],
    [chartSeries],
  );

  const queueTrendSeries = useMemo(
    () => [
      { name: "pending", data: chartSeries.pending },
      { name: "cycles", data: chartSeries.cycles },
    ],
    [chartSeries],
  );

  if (!jobId) return <EmptyState title="缺少 jobId" description="当前路由参数中没有 jobId。" />;
  if (jobQuery.isLoading) return <EmptyState title="正在加载任务" description="稍后将展示实时监控详情。" />;
  if (!job) return <EmptyState title="任务不存在" description="无法从后端读取该任务。" />;

  return (
    <div className="space-y-5">
      <ApiErrorReporter error={jobQuery.error} title="任务详情加载失败" source="job" />
      <ApiErrorReporter error={metricsHistoryQuery.error} title="任务指标加载失败" source="job" />
      <ApiErrorReporter error={artifactsQuery.error} title="任务产物加载失败" source="job" />
      <ApiErrorReporter error={replayMutation.error} title="产物回放失败" source="job" />
      <ApiErrorReporter error={analyzeMutation.error} title="产物分析失败" source="job" />
      <PageHeader
        eyebrow="任务详情"
        title={jobName(job)}
        description={`Datadog / Grafana 式监控详情布局，运行输出已统一进入底部 GlobalLogDock · 当前节点 ${selectedNodeId || "local"}`}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void Promise.all([jobQuery.refetch(), metricsHistoryQuery.refetch(), artifactsQuery.refetch()])}
            >
              <RefreshCcw className="size-3.5" />
              刷新
            </Button>
            <Button
              asChild
              variant="secondary"
              size="sm"
              onClick={() => dockLog("info", "job-control", `已请求下载日志：${job.job_id}`)}
            >
              <a href={jobsApi.downloadLogsUrl(job.job_id)} target="_blank" rel="noreferrer">
                <Download className="size-3.5" />
                下载日志
              </a>
            </Button>
            <Button variant="danger" size="sm" onClick={() => stopJobMutation.mutate()} disabled={stopJobMutation.isPending || job.status !== "running"}>
              <PauseCircle className="size-3.5" />
              停止
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiMini label="状态" value={translateJobStatus(job.status)} color={job.status === "running" ? "hsl(var(--success))" : job.status === "failed" ? "hsl(var(--danger))" : "hsl(var(--primary))"} />
        <KpiMini label="并行数" value={jobWorkers(job)} color="hsl(var(--primary))" />
        <KpiMini label="execs" value={formatNumber(latestMetric?.execs_done)} color="hsl(var(--primary))" />
        <KpiMini label="coverage" value={formatPercent(latestMetric?.bitmap_cvg)} color="hsl(var(--success))" />
        <KpiMini label="crash" value={formatNumber(latestMetric?.unique_crashes)} color="hsl(var(--danger))" />
        <KpiMini label="产物" value={String(artifacts.length)} color="hsl(var(--warning))" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.55fr_0.95fr]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/50 pb-3">
            <CardTitle className="text-base">核心趋势</CardTitle>
            <CardDescription>覆盖率、执行速度、crash/hang 与队列健康放在主监控列。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 p-5">
            <LineAreaChart title="核心趋势" yAxisName="指标" series={coreTrendSeries} height={290} />
            <LineAreaChart title="队列健康" yAxisName="队列" series={queueTrendSeries} height={210} />
          </CardContent>
        </Card>

        <div className="grid gap-4 content-start">
          <Card>
            <CardHeader className="border-b border-border/50 pb-3">
              <CardTitle className="text-base">连接与输出路由</CardTitle>
              <CardDescription>事件、指标、artifact 增量依旧实时订阅，但不再在页面内展开日志面板。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 p-5">
              {[
                { label: "事件", status: eventsState },
                { label: "指标", status: metricsState },
                { label: "产物", status: artifactsState },
              ].map((item) => (
                <div key={item.label} className="console-data-card flex items-center justify-between px-3 py-3">
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{item.label}</span>
                  <StatusBadge status={item.status} />
                </div>
              ))}
              <div className="rounded-[var(--radius-xl)] border border-[hsl(var(--accent-pink)/0.18)] bg-[hsl(var(--accent-pink)/0.08)] px-4 py-3 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <ShieldAlert className="size-4 text-[hsl(var(--accent-pink))]" />
                  运行输出已进入 GlobalLogDock
                </div>
                <p className="mt-2 text-muted-foreground">
                  实时日志、artifact 回放结果和错误详情已从页面内部移除，统一进入底部日志栏与全局错误中心。
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border/50 pb-3">
              <CardTitle className="text-base">产物与风险分布</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 p-5">
              <DonutChart title="产物类型" data={artifactPie} height={240} />
              <DonutChart title="风险等级" data={riskPie} height={240} />
              <BarChart
                title="最新指标"
                labels={["execs", "coverage", "crash", "hang", "pending"]}
                values={[
                  latestMetric?.execs_done ?? 0,
                  latestMetric?.bitmap_cvg ?? 0,
                  latestMetric?.unique_crashes ?? 0,
                  latestMetric?.unique_hangs ?? 0,
                  latestMetric?.pending_total ?? 0,
                ]}
                height={220}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex h-auto flex-wrap gap-1 bg-secondary/70 p-1">
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="artifacts">产物</TabsTrigger>
          <TabsTrigger value="evidence">证据与活动</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader className="border-b border-border/50 pb-3">
                <CardTitle className="text-base">任务配置</CardTitle>
                <CardDescription>聚合任务目标、目录、AFL 执行器和时间元数据。</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 p-5 md:grid-cols-2">
                {[
                  ["状态", <StatusBadge key="status" status={job.status} />],
                  ["目标程序", jobTarget(job)],
                  ["输入目录", jobInput(job)],
                  ["输出目录", jobOutput(job)],
                  ["工作目录", jobCwd(job)],
                  ["AFL 可执行文件", jobAflPath(job)],
                  ["创建时间", formatDateTime(job.created_at)],
                  ["更新时间", formatDateTime(job.updated_at)],
                ].map(([label, value]) => (
                  <div key={String(label)} className="console-data-card px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{String(label)}</p>
                    <div className="mt-2 break-all text-sm text-foreground">{value}</div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b border-border/50 pb-3">
                <CardTitle className="text-base">最近活动摘要</CardTitle>
                <CardDescription>保留事件上下文，但压缩成高密度活动摘要卡，避免单独占据一个大面板。</CardDescription>
              </CardHeader>
              <CardContent className="p-5">
                <div className="console-scrollbar max-h-[24rem] space-y-3 overflow-y-auto pr-1">
                  {events.length === 0 ? (
                    <EmptyState title="暂无活动更新" description="等待后端 WS 推送，同时可在底部 GlobalLogDock 查看实时输出。" />
                  ) : (
                    lastN(events, 8).reverse().map((event, index) => (
                      <EventSummaryCard key={`${event.timestamp}-${index}`} event={event} />
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="artifacts">
          <Card>
            <CardHeader className="border-b border-border/50 pb-3">
              <CardTitle className="text-base">任务产物</CardTitle>
              <CardDescription>主结果保留 artifact 列表和动作，回放/分析输出写入 GlobalLogDock，并在右侧保留结构化摘要。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 p-5 xl:grid-cols-[1.18fr_0.82fr]">
              <div className="space-y-3">
                {artifacts.length === 0 ? (
                  <EmptyState title="暂无任务产物" description="等待 AFL 输出 crash / hang artifact。" />
                ) : (
                  artifacts.map((artifact) => (
                    <div key={artifact.artifact_id} className="console-data-card flex items-center justify-between gap-4 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={artifact.kind ?? "unknown"} />
                          <span className="truncate text-sm font-medium">{artifact.artifact_id}</span>
                        </div>
                        <p className="mt-1 break-all text-xs text-muted-foreground">{artifact.path}</p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            dockLog("info", "job-artifact", `已请求回放：${artifact.artifact_id}`);
                            replayMutation.mutate({ artifactId: artifact.artifact_id });
                          }}
                        >
                          <PlayCircle className="size-3.5" />
                          回放
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            dockLog("debug", "job-artifact", `已请求分析：${artifact.artifact_id}`);
                            analyzeMutation.mutate({ artifactId: artifact.artifact_id });
                          }}
                        >
                          分析
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-4">
                <Card className="overflow-hidden">
                  <CardHeader className="border-b border-border/50 pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Workflow className="size-4 text-primary" />
                      动作结果摘要
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 p-5">
                    <div className="rounded-[var(--radius-xl)] border border-[hsl(var(--accent-blue)/0.14)] bg-[hsl(var(--accent-blue-light)/0.64)] px-4 py-3 text-sm text-[hsl(var(--accent-blue))] dark:bg-[hsl(var(--accent-blue-light)/0.18)]">
                      {actionResult
                        ? "最近一次产物动作的结构化结果保留在这里，增量过程输出已进入底部 GlobalLogDock。"
                        : "暂无动作结果。请在左侧产物列表执行回放或分析。"}
                    </div>
                    <div className="console-data-card p-4">
                      <JsonViewer data={actionResult ?? { status: "idle" }} compact />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evidence">
          <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
            <Card>
              <CardHeader className="border-b border-border/50 pb-3">
                <CardTitle className="text-base">风险上下文</CardTitle>
                <CardDescription>从实时活动中提取 severity 分布与调度上下文，用于 Wiz 风格的证据摘要。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-5">
                {events.length === 0 ? (
                  <EmptyState title="暂无风险上下文" description="等待事件与指标推送。" />
                ) : (
                  lastN(events, 6).reverse().map((event, index) => (
                    <EventSummaryCard key={`${event.timestamp}-${index}-risk`} event={event} />
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b border-border/50 pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="size-4 text-primary" />
                  结构化证据
                </CardTitle>
                <CardDescription>保留结构化详情入口，但不再在页面内铺开原始监控日志和大块 JSON。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-5">
                <div className="console-data-card p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">产物分布</p>
                  <div className="mt-3">
                    <DonutChart title="产物类型" data={artifactPie} height={220} />
                  </div>
                </div>
                <details className="console-data-card p-4">
                  <summary className="cursor-pointer text-sm font-medium">查看结构化快照</summary>
                  <div className="mt-3">
                    <JsonViewer
                      data={{
                        job,
                        latestMetric,
                        artifacts: artifacts.slice(-8),
                        latestEvents: lastN(events, 8),
                      }}
                      compact
                    />
                  </div>
                </details>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { useDeferredValue, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { ActivitySquare, Search, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { jobsApi } from "@/lib/api/services/jobs";
import { assetsApi } from "@/lib/api/services/assets";
import type { AssetListItem } from "@/types/api/assets";
import type { Job, JobStatus } from "@/types/api/jobs";
import { formatDateTime } from "@/lib/utils/format";
import { StatusBadge } from "@/components/common/status-badge";
import { SummaryCard } from "@/components/common/summary-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { translateJobStatus } from "@/lib/utils/display";
import { JobCreateView } from "@/features/jobs/job-create-view";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function reqStr(job: Job, key: string): string | undefined {
  const request = isRecord(job.request) ? job.request : {};
  const value = request[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function reqBool(job: Job, key: string): boolean | undefined {
  const request = isRecord(job.request) ? job.request : {};
  const value = request[key];
  return typeof value === "boolean" ? value : undefined;
}

function reqArray(job: Job, key: string): string[] | undefined {
  const request = isRecord(job.request) ? job.request : {};
  const value = request[key];
  return Array.isArray(value) ? value.map(String) : undefined;
}

function metadata(job: Job): Record<string, unknown> {
  return isRecord(job.metadata) ? job.metadata : {};
}

function jobName(job: Job): string {
  return job.name ?? reqStr(job, "name") ?? job.job_id;
}

function jobTarget(job: Job): string {
  if (job.target_cmd?.length) return job.target_cmd.join(" ");
  const requestCmd = reqArray(job, "target_cmd");
  if (requestCmd?.length) return requestCmd.join(" ");
  return job.afl?.target_binary ?? "—";
}

function jobTargetBinary(job: Job): string {
  return job.target_cmd?.[0] ?? reqArray(job, "target_cmd")?.[0] ?? job.afl?.target_binary ?? "—";
}

function jobWorkers(job: Job): string {
  return String(job.afl?.workers ?? (typeof job.request?.workers === "number" ? job.request.workers : 1));
}

function jobProtocol(job: Job): string {
  return job.protocol ?? reqStr(job, "protocol") ?? "未标注";
}

function jobNode(job: Job): string {
  const meta = metadata(job);
  const metaNode = typeof meta.node_name === "string" ? meta.node_name : undefined;
  return reqStr(job, "node_name") ?? metaNode ?? "未指定";
}

function jobAflBinary(job: Job): string {
  return job.afl_path ?? reqStr(job, "afl_path") ?? job.afl?.afl_binary ?? "afl-fuzz";
}

function jobScheduler(job: Job): string {
  const meta = metadata(job);
  const metaScheduler = typeof meta.scheduler === "string" ? meta.scheduler : undefined;
  return reqStr(job, "scheduler") ?? metaScheduler ?? "未指定";
}

function jobRiskEnabled(job: Job): boolean {
  const meta = metadata(job);
  const metaRisk = typeof meta.risk_enabled === "boolean" ? meta.risk_enabled : undefined;
  return reqBool(job, "risk_enabled") ?? metaRisk ?? false;
}

function jobHasCrash(job: Job): boolean {
  const metrics = job.last_metrics;
  const request = isRecord(job.request) ? job.request : {};
  const value = metrics?.unique_crashes ?? request.unique_crashes;
  return typeof value === "number" ? value > 0 : false;
}

function jobHasHang(job: Job): boolean {
  const metrics = job.last_metrics;
  const request = isRecord(job.request) ? job.request : {};
  const value = metrics?.unique_hangs ?? request.unique_hangs;
  return typeof value === "number" ? value > 0 : false;
}

function jobHasArtifact(job: Job): boolean {
  return jobHasCrash(job) || jobHasHang(job);
}

function jobTimestamp(job: Job, key: "created_at" | "updated_at"): number {
  const value = job[key];
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function sameOrAfter(date: string | undefined, from: string): boolean {
  if (!from) return true;
  if (!date) return false;
  return new Date(date).getTime() >= new Date(from).getTime();
}

function sameOrBefore(date: string | undefined, to: string): boolean {
  if (!to) return true;
  if (!date) return false;
  return new Date(date).getTime() <= new Date(to).getTime();
}

type TriState = "all" | "yes" | "no";
type SortField = "updated_at" | "created_at" | "status" | "protocol" | "name" | "target" | "workers";
type SortDirection = "desc" | "asc";

const statuses: Array<JobStatus | "all"> = ["all", "starting", "running", "stopping", "finished", "failed"];
const triStateOptions: Array<{ value: TriState; label: string }> = [
  { value: "all", label: "全部" },
  { value: "yes", label: "是" },
  { value: "no", label: "否" },
];

function FormBlock({ label, children }: { label: string; children: JSX.Element }): JSX.Element {
  return (
    <div className="grid gap-2">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function FilterChip({ label, value }: { label: string; value: string }): JSX.Element {
  return <span className="inline-flex items-center rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs text-muted-foreground">{label}：{value}</span>;
}

function JobsListPanel(): JSX.Element {
  const jobsQuery = useQuery({ queryKey: ["jobs"], queryFn: jobsApi.listJobs, refetchInterval: 5_000 });
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [status, setStatus] = useState<JobStatus | "all">("all");
  const [protocol, setProtocol] = useState("all");
  const [targetBinary, setTargetBinary] = useState("");
  const [nodeName, setNodeName] = useState("all");
  const [aflBinary, setAflBinary] = useState("all");
  const [scheduler, setScheduler] = useState("all");
  const [riskEnabled, setRiskEnabled] = useState<TriState>("all");
  const [hasCrash, setHasCrash] = useState<TriState>("all");
  const [hasHang, setHasHang] = useState<TriState>("all");
  const [hasArtifact, setHasArtifact] = useState<TriState>("all");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [updatedFrom, setUpdatedFrom] = useState("");
  const [updatedTo, setUpdatedTo] = useState("");
  const [sortField, setSortField] = useState<SortField>("updated_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const jobs = jobsQuery.data ?? [];
  const protocolOptions = useMemo(() => ["all", ...new Set(jobs.map(jobProtocol).filter(Boolean))], [jobs]);
  const nodeOptions = useMemo(() => ["all", ...new Set(jobs.map(jobNode).filter(Boolean))], [jobs]);
  const aflOptions = useMemo(() => ["all", ...new Set(jobs.map(jobAflBinary).filter(Boolean))], [jobs]);
  const schedulerOptions = useMemo(() => ["all", ...new Set(jobs.map(jobScheduler).filter(Boolean))], [jobs]);

  const filteredData = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();
    const rows = jobs.filter((job) => {
      const rowProtocol = jobProtocol(job);
      const rowNode = jobNode(job);
      const rowAfl = jobAflBinary(job);
      const rowScheduler = jobScheduler(job);
      const rowTargetBinary = jobTargetBinary(job).toLowerCase();
      const haystack = [jobName(job), jobTarget(job), rowProtocol, rowNode, rowAfl, rowScheduler].join(" ").toLowerCase();
      if (status !== "all" && job.status !== status) return false;
      if (protocol !== "all" && rowProtocol !== protocol) return false;
      if (nodeName !== "all" && rowNode !== nodeName) return false;
      if (aflBinary !== "all" && rowAfl !== aflBinary) return false;
      if (scheduler !== "all" && rowScheduler !== scheduler) return false;
      if (targetBinary.trim() && !rowTargetBinary.includes(targetBinary.trim().toLowerCase())) return false;
      if (normalizedSearch && !haystack.includes(normalizedSearch)) return false;
      if (riskEnabled !== "all" && jobRiskEnabled(job) !== (riskEnabled === "yes")) return false;
      if (hasCrash !== "all" && jobHasCrash(job) !== (hasCrash === "yes")) return false;
      if (hasHang !== "all" && jobHasHang(job) !== (hasHang === "yes")) return false;
      if (hasArtifact !== "all" && jobHasArtifact(job) !== (hasArtifact === "yes")) return false;
      if (!sameOrAfter(job.created_at, createdFrom)) return false;
      if (!sameOrBefore(job.created_at, createdTo)) return false;
      if (!sameOrAfter(job.updated_at, updatedFrom)) return false;
      if (!sameOrBefore(job.updated_at, updatedTo)) return false;
      return true;
    });

    return rows.slice().sort((left, right) => {
      const order = sortDirection === "asc" ? 1 : -1;
      if (sortField === "updated_at" || sortField === "created_at") return (jobTimestamp(left, sortField) - jobTimestamp(right, sortField)) * order;
      if (sortField === "workers") return (Number(jobWorkers(left)) - Number(jobWorkers(right))) * order;
      const leftValue = sortField === "status" ? translateJobStatus(left.status) : sortField === "protocol" ? jobProtocol(left) : sortField === "target" ? jobTargetBinary(left) : jobName(left);
      const rightValue = sortField === "status" ? translateJobStatus(right.status) : sortField === "protocol" ? jobProtocol(right) : sortField === "target" ? jobTargetBinary(right) : jobName(right);
      return leftValue.localeCompare(rightValue, "zh-CN") * order;
    });
  }, [aflBinary, createdFrom, createdTo, deferredSearch, hasArtifact, hasCrash, hasHang, jobs, nodeName, protocol, riskEnabled, scheduler, sortDirection, sortField, status, targetBinary, updatedFrom, updatedTo]);

  const columns = useMemo<ColumnDef<Job>[]>(() => [
    {
      id: "name",
      header: "任务",
      cell: ({ row }) => (
        <div className="space-y-1">
          <Link to={`/jobs/${row.original.job_id}`} className="font-medium text-primary hover:underline">{jobName(row.original)}</Link>
          <p className="max-w-[28rem] truncate text-xs text-muted-foreground">{jobTarget(row.original)}</p>
        </div>
      ),
    },
    { id: "status", header: "状态", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    {
      id: "protocol",
      header: "协议 / 节点",
      cell: ({ row }) => <div className="space-y-1 text-xs text-muted-foreground"><p>{jobProtocol(row.original)}</p><p>{jobNode(row.original)}</p></div>,
    },
    {
      id: "runtime",
      header: "AFL / 调度 / 并行",
      cell: ({ row }) => <div className="space-y-1 text-xs text-muted-foreground"><p>{jobAflBinary(row.original)}</p><p>{jobScheduler(row.original)} · workers {jobWorkers(row.original)}</p></div>,
    },
    {
      id: "signals",
      header: "风险 / 样本信号",
      cell: ({ row }) => <div className="space-y-1 text-xs text-muted-foreground"><p>risk {jobRiskEnabled(row.original) ? "on" : "off"}</p><p>crash {jobHasCrash(row.original) ? "yes" : "no"} · hang {jobHasHang(row.original) ? "yes" : "no"}</p></div>,
    },
    {
      id: "updated_at",
      header: "更新时间",
      cell: ({ row }) => <div className="space-y-1 text-xs text-muted-foreground"><p>{formatDateTime(row.original.updated_at)}</p><p>创建于 {formatDateTime(row.original.created_at)}</p></div>,
    },
    { id: "actions", header: "", cell: ({ row }) => <Button asChild size="sm" variant="outline"><Link to={`/jobs/${row.original.job_id}`}>查看详情</Link></Button> },
  ], []);

  const table = useReactTable({ data: filteredData, columns, getCoreRowModel: getCoreRowModel() });
  const activeFilterSummary = [
    status !== "all" ? { label: "状态", value: translateJobStatus(status) } : null,
    protocol !== "all" ? { label: "协议", value: protocol } : null,
    nodeName !== "all" ? { label: "节点", value: nodeName } : null,
    aflBinary !== "all" ? { label: "AFL", value: aflBinary } : null,
    scheduler !== "all" ? { label: "调度", value: scheduler } : null,
    targetBinary.trim() ? { label: "目标程序", value: targetBinary.trim() } : null,
    riskEnabled !== "all" ? { label: "risk", value: riskEnabled === "yes" ? "启用" : "关闭" } : null,
    hasCrash !== "all" ? { label: "crash", value: hasCrash === "yes" ? "有" : "无" } : null,
    hasHang !== "all" ? { label: "hang", value: hasHang === "yes" ? "有" : "无" } : null,
    hasArtifact !== "all" ? { label: "artifact", value: hasArtifact === "yes" ? "有" : "无" } : null,
    deferredSearch.trim() ? { label: "关键词", value: deferredSearch.trim() } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><SlidersHorizontal className="size-4 text-[hsl(var(--accent-blue))]" />高密度过滤面板</CardTitle>
          <CardDescription>当前高级筛选与排序仍是前端本地计算，真实列表来自 `GET /api/v1/jobs`。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_repeat(4,minmax(0,1fr))]">
            <div className="relative xl:col-span-2">
              <Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
              <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索任务名、目标命令、协议、节点、AFL binary" />
            </div>
            <Select value={status} onValueChange={(value) => setStatus(value as JobStatus | "all")}><SelectTrigger><SelectValue placeholder="状态" /></SelectTrigger><SelectContent>{statuses.map((item) => <SelectItem key={item} value={item}>{item === "all" ? "全部状态" : translateJobStatus(item)}</SelectItem>)}</SelectContent></Select>
            <Select value={protocol} onValueChange={setProtocol}><SelectTrigger><SelectValue placeholder="协议" /></SelectTrigger><SelectContent>{protocolOptions.map((item) => <SelectItem key={item} value={item}>{item === "all" ? "全部协议" : item}</SelectItem>)}</SelectContent></Select>
            <Select value={nodeName} onValueChange={setNodeName}><SelectTrigger><SelectValue placeholder="节点" /></SelectTrigger><SelectContent>{nodeOptions.map((item) => <SelectItem key={item} value={item}>{item === "all" ? "全部节点" : item}</SelectItem>)}</SelectContent></Select>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <FormBlock label="目标程序"><Input value={targetBinary} onChange={(event) => setTargetBinary(event.target.value)} placeholder="按 target binary 模糊匹配" /></FormBlock>
            <FormBlock label="AFL binary"><Select value={aflBinary} onValueChange={setAflBinary}><SelectTrigger><SelectValue placeholder="AFL binary" /></SelectTrigger><SelectContent>{aflOptions.map((item) => <SelectItem key={item} value={item}>{item === "all" ? "全部 AFL binary" : item}</SelectItem>)}</SelectContent></Select></FormBlock>
            <FormBlock label="调度策略"><Select value={scheduler} onValueChange={setScheduler}><SelectTrigger><SelectValue placeholder="调度策略" /></SelectTrigger><SelectContent>{schedulerOptions.map((item) => <SelectItem key={item} value={item}>{item === "all" ? "全部调度策略" : item}</SelectItem>)}</SelectContent></Select></FormBlock>
            <FormBlock label="risk 是否启用"><Select value={riskEnabled} onValueChange={(value) => setRiskEnabled(value as TriState)}><SelectTrigger><SelectValue placeholder="risk" /></SelectTrigger><SelectContent>{triStateOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></FormBlock>
            <FormBlock label="排序字段"><Select value={sortField} onValueChange={(value) => setSortField(value as SortField)}><SelectTrigger><SelectValue placeholder="排序字段" /></SelectTrigger><SelectContent><SelectItem value="updated_at">更新时间</SelectItem><SelectItem value="created_at">创建时间</SelectItem><SelectItem value="status">状态</SelectItem><SelectItem value="protocol">协议</SelectItem><SelectItem value="name">任务名</SelectItem><SelectItem value="target">目标程序</SelectItem><SelectItem value="workers">并行数</SelectItem></SelectContent></Select></FormBlock>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <FormBlock label="是否有 crash"><Select value={hasCrash} onValueChange={(value) => setHasCrash(value as TriState)}><SelectTrigger><SelectValue placeholder="crash" /></SelectTrigger><SelectContent>{triStateOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></FormBlock>
            <FormBlock label="是否有 hang"><Select value={hasHang} onValueChange={(value) => setHasHang(value as TriState)}><SelectTrigger><SelectValue placeholder="hang" /></SelectTrigger><SelectContent>{triStateOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></FormBlock>
            <FormBlock label="是否有 artifact"><Select value={hasArtifact} onValueChange={(value) => setHasArtifact(value as TriState)}><SelectTrigger><SelectValue placeholder="artifact" /></SelectTrigger><SelectContent>{triStateOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></FormBlock>
            <FormBlock label="排序方向"><Select value={sortDirection} onValueChange={(value) => setSortDirection(value as SortDirection)}><SelectTrigger><SelectValue placeholder="排序方向" /></SelectTrigger><SelectContent><SelectItem value="desc">降序</SelectItem><SelectItem value="asc">升序</SelectItem></SelectContent></Select></FormBlock>
            <div className="flex items-end"><Button type="button" variant="outline" className="w-full" onClick={() => { setSearch(""); setStatus("all"); setProtocol("all"); setTargetBinary(""); setNodeName("all"); setAflBinary("all"); setScheduler("all"); setRiskEnabled("all"); setHasCrash("all"); setHasHang("all"); setHasArtifact("all"); setCreatedFrom(""); setCreatedTo(""); setUpdatedFrom(""); setUpdatedTo(""); setSortField("updated_at"); setSortDirection("desc"); }}>重置筛选</Button></div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <FormBlock label="创建时间起"><Input type="date" value={createdFrom} onChange={(event) => setCreatedFrom(event.target.value)} /></FormBlock>
            <FormBlock label="创建时间止"><Input type="date" value={createdTo} onChange={(event) => setCreatedTo(event.target.value)} /></FormBlock>
            <FormBlock label="更新时间起"><Input type="date" value={updatedFrom} onChange={(event) => setUpdatedFrom(event.target.value)} /></FormBlock>
            <FormBlock label="更新时间止"><Input type="date" value={updatedTo} onChange={(event) => setUpdatedTo(event.target.value)} /></FormBlock>
          </div>

          {activeFilterSummary.length > 0 ? <div className="flex flex-wrap gap-2">{activeFilterSummary.map((item) => <FilterChip key={`${item.label}-${item.value}`} label={item.label} value={item.value} />)}</div> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>任务列表</CardTitle>
          <CardDescription>当前共 {filteredData.length} 条，接口刷新频率 5 秒。</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>)}</TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => <TableRow key={row.id}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={7} className="py-16 text-center text-muted-foreground">当前筛选条件下没有任务记录。</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function JobsMonitorPanel(): JSX.Element {
  const summaryQuery = useQuery({ queryKey: ["jobs-summary"], queryFn: jobsApi.requestSummary });
  const jobsQuery = useQuery({ queryKey: ["jobs"], queryFn: jobsApi.listJobs, refetchInterval: 5_000 });
  const artifactsQuery = useQuery({ queryKey: ["assets-jobs"], queryFn: () => assetsApi.listAssets({ scope: "jobs" }) });

  const summary = (summaryQuery.data as Record<string, unknown> | null) ?? {};
  const recentJobs = (summary.recent_jobs as Job[] | undefined) ?? (jobsQuery.data ?? []).slice(0, 8);
  const recentArtifacts = (artifactsQuery.data ?? []).slice(0, 8);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="任务总数" value={String(summary.total ?? jobsQuery.data?.length ?? 0)} hint="jobs/summary" statusColor="blue" />
        <SummaryCard title="运行中" value={String(summary.running ?? 0)} hint="running" statusColor="teal" />
        <SummaryCard title="Crash" value={String(summary.crash_count ?? 0)} hint="artifact signals" statusColor="rose" />
        <SummaryCard title="Hang" value={String(summary.hang_count ?? 0)} hint="artifact signals" statusColor="gold" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><ActivitySquare className="size-4 text-[hsl(var(--accent-blue))]" />最近任务</CardTitle>
            <CardDescription>保留 Fuzz 任务主入口，同时在监控区汇总最近运行状态。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentJobs.length === 0 ? <div className="rounded-[var(--radius-lg)] border border-dashed border-border/70 bg-background/50 px-4 py-8 text-sm text-muted-foreground">暂无任务数据。</div> : recentJobs.map((job) => (
              <div key={job.job_id} className="rounded-[var(--radius-lg)] border border-border/60 bg-background/50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link to={`/jobs/${job.job_id}`} className="truncate text-sm font-medium text-primary hover:underline">{jobName(job)}</Link>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{jobTarget(job)}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{jobProtocol(job)} / {jobNode(job)} / {jobAflBinary(job)}</p>
                  </div>
                  <StatusBadge status={job.status} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>任务产物</CardTitle>
            <CardDescription>复用产物搜索接口，集中查看 `jobs` scope 可视资源。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentArtifacts.length === 0 ? <div className="rounded-[var(--radius-lg)] border border-dashed border-border/70 bg-background/50 px-4 py-8 text-sm text-muted-foreground">暂无可视产物。</div> : recentArtifacts.map((item: AssetListItem, index) => (
              <div key={`${item.workspace_ref}-${index}`} className="rounded-[var(--radius-lg)] border border-border/60 bg-background/50 p-4">
                <p className="text-sm font-medium">{item.name ?? item.virtual_path ?? item.workspace_ref}</p>
                <p className="mt-1 break-all text-xs text-muted-foreground">{item.workspace_ref}</p>
                <p className="mt-2 text-xs text-muted-foreground">{item.protocol} / {item.scope ?? "jobs"} / {item.kind ?? item.type ?? "-"}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function JobsView(): JSX.Element {
  const [tab, setTab] = useState("create");
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Fuzz 任务"
        title="Fuzz 任务"
        description="将创建任务、任务列表与监控/产物合并到同一入口，减少侧边栏分裂导航。"
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto flex-wrap gap-2 bg-transparent p-0">
          <TabsTrigger value="create" className="rounded-full border border-border/60 bg-background/60 px-4 py-2 data-[state=active]:bg-card">创建任务</TabsTrigger>
          <TabsTrigger value="list" className="rounded-full border border-border/60 bg-background/60 px-4 py-2 data-[state=active]:bg-card">任务列表</TabsTrigger>
          <TabsTrigger value="monitor" className="rounded-full border border-border/60 bg-background/60 px-4 py-2 data-[state=active]:bg-card">监控 / 产物</TabsTrigger>
        </TabsList>
        <TabsContent value="create" className="mt-4"><JobCreateView /></TabsContent>
        <TabsContent value="list" className="mt-4"><JobsListPanel /></TabsContent>
        <TabsContent value="monitor" className="mt-4"><JobsMonitorPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

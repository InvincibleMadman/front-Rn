import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Search, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiErrorReporter, ApiErrorToast } from "@/components/common/api-error-alert";
import { JsonViewer } from "@/components/common/json-viewer";
import { StatusBadge } from "@/components/common/status-badge";
import { SummaryCard } from "@/components/common/summary-card";
import { EchartsBase, useEchartsPalette, type ChartOption } from "@/components/charts/echarts-base";
import { protocolsApi } from "@/lib/api/services/protocols";
import { vulnHistoryApi } from "@/lib/api/services/vuln-history";
import { debugApi } from "@/lib/api/services/debug";
import { jobsApi } from "@/lib/api/services/jobs";
import { formatDateTime } from "@/lib/utils/format";
import type { VulnHistoryRecord } from "@/types/api/vuln-history";

const coarseTypeOptions = [
  ["all", "全部类型"],
  ["memory-corruption", "内存破坏"],
  ["bounds-check", "边界检查"],
  ["null-deref", "空指针解引用"],
  ["use-after-free", "释放后使用"],
  ["integer-issue", "整数问题"],
  ["parser-state", "解析状态异常"],
  ["auth-logic", "认证逻辑"],
  ["resource-exhaustion", "资源耗尽"],
  ["protocol-state-machine", "协议状态机"],
  ["unknown", "未知"],
] as const;

function recordId(record: VulnHistoryRecord): string {
  return record.record_id ?? record.id ?? record.debug_session_id ?? record.artifact_id ?? "";
}

function field(record: VulnHistoryRecord, name: keyof VulnHistoryRecord, fallback = "-"): string {
  const value = record[name];
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

function haystack(record: VulnHistoryRecord): string {
  return [
    record.title,
    record.root_cause,
    record.stack_summary,
    record.file,
    record.file_path,
    record.function,
    record.function_name,
    record.cwe,
    record.crash_signature,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function severityFromRecord(record: VulnHistoryRecord): "danger" | "orange" | "violet" | "blue" {
  const confidence = Number(record.confidence ?? 0);
  if (confidence >= 0.85) return "danger";
  if (confidence >= 0.65) return "orange";
  if ((record.coarse_type ?? "").includes("protocol")) return "violet";
  return "blue";
}

function donutOption(items: Array<{ name: string; value: number }>, palette: string[]): ChartOption {
  return {
    color: palette,
    tooltip: { trigger: "item" },
    series: [
      {
        type: "pie",
        radius: ["54%", "74%"],
        center: ["50%", "50%"],
        label: { show: true, formatter: "{b}: {c}" },
        data: items,
      },
    ],
  };
}

export function VulnHistoryView(): JSX.Element {
  const palette = useEchartsPalette();
  const [protocol, setProtocol] = useState("");
  const [coarseType, setCoarseType] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [cwe, setCwe] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [selected, setSelected] = useState<VulnHistoryRecord | null>(null);

  const protocolsQuery = useQuery({ queryKey: ["protocols"], queryFn: protocolsApi.listProtocols, retry: 0 });
  const historyQuery = useQuery({
    queryKey: ["vuln-history", protocol, coarseType],
    queryFn: () => vulnHistoryApi.records(protocol, { coarse_type: coarseType === "all" ? undefined : coarseType, keyword, cwe, limit: 100, offset: 0 }),
    enabled: Boolean(protocol),
    retry: 0,
  });
  const summaryQuery = useQuery({
    queryKey: ["vuln-summary", protocol],
    queryFn: () => vulnHistoryApi.summary(protocol),
    enabled: Boolean(protocol),
    retry: 0,
  });
  const debugSummaryQuery = useQuery({
    queryKey: ["debug-summary", protocol],
    queryFn: () => debugApi.getProtocolSummary(protocol),
    enabled: Boolean(protocol),
    retry: 0,
  });
  const jobsSummaryQuery = useQuery({
    queryKey: ["jobs-summary-for-vuln"],
    queryFn: jobsApi.requestSummary,
    retry: 0,
  });
  const detailQuery = useQuery({
    queryKey: ["vuln-history-detail", protocol, recordId(selected ?? {})],
    queryFn: () => vulnHistoryApi.get(protocol, recordId(selected ?? {})),
    enabled: Boolean(protocol && selected && recordId(selected)),
    retry: 0,
  });

  const records = useMemo(() => {
    const base = historyQuery.data?.items ?? historyQuery.data?.records ?? [];
    return base
      .sort((a, b) => {
        const ad = new Date(a.created_at ?? 0).getTime();
        const bd = new Date(b.created_at ?? 0).getTime();
        return sortOrder === "desc" ? bd - ad : ad - bd;
      });
  }, [historyQuery.data, sortOrder]);

  const detail = detailQuery.data ?? selected;

  const stats = useMemo(() => {
    const total = records.length;
    const highConfidence = records.filter((item) => Number(item.confidence ?? 0) >= 0.8).length;
    const protocolMachine = records.filter((item) => item.coarse_type === "protocol-state-machine").length;
    const memoryRelated = records.filter((item) => item.coarse_type === "memory-corruption").length;
    return { total, highConfidence, protocolMachine, memoryRelated };
  }, [records]);

  const coarseTypeDonut = useMemo(
    () =>
      Object.entries((summaryQuery.data?.by_coarse_type as Record<string, number> | undefined) ?? {}).map(([name, value]) => ({ name, value })),
    [summaryQuery.data],
  );
  const cweDonut = useMemo(
    () => Object.entries((summaryQuery.data?.by_cwe as Record<string, number> | undefined) ?? {}).slice(0, 8).map(([name, value]) => ({ name, value })),
    [summaryQuery.data],
  );

  return (
    <div className="space-y-6">
      <ApiErrorReporter error={protocolsQuery.error} title="协议列表加载失败" source="offline" />
      <ApiErrorReporter error={historyQuery.error} title="漏洞历史加载失败" source="offline" />
      <ApiErrorReporter error={detailQuery.error} title="漏洞详情加载失败" source="offline" />
      <ApiErrorToast error={historyQuery.error} title="漏洞历史加载失败" />
      <ApiErrorToast error={detailQuery.error} title="漏洞详情加载失败" />

      <PageHeader
        eyebrow="漏洞中心"
        title="漏洞中心"
        description="复用原漏洞历史与调试归档逻辑，补充协议级汇总、类型分布、Crash/Risk/GDB 关联信息。"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="记录总数" value={String(stats.total)} hint="当前协议范围" statusColor="blue" />
        <SummaryCard title="高置信度" value={String(stats.highConfidence)} hint="置信度 >= 0.8" statusColor="danger" />
        <SummaryCard title="协议状态机" value={String(stats.protocolMachine)} hint="protocol-state-machine" statusColor="violet" />
        <SummaryCard title="内存相关" value={String(stats.memoryRelated)} hint="memory-corruption" statusColor="orange" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>漏洞类型分布</CardTitle>
            <CardDescription>协议级 `coarse_type` 与 `CWE` 统计，来自标准化 vulnerabilities summary。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <EchartsBase option={donutOption(coarseTypeDonut, palette)} height={300} />
            <EchartsBase option={donutOption(cweDonut, palette)} height={300} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Crash / Risk / GDB 汇总</CardTitle>
            <CardDescription>保持 GDB 独立页，同时将其 summary 纳入漏洞中心。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[var(--radius-lg)] border border-border/60 bg-background/50 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Jobs</p>
              <p className="mt-2 text-sm">运行中 {String(jobsSummaryQuery.data?.running ?? 0)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Crash {String(jobsSummaryQuery.data?.crash_count ?? 0)} / Hang {String(jobsSummaryQuery.data?.hang_count ?? 0)}</p>
            </div>
            <div className="rounded-[var(--radius-lg)] border border-border/60 bg-background/50 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">GDB</p>
              <p className="mt-2 text-sm">会话 {String(debugSummaryQuery.data?.total ?? 0)}</p>
              <p className="mt-1 text-xs text-muted-foreground">最近会话 {String(debugSummaryQuery.data?.recent_sessions?.length ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.72fr_1.08fr_0.9fr]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="text-base">筛选条件</CardTitle>
            <CardDescription>协议、类型、关键词、CWE 与排序集中放在左侧，保持紧凑，不铺满整页。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <Input list="protocols-list" value={protocol} onChange={(event) => setProtocol(event.target.value)} placeholder="输入协议名" />
            <datalist id="protocols-list">
              {(protocolsQuery.data ?? [""]).map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>

            <Select value={coarseType} onValueChange={setCoarseType}>
              <SelectTrigger>
                <SelectValue placeholder="选择粗粒度类型" />
              </SelectTrigger>
              <SelectContent>
                {coarseTypeOptions.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative">
              <Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
              <Input className="pl-9" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="标题 / 根因 / 函数名" />
            </div>

            <Input value={cwe} onChange={(event) => setCwe(event.target.value)} placeholder="输入 CWE，例如 CWE-125" />

            <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as "desc" | "asc")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">最新优先</SelectItem>
                <SelectItem value="asc">最早优先</SelectItem>
              </SelectContent>
            </Select>

            <div className="rounded-[var(--radius-xl)] border border-[hsl(var(--accent-pink)/0.18)] bg-[hsl(var(--accent-pink)/0.08)] px-4 py-3 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <ShieldAlert className="size-4 text-[hsl(var(--accent-pink))]" />
                历史归档说明
              </div>
              <p className="mt-2 text-muted-foreground">
                页面仅展示后端返回的真实归档结果，不使用 mock 数据掩盖接口失败。
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="text-base">历史记录</CardTitle>
            <CardDescription>Crash / Risk / GDB 关联表。选中任一记录后在右侧查看证据与推理。</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <Table>
                <TableHeader className="table-header-row sticky top-0 z-10">
                    <TableRow>
                      <TableHead>标题</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>CWE</TableHead>
                      <TableHead>关联</TableHead>
                      <TableHead>位置</TableHead>
                      <TableHead>创建时间</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                  {records.length ? (
                    records.map((record, index) => (
                      <TableRow key={recordId(record) || index} className="cursor-pointer" onClick={() => setSelected(record)}>
                        <TableCell>
                          <div className="max-w-[20rem]">
                            <p className="truncate font-medium">{record.title ?? recordId(record) ?? "未命名"}</p>
                            <p className="truncate text-xs text-muted-foreground">{record.crash_signature}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <StatusBadge status={record.coarse_type ?? "unknown"} />
                            <p className="text-xs text-muted-foreground">{record.vuln_type ?? "-"}</p>
                          </div>
                        </TableCell>
                        <TableCell>{record.cwe ?? "-"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <p>{record.debug_session_id ? "GDB 已关联" : "GDB 待补"}</p>
                          <p>{record.artifact_id ? "Crash 已归档" : "Crash 待补"}</p>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <p className="max-w-[14rem] truncate">{record.file_path ?? record.file}</p>
                          <p>{record.function_name ?? record.function}:{record.line ?? "-"}</p>
                        </TableCell>
                        <TableCell>{formatDateTime(record.created_at)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="py-16 text-center text-muted-foreground">
                        {protocol ? "没有匹配的归档记录。" : "请先选择协议，再加载归档结果。"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-[hsl(var(--accent-orange))]" />
              证据详情
            </CardTitle>
            <CardDescription>右侧集中展示根因、定位、修复建议与会话关联，原始结构折叠到详情展开区。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            {!detail ? (
              <p className="text-sm text-muted-foreground">请选择一条记录查看详情。</p>
            ) : (
              <>
                <div className={`summary-card-shell ${severityFromRecord(detail) === "danger" ? "summary-card-danger" : severityFromRecord(detail) === "orange" ? "summary-card-orange" : severityFromRecord(detail) === "violet" ? "summary-card-violet" : "summary-card-blue"} p-5`}>
                  <div className="summary-card-orb" />
                  <div className="relative">
                    <p className="summary-card-title text-xs uppercase tracking-[0.18em]">根因</p>
                    <p className="summary-card-value mt-3 text-base font-semibold">{field(detail, "root_cause")}</p>
                    <p className="summary-card-copy mt-3 text-sm">{field(detail, "direct_cause")}</p>
                  </div>
                </div>

                <div className="console-data-card p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">定位</p>
                  <p className="mt-2 text-sm font-medium text-foreground">{field(detail, "function_name")}</p>
                  <p className="mt-1 break-all text-xs text-muted-foreground">{field(detail, "file_path", field(detail, "file"))}</p>
                  <p className="mt-1 text-xs text-muted-foreground">行号 {field(detail, "line")}</p>
                </div>

                <div className="console-data-card p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">PoC / 修复建议</p>
                  <p className="mt-2 text-sm text-foreground">{field(detail, "poc_concept")}</p>
                  <p className="mt-3 text-sm text-muted-foreground">{field(detail, "fix_suggestion")}</p>
                </div>

                <div className="console-data-card p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">会话关联</p>
                  <p className="mt-2 text-sm text-foreground">{field(detail, "debug_session_id")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">产物 {field(detail, "artifact_id")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">置信度 {field(detail, "confidence")}</p>
                </div>

                <details className="console-data-card p-4">
                  <summary className="cursor-pointer text-sm font-medium">查看原始详情</summary>
                  <div className="mt-3">
                    <JsonViewer data={detail} compact />
                  </div>
                </details>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

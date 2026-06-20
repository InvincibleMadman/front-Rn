import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, GitBranch, Link2, ShieldAlert } from "lucide-react";
import { PageHeroBoard } from "@/components/layout/page-hero-board";
import { ApiErrorReporter } from "@/components/common/api-error-alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/common/empty-state";
import { dockLog } from "@/components/layout/dock";
import { protocolsApi } from "@/lib/api/services/protocols";
import { vulnHistoryApi } from "@/lib/api/services/vuln-history";
import { VulnStatusBoard } from "@/features/vuln-history/components/vuln-status-board";
import { VulnQueryBar } from "@/features/vuln-history/components/vuln-query-bar";
import { VulnTypeDistributionChart } from "@/features/vuln-history/components/vuln-type-distribution-chart";
import { VulnTrendChart } from "@/features/vuln-history/components/vuln-trend-chart";
import { VulnRecordList } from "@/features/vuln-history/components/vuln-record-list";
import { VulnEvidencePanel } from "@/features/vuln-history/components/vuln-evidence-panel";
import type { VulnHistoryRecord, VulnQuery, VulnSummary } from "@/types/api/vuln-history";

function recordKey(record?: VulnHistoryRecord | null): string | undefined {
  if (!record) return undefined;
  return record.record_id ?? record.id ?? record.debug_session_id ?? record.artifact_id ?? `${record.protocol}-${record.title}`;
}

function statusPercent(value: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

export function VulnHistoryView(): JSX.Element {
  const [mode, setMode] = useState<"global" | "protocol">("global");
  const [protocol, setProtocol] = useState("");
  const [query, setQuery] = useState<VulnQuery>({ limit: 100, sort: "updated_at", order: "desc" });
  const [selected, setSelected] = useState<VulnHistoryRecord | undefined>(undefined);

  useEffect(() => {
    dockLog("info", "vuln", "entered vulnerability center", { mode });
    return () => dockLog("info", "vuln", "left vulnerability center");
  }, []);

  const protocolsQuery = useQuery({ queryKey: ["protocols"], queryFn: protocolsApi.listProtocols, retry: 0 });
  const effectiveProtocol = mode === "protocol" ? protocol : undefined;
  const missingProtocol = mode === "protocol" && !protocol;

  const summaryQuery = useQuery({
    queryKey: ["vuln-summary", effectiveProtocol],
    queryFn: () => vulnHistoryApi.getSummary(effectiveProtocol ? { protocol: effectiveProtocol } : {}),
    retry: 0,
    enabled: !missingProtocol,
  });
  const trendsQuery = useQuery({
    queryKey: ["vuln-trends", effectiveProtocol],
    queryFn: () => vulnHistoryApi.getTrends(effectiveProtocol ? { protocol: effectiveProtocol } : {}),
    retry: 0,
    enabled: !missingProtocol,
  });
  const recordsQuery = useQuery({
    queryKey: ["vuln-records", effectiveProtocol, query],
    queryFn: () => vulnHistoryApi.records({ ...query, protocol: effectiveProtocol }),
    retry: 0,
    enabled: !missingProtocol,
  });

  const records = useMemo(() => (recordsQuery.data?.items ?? recordsQuery.data?.records ?? []), [recordsQuery.data]);
  const summary = summaryQuery.data;

  useEffect(() => {
    if (records.length) {
      setSelected((current) => {
        const currentId = recordKey(current);
        const matched = records.find((item) => recordKey(item) === currentId);
        return matched ?? records[0];
      });
    } else {
      setSelected(undefined);
    }
  }, [records]);

  const closureRows = useMemo(() => {
    const closure = summary?.closure_status ?? {};
    const total = Object.values(closure).reduce((acc, item) => acc + Number(item ?? 0), 0);
    return Object.entries(closure).sort((a, b) => Number(b[1]) - Number(a[1]));
  }, [summary]);

  const selectionHint = mode === "protocol" ? `单协议：${protocol || "未选择协议"}` : "全局：跨全部协议汇总";

  return (
    <div className="space-y-5">
      <ApiErrorReporter error={protocolsQuery.error} title="加载协议列表失败" source="vuln" />
      <ApiErrorReporter error={summaryQuery.error} title="加载漏洞汇总失败" source="vuln" />
      <ApiErrorReporter error={trendsQuery.error} title="加载漏洞趋势失败" source="vuln" />
      <ApiErrorReporter error={recordsQuery.error} title="加载漏洞记录失败" source="vuln" />

      <PageHeroBoard
          eyebrow="V U L N E R A B I L I T Y · O P S"
          title="漏洞中心"
          description="按安全运营页组织：顶部 sticky 检索，中部类型分布 / 趋势 / 闭环状态，下方左记录列表右证据详情；全局与单协议必须真实区分。"
          board={<VulnStatusBoard summary={summary} />}
      />

      <VulnQueryBar
        mode={mode}
        protocol={protocol}
        protocolOptions={protocolsQuery.data ?? []}
        query={query}
        onModeChange={(next) => {
          setMode(next);
          setSelected(undefined);
          dockLog("info", "vuln", "vulnerability mode changed", { mode: next });
        }}
        onProtocolChange={(next) => {
          setProtocol(next);
          setSelected(undefined);
          dockLog("info", "vuln", "vulnerability protocol changed", { protocol: next || "all" });
        }}
        onQueryChange={(next) => {
          setQuery(next);
          setSelected(undefined);
          dockLog("info", "vuln", "vulnerability filters updated", next);
        }}
      />

      {missingProtocol ? (
        <Card className="card-surface">
          <CardContent className="p-5">
            <EmptyState title="单协议模式尚未选择协议" description="你要求单协议模式必须可选协议并真实联动数据；请选择协议后再查看 summary、趋势、分布与证据详情。" />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[1.15fr_1.1fr_0.8fr]">
            <Card className="card-surface overflow-hidden">
              <CardHeader className="border-b border-border/50 pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><GitBranch className="size-4.5" /> 类型分布</CardTitle>
              </CardHeader>
              <CardContent className="pt-5">
                <VulnTypeDistributionChart summary={summary} />
              </CardContent>
            </Card>

            <Card className="card-surface overflow-hidden">
              <CardHeader className="border-b border-border/50 pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><Activity className="size-4.5" /> 趋势图</CardTitle>
              </CardHeader>
              <CardContent className="pt-5">
                <VulnTrendChart data={trendsQuery.data} />
              </CardContent>
            </Card>

            <Card className="card-surface">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><ShieldAlert className="size-4.5" /> 闭环状态</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="rounded-[var(--radius-lg)] border border-border/60 bg-card p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">当前视角</p>
                  <p className="mt-2 font-medium">{selectionHint}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{summary?.mode === "protocol" ? "协议内明细与证据联动" : "跨协议运营总览"}</p>
                </div>
                {closureRows.map(([key, value]) => (
                  <div key={key} className="rounded-[var(--radius-lg)] border border-border/60 bg-card px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">{key}</span>
                      <span className="font-semibold">{String(value)}</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-muted/80">
                      <div className="h-1.5 rounded-full bg-primary" style={{ width: statusPercent(Number(value), summary?.total ?? 0) }} />
                    </div>
                  </div>
                ))}
                {!closureRows.length ? <div className="rounded-[var(--radius-lg)] border border-dashed border-border/70 bg-card px-4 py-8 text-center text-sm text-muted-foreground">当前没有闭环状态统计。</div> : null}
                <div className="rounded-[var(--radius-lg)] border border-border/60 bg-card p-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2 text-foreground"><Link2 className="size-4" /> 关联摘要</div>
                  <p className="mt-2">GDB：{summary?.linked_debug ?? 0} · Crash：{summary?.linked_crash ?? 0} · 未关联：{summary?.unlinked_records ?? 0}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.15fr_1.1fr_0.8fr] xl:items-start">
            <Card className="card-surface xl:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">漏洞记录</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-[var(--radius-lg)] border border-border/60 bg-card px-4 py-3 text-sm text-muted-foreground">
                  当前记录 {records.length} 条，{mode === "protocol" ? `已按协议 ${protocol} 过滤` : "展示跨协议汇总记录"}。
                </div>
                {records.length ? (
                  <VulnRecordList
                    records={records}
                    selectedId={recordKey(selected)}
                    onSelect={(record) => {
                      setSelected(record);
                      dockLog("info", "vuln", "selected vulnerability record", { record_id: recordKey(record), protocol: record.protocol, coarse_type: record.coarse_type });
                    }}
                  />
                ) : (
                  <EmptyState title="暂无漏洞记录" description="切换模式、协议或放宽筛选条件后再查看。" />
                )}
              </CardContent>
            </Card>
            <VulnEvidencePanel record={selected} />
          </div>
        </>
      )}
    </div>
  );
}

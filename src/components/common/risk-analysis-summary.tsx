import { AlertTriangle, ChevronDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SummaryCard } from "@/components/common/summary-card";
import { JsonViewer } from "@/components/common/json-viewer";
import type { RiskAnalyzeResponse, RiskFailedChunk, RiskFinding, RiskSummary } from "@/types/api/offline";

function normalizeSummary(data?: RiskAnalyzeResponse | null): RiskSummary {
  return data?.summary ?? data?.analysis?.summary ?? {
    total_findings: data?.analysis?.total_findings ?? data?.findings?.length ?? data?.items?.length ?? 0,
  };
}

function normalizeFindings(data?: RiskAnalyzeResponse | null): RiskFinding[] {
  return data?.findings ?? data?.analysis?.findings ?? data?.items ?? [];
}

function normalizeFailedChunks(data?: RiskAnalyzeResponse | null): RiskFailedChunk[] {
  return data?.failed_chunks ?? data?.analysis?.failed_chunks ?? [];
}

function normalizeWarnings(data?: RiskAnalyzeResponse | null): string[] {
  return data?.warnings ?? data?.analysis?.warnings ?? [];
}

function value(input: unknown): string {
  if (input === null || input === undefined || input === "") return "—";
  return String(input);
}

function duration(ms?: number): string {
  if (!ms && ms !== 0) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function RiskAnalysisSummary({ data }: { data?: RiskAnalyzeResponse | null }): JSX.Element {
  const summary = normalizeSummary(data);
  const findings = normalizeFindings(data);
  const failedChunks = normalizeFailedChunks(data);
  const warnings = normalizeWarnings(data);

  if (!data) {
    return <JsonViewer data={{ status: "idle" }} compact />;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="total_files" value={value(summary.total_files)} hint="扫描文件总数" statusColor="blue" />
        <SummaryCard title="selected_files" value={value(summary.selected_files)} hint="静态预筛后文件" statusColor="cyan" />
        <SummaryCard title="total_chunks" value={value(summary.total_chunks)} hint="函数/文件切片数" statusColor="amber" />
        <SummaryCard title="completed_chunks" value={value(summary.completed_chunks)} hint={`失败 ${summary.failed_chunks ?? failedChunks.length}`} statusColor="emerald" />
        <SummaryCard title="failed_chunks" value={value(summary.failed_chunks ?? failedChunks.length)} hint="可展开查看失败原因" statusColor="rose" />
        <SummaryCard title="cache_hits" value={value(summary.cache_hits)} hint="LLM/静态分析缓存命中" statusColor="indigo" />
        <SummaryCard title="total_findings" value={value(summary.total_findings ?? findings.length)} hint="风险发现数量" statusColor="orange" />
        <SummaryCard title="duration_ms" value={duration(summary.duration_ms)} hint={value(summary.duration_ms)} statusColor="slate" />
      </div>

      {warnings.length ? (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
          <div className="mb-2 flex items-center gap-2 font-medium"><AlertTriangle className="size-4" />风险分析警告</div>
          <ul className="list-inside list-disc space-y-1 text-muted-foreground">
            {warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
          </ul>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>findings</CardTitle>
          <CardDescription>结构化展示 file_path / function_name / severity / confidence / risk_type / recommended_probe.kind。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {findings.length === 0 ? <p className="text-sm text-muted-foreground">暂无 findings。</p> : findings.map((finding, index) => (
            <div key={finding.id ?? `${finding.file_path ?? finding.file ?? "finding"}-${index}`} className="rounded-xl border border-border/60 bg-background/50 p-3">
              <div className="grid gap-2 text-sm md:grid-cols-2">
                <div className="break-all"><span className="font-medium">file_path：</span>{value(finding.file_path ?? finding.file)}</div>
                <div><span className="font-medium">function_name：</span>{value(finding.function_name)}</div>
                <div><span className="font-medium">line：</span>{value(finding.line_start ?? finding.line)} - {value(finding.line_end ?? finding.line)}</div>
                <div><span className="font-medium">severity：</span>{value(finding.severity ?? finding.severity_level)}</div>
                <div><span className="font-medium">confidence：</span>{value(finding.confidence ?? finding.confidence_score)}</div>
                <div><span className="font-medium">risk_type：</span>{value(finding.risk_type ?? finding.pattern)}</div>
                <div className="md:col-span-2"><span className="font-medium">reason：</span>{value(finding.reason)}</div>
                <div className="md:col-span-2"><span className="font-medium">recommended_probe.kind：</span>{value(finding.recommended_probe?.kind)}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <details className="rounded-xl border border-border/60 bg-background/50 p-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium"><ChevronDown className="size-4" />failed_chunks / warnings / raw JSON</summary>
        <div className="mt-3 space-y-4">
          <JsonViewer data={{ failed_chunks: failedChunks, warnings, raw: data }} compact />
        </div>
      </details>
    </div>
  );
}

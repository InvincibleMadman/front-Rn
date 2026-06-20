import { Download, FileWarning, History, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ReportPreview, ReportRecord } from "@/types/api/reports";
import { formatDateTime, formatNumber } from "@/lib/utils/format";
import { reportsApi } from "@/lib/api/services/reports";

export function ReportGenerationSummary({
  protocol,
  preview,
  reports,
}: {
  protocol: string;
  preview?: ReportPreview;
  reports: ReportRecord[];
}): JSX.Element {
  return (
    <div className="space-y-4">
      <Card className="card-surface">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="size-4.5" /> 生成摘要</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="rounded-[var(--radius-lg)] border border-border/60 bg-card p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">输出位置</p>
            <p className="mt-2 break-all">{preview?.generation_summary.output_ref ?? `workspace://${protocol}/reports/`}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-[var(--radius-lg)] border border-border/60 bg-card px-3 py-2.5"><p className="text-xs text-muted-foreground">准备度</p><p className="mt-1 text-lg font-semibold">{preview?.coverage.percent ?? 0}%</p></div>
            <div className="rounded-[var(--radius-lg)] border border-border/60 bg-card px-3 py-2.5"><p className="text-xs text-muted-foreground">将生成章节</p><p className="mt-1 text-lg font-semibold">{preview?.generation_summary.will_generate_sections ?? 0}</p></div>
            <div className="rounded-[var(--radius-lg)] border border-border/60 bg-card px-3 py-2.5"><p className="text-xs text-muted-foreground">仍缺章节</p><p className="mt-1 text-lg font-semibold">{preview?.generation_summary.still_missing_sections ?? 0}</p></div>
          </div>
          <div className="rounded-[var(--radius-lg)] border border-border/60 bg-card p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">缺项提示</p>
            <div className="mt-2 space-y-2">
              {(preview?.missing_explanation_preview ?? []).slice(0, 3).map((item) => (
                <div key={item.id} className="rounded-[var(--radius-md)] border border-border/50 bg-background px-2.5 py-2">
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.reason}</p>
                </div>
              ))}
              {!preview?.missing_explanation_preview?.length ? <p className="text-muted-foreground">当前无重点缺项提示。</p> : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="card-surface">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><History className="size-4.5" /> 历史报告列表</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {reports.length ? reports.map((item) => (
            <div key={item.report_id} className="rounded-[var(--radius-lg)] border border-border/60 bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="mt-1 break-all text-xs text-muted-foreground">{item.pdf_ref}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(item.created_at)} · {formatNumber(item.size ?? 0)} bytes</p>
                </div>
                <a href={reportsApi.downloadUrl(protocol, item.report_id)} className="inline-flex">
                  <Button size="sm" variant="secondary"><Download className="size-4" /> 下载</Button>
                </a>
              </div>
            </div>
          )) : <div className="rounded-[var(--radius-lg)] border border-dashed border-border/70 bg-card px-4 py-8 text-center text-sm text-muted-foreground">当前协议暂无历史报告。</div>}
        </CardContent>
      </Card>

      <Card className="card-surface">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><FileWarning className="size-4.5" /> 交付说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>报告生成前不会伪造章节完成状态；所有准备度均来自后端真实资产汇总。</p>
          <p>缺项章节会在生成结果中使用自动解释文本占位，而不是直接静默省略。</p>
          <p>下载链接仍复用既有报告中心接口，避免改动产物中心的检索逻辑。</p>
        </CardContent>
      </Card>
    </div>
  );
}

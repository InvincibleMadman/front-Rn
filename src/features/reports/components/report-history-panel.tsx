import { Download, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatNumber } from "@/lib/utils/format";
import { reportsApi } from "@/lib/api/services/reports";
import type { ReportRecord, ReportSummary } from "@/types/api/reports";

export function ReportHistoryPanel({
  protocol,
  reports,
  summary,
}: {
  protocol: string;
  reports: ReportRecord[];
  summary?: ReportSummary;
}): JSX.Element {
  const latestGeneratedAt = summary?.latest_generated_at ? formatDateTime(summary.latest_generated_at) : "暂无";

  return (
    <div className="space-y-4">
      <Card className="card-surface">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><History className="size-4.5" /> 历史报告列表</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 md:grid-cols-4">
            <div className="rounded-[var(--radius-lg)] border border-border/60 bg-card px-3 py-2.5">
              <p className="text-xs text-muted-foreground">当前协议</p>
              <p className="mt-1 text-lg font-semibold">{protocol || "未选择"}</p>
            </div>
            <div className="rounded-[var(--radius-lg)] border border-border/60 bg-card px-3 py-2.5">
              <p className="text-xs text-muted-foreground">历史报告数</p>
              <p className="mt-1 text-lg font-semibold">{reports.length}</p>
            </div>
            <div className="rounded-[var(--radius-lg)] border border-border/60 bg-card px-3 py-2.5">
              <p className="text-xs text-muted-foreground">最近生成</p>
              <p className="mt-1 text-sm font-semibold">{latestGeneratedAt}</p>
            </div>
            <div className="rounded-[var(--radius-lg)] border border-border/60 bg-card px-3 py-2.5">
              <p className="text-xs text-muted-foreground">最新摘要样本</p>
              <p className="mt-1 text-sm font-semibold">{summary?.latest_reports?.[0]?.title ?? "暂无"}</p>
            </div>
          </div>

          {reports.length ? (
            <div className="space-y-3">
              {reports.map((item) => (
                <div key={item.report_id} className="rounded-[var(--radius-lg)] border border-border/60 bg-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="mt-1 break-all text-xs text-muted-foreground">{item.pdf_ref}</p>
                      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
                        <p>{formatDateTime(item.created_at)}</p>
                        <p>{formatNumber(item.size ?? 0)} bytes</p>
                        <p>覆盖度 {item.coverage_percent ?? 0}%</p>
                        <p>章节 {item.ready_sections ?? 0}/{item.total_sections ?? 0}</p>
                      </div>
                    </div>
                    <a href={reportsApi.downloadUrl(protocol, item.report_id)} className="inline-flex shrink-0">
                      <Button size="sm" variant="secondary"><Download className="size-4" /> 下载</Button>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[var(--radius-lg)] border border-dashed border-border/70 bg-card px-4 py-10 text-center text-sm text-muted-foreground">
              当前协议暂无历史报告。
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

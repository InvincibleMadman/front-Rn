import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReportPreview } from "@/types/api/reports";

export function ReportGenerationSummary({
  protocol,
  preview,
}: {
  protocol: string;
  preview?: ReportPreview;
}): JSX.Element {
  return (
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
  );
}

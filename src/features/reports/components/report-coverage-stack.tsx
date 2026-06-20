import type { ReportPreview, ReportSummary } from "@/types/api/reports";

function percentage(count: number, total: number): number {
  if (!total) return 0;
  return Math.round((count / total) * 100);
}

export function ReportCoverageStack({ summary, preview }: { summary?: ReportSummary; preview?: ReportPreview }): JSX.Element {
  const coverage = preview?.coverage ?? summary?.coverage;
  if (!coverage) {
    return <div className="rounded-[var(--radius-lg)] border border-dashed border-border/70 bg-background/55 px-4 py-8 text-center text-sm text-muted-foreground">当前没有章节覆盖数据。</div>;
  }

  const total = Math.max(coverage.total_sections ?? 0, 1);
  const ready = coverage.ready_sections ?? 0;
  const partial = coverage.partial_sections ?? 0;
  const missing = coverage.missing_sections ?? 0;

  return (
    <div className="rounded-[var(--radius-xl)] border border-border/70 bg-background/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">章节覆盖</p>
          <p className="mt-1 text-xs text-muted-foreground">以 ready / partial / missing 三段展示当前报告准备度。</p>
        </div>
        <p className="text-sm font-semibold">{coverage.percent}%</p>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted/70">
        <div className="flex h-full w-full">
          <div className="h-full bg-foreground/80" style={{ width: `${percentage(ready, total)}%` }} />
          <div className="h-full bg-foreground/45" style={{ width: `${percentage(partial, total)}%` }} />
          <div className="h-full bg-border" style={{ width: `${percentage(missing, total)}%` }} />
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {[
          ["ready", ready, percentage(ready, total)],
          ["partial", partial, percentage(partial, total)],
          ["missing", missing, percentage(missing, total)],
        ].map(([label, count, ratio]) => (
          <div key={String(label)} className="rounded-[var(--radius-lg)] border border-border/60 bg-background/60 px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="uppercase tracking-[0.14em] text-xs text-muted-foreground">{label}</span>
              <span className="font-medium">{String(count)}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{String(ratio)}%</p>
          </div>
        ))}
      </div>
    </div>
  );
}

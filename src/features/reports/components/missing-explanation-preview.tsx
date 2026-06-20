import type { ReportMissingHighlight } from "@/types/api/reports";

export function MissingExplanationPreview({ items }: { items: ReportMissingHighlight[] }): JSX.Element {
  if (!items.length) return <div className="rounded-[var(--radius-lg)] border border-dashed border-border/70 bg-background/55 px-4 py-8 text-center text-sm text-muted-foreground">当前没有缺项高亮。</div>;
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-[var(--radius-lg)] border border-border/60 bg-background/60 p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium">{item.title}</p>
            <span className="rounded-full border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground">{item.status}</span>
          </div>
          <p className="mt-2 text-muted-foreground">{item.reason}</p>
          {item.route_hint ? <p className="mt-2 text-xs text-muted-foreground">route hint: {item.route_hint}</p> : null}
        </div>
      ))}
    </div>
  );
}

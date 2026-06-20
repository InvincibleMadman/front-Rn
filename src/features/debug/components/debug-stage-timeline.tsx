import { formatDateTime } from "@/lib/utils/format";

export interface DebugTimelineItem {
  key: string;
  label: string;
  reached: boolean;
  active: boolean;
  at?: string;
  description: string;
}

export function DebugStageTimeline({ items }: { items: DebugTimelineItem[] }): JSX.Element {
  return (
    <div className="grid overflow-hidden rounded-xl border border-border bg-border md:grid-cols-6">
      {items.map((item, index) => {
        const tone = item.active
          ? "bg-primary/10"
          : item.reached
            ? "bg-emerald-500/10"
            : "bg-background";

        const dotTone = item.active
          ? "border-primary/30 bg-primary text-primary-foreground"
          : item.reached
            ? "border-emerald-500/25 bg-emerald-500/15 text-emerald-300"
            : "border-border bg-card text-muted-foreground";

        const stateText = item.at
          ? formatDateTime(item.at)
          : item.active
            ? "当前"
            : item.reached
              ? "完成"
              : "待开始";

        return (
          <div key={item.key} className={`grid grid-cols-[1.85rem_minmax(0,1fr)] items-center gap-2 px-3 py-2.5 ${tone}`}>
            <div className={`flex h-7 w-7 items-center justify-center rounded-lg border text-[11px] font-semibold ${dotTone}`}>
              {index + 1}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[12px] font-semibold text-foreground">{item.label}</p>
              <p className="truncate text-[10px] text-muted-foreground">{stateText}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

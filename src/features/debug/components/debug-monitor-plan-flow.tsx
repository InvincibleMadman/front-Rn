import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils/format";
import type { MonitorPlanFlowItem } from "@/features/debug/debug-types";

function displayTime(at?: string): string {
  return at ? formatDateTime(at) : "暂无";
}

export function DebugMonitorPlanFlow({ items }: { items: MonitorPlanFlowItem[] }): JSX.Element {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-3 border-b border-border pb-2">
        <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">计划流</p>
        <p className="text-[12px] text-muted-foreground">规划 / 观察 / 推理</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <div className="console-scrollbar max-h-[min(40vh,24rem)] overflow-y-auto">
          {items.length ? items.map((item, index) => (
            <div
              key={`${item.at ?? "step"}-${index}`}
              className={`grid grid-cols-[2rem_minmax(0,5rem)_minmax(0,1fr)_5rem] gap-3 border-b border-border px-3 py-2 last:border-b-0 ${
                item.active ? "bg-primary/5" : ""
              }`}
            >
              <div className="flex h-7 w-8 items-center justify-center rounded-md border border-border bg-card font-mono text-[13px] text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div className="min-w-0">
                <Badge variant={item.active ? "default" : "outline"} className="rounded-sm px-1.5 py-0 text-[12px]">
                  {item.kind}
                </Badge>
              </div>
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold text-foreground">{item.title}</div>
                <div className="mt-0.5 line-clamp-2 text-[14px] leading-6 text-muted-foreground">{item.message}</div>
              </div>
              <div className="text-right text-[12px] text-muted-foreground">{displayTime(item.at)}</div>
            </div>
          )) : (
            <div className="px-3 py-8 text-[15px] text-muted-foreground">暂无计划步骤。</div>
          )}
        </div>
      </div>
    </div>
  );
}

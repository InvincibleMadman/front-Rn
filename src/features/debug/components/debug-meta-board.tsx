import type { LucideIcon } from "lucide-react";

export interface DebugMetaItem {
  key: string;
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: string;
}

export function DebugMetaBoard({ items }: { items: DebugMetaItem[] }): JSX.Element {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.key}
            className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-2.5 rounded-xl border border-border bg-background/95 px-3.5 py-3"
            title={`${item.label}: ${item.value}`}
          >
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${item.tone ?? "border-primary/20 bg-primary/10 text-primary"}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{item.label}</div>
              <div className="truncate text-[13px] text-foreground" title={item.value}>
                {item.value}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

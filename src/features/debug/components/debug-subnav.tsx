import { Archive, History, PlayCircle, Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DebugSection } from "@/features/debug/debug-types";
import { cn } from "@/lib/utils/cn";

const NAV_ITEMS: Array<{ key: DebugSection; label: string; icon: typeof PlayCircle; desc: string }> = [
  { key: "launch", label: "启动", icon: PlayCircle, desc: "参数 / 候选 / 回填" },
  { key: "monitor", label: "监控", icon: Radar, desc: "实时检查器 / 控制台" },
  { key: "history", label: "记录", icon: History, desc: "历史会话 / 快速重跑" },
  { key: "archive", label: "归档", icon: Archive, desc: "漏洞记录 / 报告挂接" },
];

export function DebugSubnav({
  value,
  onChange,
}: {
  value: DebugSection;
  onChange: (value: DebugSection) => void;
}): JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-card p-2">
      <div className="grid gap-2 md:grid-cols-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = value === item.key;
          return (
            <Button
              key={item.key}
              type="button"
              variant="ghost"
              onClick={() => onChange(item.key)}
              className={cn(
                "h-auto justify-start rounded-xl border px-4 py-3 text-left",
                active
                  ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/12"
                  : "border-border bg-background text-foreground hover:bg-muted/55",
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg border",
                  active ? "border-primary/30 bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground",
                )}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

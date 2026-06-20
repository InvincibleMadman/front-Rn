import { Boxes, ClipboardList, Radar } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

const config = {
  compose: { icon: Boxes, title: "创建任务", description: "编排目标、执行模式与运行参数", metricLabel: "profiles" },
  list: { icon: ClipboardList, title: "任务列表", description: "检索运行态、筛选任务与查看概要", metricLabel: "results" },
  monitor: { icon: Radar, title: "监控产物", description: "查看趋势、AFL++ 参数与最近异常", metricLabel: "events" },
} as const;

export type JobsFlowTabKey = keyof typeof config;

export function JobsFlowTabs({
  value,
  onChange,
  metrics,
}: {
  value: JobsFlowTabKey;
  onChange: (value: JobsFlowTabKey) => void;
  metrics: Record<JobsFlowTabKey, string>;
}): JSX.Element {
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {(Object.keys(config) as JobsFlowTabKey[]).map((key) => {
        const item = config[key];
        const Icon = item.icon;
        const active = value === key;
        return (
          <button key={key} type="button" onClick={() => onChange(key)} className="text-left">
            <Card className={cn(
              "card-surface h-full p-4 transition-all",
              active ? "border-primary/60 shadow-[0_0_0_1px_hsl(var(--primary)/0.12)]" : "hover:border-primary/30",
            )}>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="inline-flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="size-4.5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </div>
                <div className="rounded-full border border-border/70 bg-background/75 px-2.5 py-1 text-xs text-muted-foreground">
                  {item.metricLabel}: {metrics[key]}
                </div>
              </div>
            </Card>
          </button>
        );
      })}
    </div>
  );
}

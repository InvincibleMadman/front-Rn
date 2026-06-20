import { Activity, AlertTriangle, Bot, Cpu, Network, ShieldCheck } from "lucide-react";
import type { JobsSummary } from "@/types/api/jobs";
import { cn } from "@/lib/utils/cn";

const icons = [Activity, Cpu, AlertTriangle, ShieldCheck, Bot, Network] as const;

function BoardRow({ icon: Icon, label, value, percent, hint }: { icon: typeof Activity; label: string; value: string; percent: number; hint?: string }): JSX.Element {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[var(--radius-lg)] border border-border/60 bg-card px-3 py-2.5">
      <span className="inline-flex size-8 items-center justify-center rounded-[var(--radius-md)] bg-[hsl(var(--board-accent-soft))] text-[hsl(var(--board-accent))]">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-sm font-medium leading-5">{label}</p>
          {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-muted/80">
          <div
            className="h-1.5 rounded-full bg-gradient-to-r from-[hsl(var(--board-accent))] to-[hsl(var(--board-accent-strong))] transition-all"
            style={{ width: `${Math.max(8, Math.min(100, percent))}%` }}
          />
        </div>
      </div>
      <p className="text-right text-lg font-semibold tabular-nums text-[hsl(var(--board-accent-strong))]">{value}</p>
    </div>
  );
}

export function JobsStatusBoard({ summary, className }: { summary?: JobsSummary; className?: string }): JSX.Element {
  const total = Math.max(summary?.total ?? 0, 1);
  const rows = [
    { icon: icons[0], label: "运行中任务", value: String(summary?.running ?? 0), percent: ((summary?.running ?? 0) / total) * 100, hint: "jobs" },
    { icon: icons[1], label: "排队/启动中", value: String(summary?.starting ?? 0), percent: ((summary?.starting ?? 0) / total) * 100, hint: "created + validated" },
    { icon: icons[2], label: "24h Crash / Hang", value: `${summary?.crash_count ?? 0} / ${summary?.hang_count ?? 0}`, percent: ((summary?.crash_count ?? 0) + (summary?.hang_count ?? 0)) / total * 100, hint: "artifacts" },
    { icon: icons[3], label: "Risk 启用占比", value: `${summary?.risk_enabled_ratio ?? 0}%`, percent: Number(summary?.risk_enabled_ratio ?? 0), hint: `${summary?.risk_enabled_count ?? 0} jobs` },
    { icon: icons[4], label: "最近活跃协议", value: summary?.active_protocols?.[0] ?? "—", percent: 72, hint: summary?.active_protocols?.slice(1, 3).join(" / ") || "暂无" },
    { icon: icons[5], label: "最近活跃节点", value: summary?.active_nodes?.[0] ?? "—", percent: 66, hint: summary?.active_nodes?.slice(1, 3).join(" / ") || "暂无" },
  ];
  return <div className={cn("grid gap-2 md:grid-cols-2 xl:grid-cols-3", className)}>{rows.map((row) => <BoardRow key={row.label} {...row} />)}</div>;
}

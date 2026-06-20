import type { LucideIcon } from "lucide-react";
import { StatusBadge } from "@/components/common/status-badge";

export function DebugStatusCard({
  icon: Icon,
  label,
  value,
  hint,
  status,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  status?: string;
}): JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-primary">
          <Icon className="h-5 w-5" />
        </div>
        {status ? <StatusBadge status={status} /> : null}
      </div>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-foreground">{value}</p>
      {hint ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

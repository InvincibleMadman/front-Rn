import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function DebugPanel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}): JSX.Element {
  return <section className={cn("overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-none", className)}>{children}</section>;
}

export function DebugPanelHeader({
  title,
  caption,
  icon: Icon,
  actions,
  className,
}: {
  title: string;
  caption?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div className={cn("flex items-center justify-between gap-3 border-b border-border px-3 py-2.5", className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {Icon ? <Icon className="size-3.5" /> : null}
          {title}
        </div>
        {caption ? <p className="mt-1 truncate text-[12px] text-muted-foreground">{caption}</p> : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}

export function DebugPanelBody({ className, children }: { className?: string; children: React.ReactNode }): JSX.Element {
  return <div className={cn("p-3", className)}>{children}</div>;
}

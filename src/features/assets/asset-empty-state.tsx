import type { LucideIcon } from "lucide-react";
import { FolderSearch } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function AssetEmptyState({
  title,
  description,
  icon: Icon = FolderSearch,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div className={cn("rounded-[var(--radius-xl)] border border-border/60 bg-background/60 px-4 py-10 text-center", className)}>
      <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-[hsl(var(--accent-blue)/0.12)] text-[hsl(var(--accent-blue))]">
        <Icon className="size-5" />
      </div>
      <p className="mt-4 text-sm font-medium text-foreground">{title}</p>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

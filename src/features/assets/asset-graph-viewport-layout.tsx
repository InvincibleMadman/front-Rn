import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface AssetGraphViewportLayoutProps {
  toolbar: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
}

export function AssetGraphViewportLayout({
  toolbar,
  children,
  aside,
  className,
}: AssetGraphViewportLayoutProps): JSX.Element {
  return (
    <section className={cn("flex h-full min-h-0 min-w-0 flex-col gap-4 overflow-hidden", className)}>
      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-[var(--radius-lg)] border border-border bg-card px-4 py-3 shadow-console">
        {toolbar}
      </div>

      {aside ? (
        <div className="grid min-h-0 min-w-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_304px]">
          <div className="min-h-0 min-w-0 overflow-hidden">{children}</div>
          <div className="min-h-0 min-w-0 overflow-hidden">{aside}</div>
        </div>
      ) : (
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{children}</div>
      )}
    </section>
  );
}

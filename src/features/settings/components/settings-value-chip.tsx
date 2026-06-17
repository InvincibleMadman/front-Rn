import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function SettingsValueChip({
  children,
  tone = "default",
  mono = false,
  className,
}: {
  children: ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  mono?: boolean;
  className?: string;
}): JSX.Element {
  return (
    <span className={cn("settings-value-chip", mono && "font-mono text-[12px]", className)} data-tone={tone}>
      {children}
    </span>
  );
}

import { cn } from "@/lib/utils/cn";

export type SettingsStatusTone = "default" | "success" | "warning" | "danger" | "info";

export function SettingsStatusChip({
  label,
  value,
  tone = "default",
  className,
}: {
  label: string;
  value?: string;
  tone?: SettingsStatusTone;
  className?: string;
}): JSX.Element {
  return (
    <span className={cn("settings-hero-chip", className)} data-tone={tone}>
      <span className="settings-hero-chip__label">{label}</span>
      {value ? <span className="settings-hero-chip__value">{value}</span> : null}
    </span>
  );
}

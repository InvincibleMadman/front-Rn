import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function SettingsInfoRow({
  icon,
  label,
  value,
  hint,
  status,
  action,
  mono = false,
}: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  status?: ReactNode;
  action?: ReactNode;
  mono?: boolean;
}): JSX.Element {
  return (
    <div className="settings-info-row">
      <div className="settings-info-row__meta">
        {icon ? <span className="settings-info-row__icon">{icon}</span> : null}
        <div className="min-w-0">
          <p className="settings-info-row__label">{label}</p>
          {hint ? <p className="settings-info-row__hint">{hint}</p> : null}
        </div>
      </div>
      <div className={cn("settings-info-row__value", mono && "font-mono text-[12px]")}>{value}</div>
      {status ? <div className="settings-info-row__status">{status}</div> : null}
      {action ? <div className="settings-info-row__action">{action}</div> : null}
    </div>
  );
}

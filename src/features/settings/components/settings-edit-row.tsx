import type { ReactNode } from "react";

export function SettingsEditRow({
  label,
  description,
  control,
  status,
  footer,
}: {
  label: string;
  description?: ReactNode;
  control: ReactNode;
  status?: ReactNode;
  footer?: ReactNode;
}): JSX.Element {
  return (
    <div className="settings-edit-row">
      <div className="settings-edit-row__meta">
        <p className="settings-info-row__label">{label}</p>
        {description ? <p className="settings-info-row__hint">{description}</p> : null}
      </div>
      <div className="settings-edit-row__control">{control}</div>
      {status ? <div className="settings-info-row__status">{status}</div> : null}
      {footer ? <div className="md:col-span-3">{footer}</div> : null}
    </div>
  );
}

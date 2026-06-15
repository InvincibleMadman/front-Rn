import { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}): JSX.Element {
  return (
    <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        {eyebrow ? (
          <p className="mb-2 text-[13px] uppercase tracking-[0.2em] text-muted-foreground">{eyebrow}</p>
        ) : null}
        <h1 className="text-[34px] font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-2 max-w-4xl text-[15px] text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}

import type { ReactNode } from "react";

export function JobsWorkspaceShell({
  header,
  tabs,
  children,
}: {
  header: ReactNode;
  tabs: ReactNode;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="space-y-5">
      {header}
      {tabs}
      <section className="space-y-5">{children}</section>
    </div>
  );
}

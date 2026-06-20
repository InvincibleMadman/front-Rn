import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function PageHeroBoard({
  eyebrow,
  title,
  description,
  board,
  boardClassName,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  board: ReactNode;
  boardClassName?: string;
  actions?: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <section className={cn("card-surface rounded-[var(--radius-xl)] p-5", className)}>
      <div className="grid gap-5 xl:grid-cols-[minmax(18rem,0.78fr)_minmax(44rem,1.22fr)] 2xl:grid-cols-[minmax(20rem,0.72fr)_minmax(48rem,1.28fr)] xl:items-end">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="mb-2 text-[12px] font-medium uppercase tracking-[0.2em] text-muted-foreground">{eyebrow}</p>
          ) : null}
          <h1 className="text-[32px] font-semibold tracking-tight text-foreground md:text-[36px]">{title}</h1>
          {description ? <p className="mt-2 max-w-4xl text-[15px] leading-7 text-muted-foreground">{description}</p> : null}
          {actions ? <div className="mt-4 flex flex-wrap items-center gap-3">{actions}</div> : null}
        </div>
        <div className={cn("min-w-0", boardClassName)}>
          {board}
        </div>
      </div>
    </section>
  );
}

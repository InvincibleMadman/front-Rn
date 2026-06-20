export function JobsEmptyState({ title, description }: { title: string; description: string }): JSX.Element {
  return (
    <div className="rounded-[var(--radius-xl)] border border-dashed border-border/70 bg-background/55 px-6 py-14 text-center">
      <p className="text-base font-medium">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

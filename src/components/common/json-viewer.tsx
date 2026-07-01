import { Fragment } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils/cn";

function tryParseJsonLikeString(data: unknown): unknown {
  if (typeof data !== "string") return data;
  const trimmed = data.trim();
  if (!trimmed) return data;
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return data;

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return data;
  }
}

function isPrimitive(value: unknown): value is string | number | boolean | null | undefined {
  return value === null || value === undefined || ["string", "number", "boolean"].includes(typeof value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function PrimitiveValue({ value }: { value: string | number | boolean | null | undefined }): JSX.Element {
  if (value === undefined) {
    return <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">undefined</span>;
  }

  if (value === null) {
    return <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">null</span>;
  }

  if (typeof value === "boolean") {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center rounded-full px-2 py-1 text-xs font-medium",
          value ? "bg-success/12 text-success" : "bg-danger/12 text-danger",
        )}
      >
        {String(value)}
      </span>
    );
  }

  if (typeof value === "number") {
    return <span className="font-medium text-foreground">{value}</span>;
  }

  if (!value.trim()) {
    return <span className="text-muted-foreground">-</span>;
  }

  return <div className="whitespace-pre-wrap break-words text-foreground">{value}</div>;
}

function JsonNode({
  value,
  depth = 0,
  compact = false,
}: {
  value: unknown;
  depth?: number;
  compact?: boolean;
}): JSX.Element {
  const parsedValue = tryParseJsonLikeString(value);

  if (isPrimitive(parsedValue)) {
    return <PrimitiveValue value={parsedValue} />;
  }

  if (typeof parsedValue === "bigint") {
    return <span className="font-medium text-foreground">{parsedValue.toString()}</span>;
  }

  if (typeof parsedValue === "symbol" || typeof parsedValue === "function") {
    return <span className="text-muted-foreground">{String(parsedValue)}</span>;
  }

  if (Array.isArray(parsedValue)) {
    if (parsedValue.length === 0) {
      return <span className="text-sm text-muted-foreground">empty array</span>;
    }

    return (
      <div className="space-y-2">
        {parsedValue.map((item, index) => (
          <div key={`${depth}-${index}`} className="rounded-[var(--radius-md)] border border-border/60 bg-background/68 p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                #{index}
              </span>
            </div>
            <JsonNode value={item} depth={depth + 1} compact={compact} />
          </div>
        ))}
      </div>
    );
  }

  if (!isPlainObject(parsedValue)) {
    return <span className="text-muted-foreground">{String(parsedValue)}</span>;
  }

  const entries = Object.entries(parsedValue);

  if (entries.length === 0) {
    return <span className="text-sm text-muted-foreground">empty object</span>;
  }

  const keyColumnClass = compact
    ? "[grid-template-columns:minmax(84px,132px)_minmax(0,1fr)]"
    : "[grid-template-columns:minmax(104px,168px)_minmax(0,1fr)]";

  return (
    <div className="space-y-2">
      {entries.map(([key, child]) => {
        const childValue = tryParseJsonLikeString(child);
        const nested = !isPrimitive(childValue) && typeof childValue === "object";

        return (
          <Fragment key={`${depth}-${key}`}>
            <div className="rounded-[var(--radius-md)] border border-border/60 bg-background/68 p-3">
              <div className={cn("gap-3", nested ? "space-y-2" : `grid items-start ${keyColumnClass}`)}>
                <div className="min-w-0 break-all">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {key}
                  </span>
                </div>
                <div className="min-w-0">
                  <JsonNode value={child} depth={depth + 1} compact={compact} />
                </div>
              </div>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

export function JsonViewer({
  data,
  compact = false,
  compactContainerClassName,
}: {
  data: unknown;
  compact?: boolean;
  compactContainerClassName?: string;
}): JSX.Element {
  const content = (
    <div className={cn("p-4", compact && "p-0")}>
      <JsonNode value={data} compact={compact} />
    </div>
  );

  if (compact) {
    return (
      <div className={cn("min-h-0", compactContainerClassName)}>
        {content}
      </div>
    );
  }

  return (
    <ScrollArea className="console-scrollbar h-[420px] rounded-[var(--radius-xl)] border border-border/60 bg-card/86">
      {content}
    </ScrollArea>
  );
}

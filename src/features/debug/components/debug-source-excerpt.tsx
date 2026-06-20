import type { DebugLocationResult, DebugSourceExcerptLine } from "@/types/api/debug";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

function lineTone(line: DebugSourceExcerptLine): string {
  return line.highlight
    ? "bg-primary/10 text-foreground ring-1 ring-primary/25"
    : "text-muted-foreground hover:bg-muted/28";
}

export function DebugSourceExcerpt({
  location,
}: {
  location?: DebugLocationResult | null;
}): JSX.Element {
  const excerpt = location?.source_excerpt;

  if (!excerpt?.lines?.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-background px-5 py-8 text-sm text-muted-foreground">
        当前没有可展示的源码片段。仍可在右侧定位区查看源码与 frame 信息。
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {location?.primary_function ? `${location.primary_function}()` : "源码定位"}
          </p>
          <p className="mt-1 break-all text-xs text-muted-foreground">
            {location?.primary_file_path ?? "-"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {location?.primary_line ? <Badge variant="default" className="rounded-md">line {location.primary_line}</Badge> : null}
          {location?.source_workspace_ref ? <Badge variant="outline" className="rounded-md">workspace ref</Badge> : null}
          {typeof location?.confidence === "number" ? (
            <Badge variant="secondary" className="rounded-md">置信度 {(location.confidence * 100).toFixed(0)}%</Badge>
          ) : null}
        </div>
      </div>

      <ScrollArea className="max-h-[28rem]">
        <div className="bg-[hsl(var(--bg-primary-alt)/0.35)] p-3 font-mono text-[12px] leading-6">
          {excerpt.lines.map((line) => (
            <div
              key={line.line}
              className={`grid grid-cols-[4rem_minmax(0,1fr)] gap-3 rounded-lg px-3 py-1.5 transition-colors ${lineTone(line)}`}
            >
              <span className="select-none text-right text-[11px] text-muted-foreground/90">{line.line}</span>
              <code className="min-w-0 whitespace-pre-wrap break-all text-[12px] leading-6 text-inherit">{line.text || " "}</code>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

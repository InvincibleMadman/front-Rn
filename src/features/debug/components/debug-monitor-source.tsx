import { Badge } from "@/components/ui/badge";
import { DebugSourcePreview } from "@/features/debug/components/debug-source-preview";
import type { MonitorSourceViewModel } from "@/features/debug/debug-types";
import type { DebugFrame } from "@/types/api/debug";

function display(value?: string | null): string {
  return value && value.trim() ? value : "暂无";
}

function Row({ label, value }: { label: string; value?: string }): JSX.Element {
  return (
    <div className="grid grid-cols-[4.8rem_minmax(0,1fr)] gap-3 border-b border-border px-3 py-2 last:border-b-0">
      <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="min-w-0 break-all text-[14px] leading-6 text-foreground">{display(value)}</div>
    </div>
  );
}

export function DebugMonitorSource({
  source,
  previewExcerpt,
  focusFrame,
  focusSummary,
}: {
  source: MonitorSourceViewModel;
  previewExcerpt?: MonitorSourceViewModel["excerpt"];
  focusFrame?: DebugFrame | null;
  focusSummary?: string;
}): JSX.Element {
  const excerpt = previewExcerpt ?? source.excerpt;

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2">
        <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">源码定位</p>
        <div className="flex flex-wrap gap-2">
          <Badge variant={source.sourceAvailable ? "success" : "outline"} className="rounded-sm px-1.5 py-0 text-[12px]">
            {source.sourceAvailable ? "源码就绪" : "源码缺失"}
          </Badge>
          {source.workspaceRef ? <Badge variant="outline" className="rounded-sm px-1.5 py-0 text-[12px]">工作区引用</Badge> : null}
        </div>
      </div>

      <div className="mb-3 overflow-hidden rounded-lg border border-border bg-background">
        <Row label="函数" value={source.functionName} />
        <Row label="文件" value={source.filePath ? `${source.filePath}${typeof source.line === "number" ? `:${source.line}` : ""}` : undefined} />
        <Row label="栈帧" value={focusFrame ? `#${focusFrame.index ?? 0}` : undefined} />
        <Row label="摘要" value={focusSummary} />
      </div>

      <DebugSourcePreview
        filePath={source.filePath}
        functionName={source.functionName}
        line={source.line}
        excerpt={excerpt}
        sourceAvailable={source.sourceAvailable}
      />
    </div>
  );
}

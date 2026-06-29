import { ScrollArea } from "@/components/ui/scroll-area";
import type { DebugSourceExcerpt } from "@/types/api/debug";

export function DebugSourcePreview({
  filePath,
  functionName,
  line,
  excerpt,
  sourceAvailable,
}: {
  filePath?: string;
  functionName?: string;
  line?: number;
  excerpt?: DebugSourceExcerpt | null;
  sourceAvailable: boolean;
}): JSX.Element {
  if (!excerpt?.lines?.length) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-background px-4 py-8 text-[14px] text-muted-foreground">
        {sourceAvailable ? "已定位到源码，但当前没有可展示的代码片段。" : "当前工作区暂时无法提供源码片段。"}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card/90">
      <div className="border-b border-border px-4 py-3">
        <p className="text-[14px] font-semibold text-foreground">{functionName || "源码片段"}</p>
        <p className="mt-1 break-all font-mono text-[12px] text-muted-foreground">
          {filePath || "源码位置未解析"}{typeof line === "number" ? `:${line}` : ""}
        </p>
      </div>
      <ScrollArea className="max-h-[30rem]">
        <div className="bg-[hsl(var(--bg-primary-alt)/0.34)] p-2.5 font-mono text-[13px] leading-7">
          {excerpt.lines.map((item) => (
            <div
              key={`${item.line}-${item.text}`}
              className={item.highlight
                ? "grid grid-cols-[4rem_minmax(0,1fr)] gap-3 rounded border border-primary/25 bg-primary/10 px-3 py-1.5 text-foreground"
                : "grid grid-cols-[4rem_minmax(0,1fr)] gap-3 rounded border border-transparent px-3 py-1.5 text-muted-foreground hover:bg-muted/30"}
            >
              <span className="select-none text-right text-[12px]">{item.line}</span>
              <code className="whitespace-pre-wrap break-all text-inherit">{item.text || " "}</code>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

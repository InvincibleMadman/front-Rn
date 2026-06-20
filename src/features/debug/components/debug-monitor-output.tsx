import { AlertTriangle, Binary, TerminalSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { MonitorOutputViewModel } from "@/features/debug/debug-types";

function ConsolePane({ title, content }: { title: string; content: string }): JSX.Element {
  return (
    <div className="overflow-hidden rounded border border-border bg-background">
      <div className="border-b border-border px-3 py-2.5 text-[12px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</div>
      <pre className="min-h-[12rem] whitespace-pre-wrap break-words px-3 py-3 font-mono text-[13px] leading-7 text-foreground">
        {content || "暂无输出"}
      </pre>
    </div>
  );
}

export function DebugMonitorOutput({ output }: { output: MonitorOutputViewModel }): JSX.Element {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">控制台原始输出</p>
          <p className="mt-1 text-[13px] text-muted-foreground">中间下部仅保留目标 I/O、GDB transcript 与 argv。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={output.targetOutputAvailable ? "success" : "warning"} className="rounded-sm px-2 py-0.5 text-[11px]">
            {output.targetOutputAvailable ? "target separated" : "mixed fallback"}
          </Badge>
          <div className="inline-flex items-center gap-1 rounded-[2px] border border-border bg-background px-2 py-1 text-[12px] text-muted-foreground">
            <Binary className="h-3.5 w-3.5" />
            boundary: {String(output.streams?.stream_boundary ?? "unknown")}
          </div>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-[12px] text-muted-foreground">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
        <span>{output.targetOutputDisclaimer}</span>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <ConsolePane title="Target stdout / stderr" content={output.targetOutput} />
        <ConsolePane title="GDB transcript" content={output.gdbTranscript} />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="rounded border border-border bg-background px-3 py-2.5 text-[12px] text-muted-foreground">
          <div className="mb-1 flex items-center gap-2 font-semibold uppercase tracking-[0.16em]"><TerminalSquare className="h-3.5 w-3.5" />Launch argv</div>
          <div className="font-mono text-[13px] leading-6 text-foreground">{output.argv.length ? output.argv.join(" ") : "暂无 target argv"}</div>
        </div>
        <div className="rounded border border-border bg-background px-3 py-2.5 text-[12px] text-muted-foreground">
          <div className="mb-1 font-semibold uppercase tracking-[0.16em]">Output Mode</div>
          <div className="text-[13px] leading-6 text-foreground">{output.targetOutputAvailable ? "Separated streams" : "Batch / mixed transcript"}</div>
        </div>
      </div>
    </div>
  );
}

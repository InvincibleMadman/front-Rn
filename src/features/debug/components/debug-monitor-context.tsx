import { Archive, FolderTree, PackageOpen, Radar, Workflow } from "lucide-react";
import type { MonitorContextViewModel } from "@/features/debug/debug-types";

function display(value?: string | null): string {
  return value && value.trim() ? value : "暂无";
}

function Row({ label, value }: { label: string; value?: string }): JSX.Element {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 px-3 py-2 last:border-b-0">
      <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="min-w-0 break-all text-[14px] leading-6 text-foreground">{display(value)}</div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  rows,
}: {
  title: string;
  icon: typeof Workflow;
  rows: Array<{ label: string; value?: string }>;
}): JSX.Element {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5 text-[13px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      <div className="divide-y divide-border">
        {rows.map((row) => <Row key={`${title}-${row.label}`} label={row.label} value={row.value} />)}
      </div>
    </section>
  );
}

export function DebugMonitorContext({ context, workspaceRef }: { context: MonitorContextViewModel; workspaceRef?: string | null }): JSX.Element {
  const gdbStatus = context.gdbUsed
    ? `已启用${context.gdbReason ? ` · ${context.gdbReason}` : ""}`
    : "未启用";

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-border pb-2">
        <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">调试上下文</p>
        <p className="text-[12px] text-muted-foreground">观察 / 回放 / 决策</p>
      </div>

      <div className="grid gap-3">
        <Section
          title="会话"
          icon={Workflow}
          rows={[
            { label: "会话", value: context.sessionId },
            { label: "操作", value: context.operationId },
            { label: "策略", value: context.analysisStrategy },
            { label: "GDB", value: gdbStatus },
          ]}
        />
        <Section
          title="回放"
          icon={Radar}
          rows={[
            { label: "样本", value: context.artifactPath },
            { label: "传输", value: context.transportType },
            { label: "模式", value: context.replayMode },
            { label: "目标", value: context.replayTarget || context.replayStatus },
          ]}
        />
        <Section
          title="目标"
          icon={PackageOpen}
          rows={[
            { label: "程序", value: context.binaryPath },
            { label: "CWD", value: context.cwd },
            { label: "证据", value: context.evidenceMode },
            { label: "源码", value: context.sourceAvailable ? "就绪" : "缺失" },
          ]}
        />
        <Section
          title="产物"
          icon={Archive}
          rows={[
            { label: "调试", value: context.debugReportPath },
            { label: "报告", value: context.reportPath },
            { label: "归档", value: context.historyRecordId },
            { label: "关联库", value: context.relatedLibraryFile },
          ]}
        />
        <Section
          title="工作区"
          icon={FolderTree}
          rows={[
            { label: "引用", value: workspaceRef || undefined },
            { label: "分析", value: context.analysisMode },
            { label: "回放状态", value: context.replayStatus },
            { label: "关联库", value: context.relatedLibraryFile },
          ]}
        />
      </div>
    </div>
  );
}

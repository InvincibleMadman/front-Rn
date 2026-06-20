import { Archive, FolderTree, PackageOpen, Workflow } from "lucide-react";
import type { MonitorContextViewModel } from "@/features/debug/debug-types";

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
    <div className="overflow-hidden rounded border border-border bg-background">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5 text-[12px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      <div className="divide-y divide-border">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 px-3 py-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{row.label}</div>
            <div className="min-w-0 break-all font-mono text-[13px] leading-6 text-foreground">{row.value || "—"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DebugMonitorContext({ context, workspaceRef }: { context: MonitorContextViewModel; workspaceRef?: string | null }): JSX.Element {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-border pb-2">
        <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">会话上下文</p>
        <p className="text-[11px] text-muted-foreground">IDE Inspector</p>
      </div>

      <div className="grid gap-3">
        <Section
          title="Session"
          icon={Workflow}
          rows={[
            { label: "会话 ID", value: context.sessionId },
            { label: "操作 ID", value: context.operationId },
            { label: "传输", value: context.transportType },
            { label: "历史记录", value: context.historyRecordId },
          ]}
        />
        <Section
          title="Target"
          icon={PackageOpen}
          rows={[
            { label: "Crash 输入", value: context.artifactPath },
            { label: "二进制", value: context.binaryPath },
            { label: "运行目录", value: context.cwd },
            { label: "源码状态", value: context.sourceAvailable ? "ready" : "missing" },
          ]}
        />
        <Section
          title="Artifacts"
          icon={Archive}
          rows={[
            { label: "调试报告", value: context.debugReportPath },
            { label: "输出报告", value: context.reportPath },
            { label: "关联库", value: context.relatedLibraryFile },
            { label: "Workspace", value: workspaceRef || undefined },
          ]}
        />
        <Section
          title="Path Map"
          icon={FolderTree}
          rows={[
            { label: "Artifact", value: context.artifactPath },
            { label: "Binary", value: context.binaryPath },
            { label: "Library", value: context.relatedLibraryFile },
            { label: "Workspace", value: workspaceRef || undefined },
          ]}
        />
      </div>
    </div>
  );
}

import { ActivitySquare, Binary, Bug, Crosshair, Link2, ShieldAlert, Workflow } from "lucide-react";
import { StatusBadge } from "@/components/common/status-badge";
import { DebugMetaBoard, type DebugMetaItem } from "@/features/debug/components/debug-meta-board";
import { DebugStageTimeline } from "@/features/debug/components/debug-stage-timeline";
import type { MonitorViewModel } from "@/features/debug/debug-types";

function display(value?: string | null, fallback = "暂无"): string {
  return value && value.trim() ? value : fallback;
}

function HeaderStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ActivitySquare;
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-2.5 rounded-xl border border-border bg-background/95 px-3.5 py-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
        <div className="truncate text-[13px] text-foreground" title={value}>{value}</div>
      </div>
    </div>
  );
}

export function DebugPageHeader({
  title,
  subtitle,
  viewModel,
}: {
  title: string;
  subtitle: string;
  viewModel: MonitorViewModel;
}): JSX.Element {
  const items: DebugMetaItem[] = [
    {
      key: "protocol",
      label: "协议",
      value: display(viewModel.header.protocol, "未选择"),
      icon: Binary,
      tone: "text-sky-400 border-sky-500/25 bg-sky-500/10",
    },
    {
      key: "crashType",
      label: "异常类型",
      value: display(viewModel.header.crashType, "待分析"),
      icon: Bug,
      tone: "text-rose-400 border-rose-500/25 bg-rose-500/10",
    },
    {
      key: "focusFrame",
      label: "焦点栈帧",
      value: display(viewModel.header.focusFrame, "暂无焦点栈帧"),
      icon: Crosshair,
      tone: "text-amber-400 border-amber-500/25 bg-amber-500/10",
    },
    {
      key: "relatedLibraryFile",
      label: "关联库",
      value: display(viewModel.header.relatedLibraryFile, "未解析"),
      icon: Link2,
      tone: "text-emerald-400 border-emerald-500/25 bg-emerald-500/10",
    },
  ];

  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-border bg-card shadow-none">
      <div className="grid gap-4 px-4 py-4 xl:grid-cols-[minmax(0,1fr)_minmax(40rem,46rem)]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-start gap-3 self-start">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              <ShieldAlert className="h-3.5 w-3.5" />
              智能调试
            </div>
            <StatusBadge status={viewModel.header.status} />
          </div>

          <div className="min-w-0 max-w-3xl">
            <h1 className="text-[1.72rem] font-semibold tracking-tight text-foreground md:text-[1.92rem]">{title}</h1>
            <p className="mt-1 text-[12px] leading-5 text-muted-foreground">{subtitle}</p>
          </div>
        </div>

        <div className="grid min-w-0 gap-2 self-start">
          <div className="grid gap-2 md:grid-cols-4">
            <HeaderStat icon={ActivitySquare} label="状态" value={display(viewModel.header.status)} />
            <HeaderStat icon={Workflow} label="会话 / 操作" value={display(viewModel.header.sessionId || viewModel.header.operationId, "未创建")} />
            <HeaderStat icon={ShieldAlert} label="最近更新" value={display(viewModel.header.updatedAt, "尚未刷新")} />
            <HeaderStat icon={ShieldAlert} label="调试策略" value={display(viewModel.header.debuggerMode, "崩溃证据归纳")} />
          </div>
          <DebugMetaBoard items={items} />
        </div>
      </div>

      <div className="border-t border-border px-3 py-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">调试阶段</p>
          <p className="text-[10px] text-muted-foreground">状态流转</p>
        </div>
        <DebugStageTimeline items={viewModel.timeline} />
      </div>
    </div>
  );
}

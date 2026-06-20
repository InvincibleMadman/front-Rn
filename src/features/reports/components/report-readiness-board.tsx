import { AlertTriangle, CheckCircle2, FileText, Layers3, Sparkles } from "lucide-react";
import type { ReportPreview } from "@/types/api/reports";

function Row({
  icon: Icon,
  label,
  value,
  note,
  percent,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  note: string;
  percent: number;
}): JSX.Element {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[var(--radius-lg)] border border-border/60 bg-card px-3 py-2.5">
      <span className="inline-flex size-8 items-center justify-center rounded-[var(--radius-md)] bg-[hsl(var(--board-accent-soft))] text-[hsl(var(--board-accent))]">
        <Icon className="size-4" />
      </span>
      <div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-sm font-medium leading-5">{label}</p>
          <span className="text-xs text-muted-foreground">{note}</span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-muted/80">
          <div
            className="h-1.5 rounded-full bg-gradient-to-r from-[hsl(var(--board-accent))] to-[hsl(var(--board-accent-strong))]"
            style={{ width: `${Math.max(8, Math.min(100, percent))}%` }}
          />
        </div>
      </div>
      <p className="text-lg font-semibold tabular-nums text-[hsl(var(--board-accent-strong))]">{value}</p>
    </div>
  );
}

export function ReportReadinessBoard({ preview }: { preview?: ReportPreview }): JSX.Element {
  const coverage = preview?.coverage;
  const total = Math.max(coverage?.total_sections ?? 1, 1);
  const rows = [
    {
      icon: FileText,
      label: "准备度",
      value: `${coverage?.percent ?? 0}%`,
      note: coverage?.label ?? "未准备",
      percent: coverage?.percent ?? 0,
    },
    {
      icon: CheckCircle2,
      label: "Ready sections",
      value: String(coverage?.ready_sections ?? 0),
      note: `/${coverage?.total_sections ?? 0}`,
      percent: ((coverage?.ready_sections ?? 0) / total) * 100,
    },
    {
      icon: Sparkles,
      label: "自动解释段",
      value: String(preview?.generation_summary.auto_explanation_sections ?? 0),
      note: "可直接写入说明",
      percent: ((preview?.generation_summary.auto_explanation_sections ?? 0) / total) * 100,
    },
    {
      icon: Layers3,
      label: "将生成章节",
      value: String(preview?.generation_summary.will_generate_sections ?? 0),
      note: "生成时纳入",
      percent: ((preview?.generation_summary.will_generate_sections ?? 0) / total) * 100,
    },
    {
      icon: AlertTriangle,
      label: "仍缺关键项",
      value: String(preview?.generation_summary.still_missing_sections ?? 0),
      note: "建议先补齐",
      percent: ((preview?.generation_summary.still_missing_sections ?? 0) / total) * 100,
    },
  ];

  return <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{rows.map((row) => <Row key={row.label} {...row} />)}</div>;
}

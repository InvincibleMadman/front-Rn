import { CheckCircle2, ChevronRight, CircleDashed, FolderTree, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReportReadinessNode } from "@/types/api/reports";
import { cn } from "@/lib/utils/cn";

const PLACEHOLDER_TREE: ReportReadinessNode = {
  id: "placeholder-root",
  title: "报告章节",
  status: "placeholder",
  count: 0,
  summary: "等待真实协议与资产数据",
  children: [
    {
      id: "placeholder-overview",
      title: "概览与结论",
      status: "placeholder",
      count: 0,
      summary: "将根据真实风险摘要自动填充",
    },
    {
      id: "placeholder-assets",
      title: "资产与证据",
      status: "placeholder",
      count: 0,
      summary: "等待漏洞、调试、构建等资产汇入",
    },
    {
      id: "placeholder-remediation",
      title: "修复与建议",
      status: "placeholder",
      count: 0,
      summary: "缺项解释与修复建议将显示在这里",
    },
  ],
};

function statusTone(status?: string): string {
  if (status === "ready") return "text-emerald-500 bg-emerald-500/10";
  if (status === "partial") return "text-amber-500 bg-amber-500/10";
  if (status === "degraded") return "text-orange-500 bg-orange-500/10";
  return "text-muted-foreground bg-muted/50";
}

function StatusIcon({ status }: { status?: string }): JSX.Element {
  if (status === "ready") return <CheckCircle2 className="size-4" />;
  if (status === "partial" || status === "degraded") return <TriangleAlert className="size-4" />;
  return <CircleDashed className="size-4" />;
}

function TreeNode({
  node,
  selectedId,
  depth = 0,
  onSelect,
}: {
  node: ReportReadinessNode;
  selectedId?: string;
  depth?: number;
  onSelect: (node: ReportReadinessNode) => void;
}): JSX.Element {
  const children = node.children ?? [];
  const active = node.id === selectedId;
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => onSelect(node)}
        className={cn(
          "flex w-full items-start gap-3 rounded-[var(--radius-lg)] border px-3 py-2.5 text-left transition-all",
          active ? "border-primary/60 bg-primary/10" : "border-border/60 bg-card hover:border-primary/30",
        )}
        style={{ marginLeft: `${depth * 10}px`, width: depth > 0 ? `calc(100% - ${depth * 10}px)` : "100%" }}
      >
        <span className={cn("mt-0.5 inline-flex size-7 items-center justify-center rounded-full", statusTone(node.status))}>
          <StatusIcon status={node.status} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{node.title}</p>
            {node.count !== undefined && node.count !== null ? (
              <span className="rounded-full border border-border/70 bg-card px-2 py-0.5 text-[11px] text-muted-foreground">{node.count}</span>
            ) : null}
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{node.summary ?? node.detail ?? "暂无摘要"}</p>
        </div>
        {children.length ? <ChevronRight className="mt-1 size-4 text-muted-foreground" /> : null}
      </button>
      {children.length ? children.map((child) => <TreeNode key={child.id} node={child} selectedId={selectedId} depth={depth + 1} onSelect={onSelect} />) : null}
    </div>
  );
}

export function ReportReadinessTree({
  root,
  selectedId,
  onSelect,
}: {
  root?: ReportReadinessNode;
  selectedId?: string;
  onSelect: (node: ReportReadinessNode) => void;
}): JSX.Element {
  const displayRoot = root ?? PLACEHOLDER_TREE;
  const displaySelectedId = root ? selectedId : PLACEHOLDER_TREE.children?.[0]?.id;

  return (
    <Card className="card-surface h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><FolderTree className="size-4.5" /> 章节准备树</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <TreeNode
          node={displayRoot}
          selectedId={displaySelectedId}
          onSelect={root ? onSelect : () => undefined}
        />
        {!root ? <p className="px-1 pt-1 text-xs text-muted-foreground">当前为 0 数据示意树，真实章节会在协议准备完成后替换。</p> : null}
      </CardContent>
    </Card>
  );
}

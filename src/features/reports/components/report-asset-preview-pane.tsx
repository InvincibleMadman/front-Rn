import { FileSearch, Files, History, Route, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JsonViewer } from "@/components/common/json-viewer";
import type { ReportMissingHighlight, ReportPreview, ReportReadinessNode } from "@/types/api/reports";

function resolveRefs(node?: ReportReadinessNode): string[] {
  const refs: string[] = [];
  const visit = (current?: ReportReadinessNode): void => {
    if (!current) return;
    if (current.workspace_ref) refs.push(current.workspace_ref);
    (current.children ?? []).forEach(visit);
  };
  visit(node);
  return Array.from(new Set(refs)).slice(0, 8);
}

export function ReportAssetPreviewPane({
  preview,
  selectedNode,
}: {
  preview?: ReportPreview;
  selectedNode?: ReportReadinessNode;
}): JSX.Element {
  const workspaceRefs = selectedNode ? resolveRefs(selectedNode) : Object.values(preview?.asset_preview.workspace_refs ?? {}).filter(Boolean).map(String);
  const vulnerabilityRecords = preview?.asset_preview.vulnerability_records ?? [];
  const debugSessions = preview?.asset_preview.debug_sessions ?? [];
  const buildRuns = preview?.asset_preview.build_runs ?? [];
  const launchProfiles = preview?.asset_preview.launch_profiles ?? [];
  const historicalReports = preview?.asset_preview.historical_reports ?? [];
  const missingPreview = preview?.missing_explanation_preview ?? [];
  const selectedMissing = missingPreview.find((item) => item.id === selectedNode?.id);
  const selectedJson = selectedNode ? {
    node: selectedNode,
    workspace_refs: workspaceRefs,
    sample_assets: {
      vulnerability_records: vulnerabilityRecords.slice(0, 3),
      debug_sessions: debugSessions.slice(0, 3),
      build_runs: buildRuns.slice(0, 3),
      launch_profiles: launchProfiles.slice(0, 3),
      historical_reports: historicalReports.slice(0, 3),
    },
  } : {
    asset_counts: preview?.asset_counts,
    workspace_refs: preview?.asset_preview.workspace_refs,
  };

  return (
    <div className="space-y-4">
      <Card className="card-surface">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Files className="size-4.5" /> 资产 / 证据预览</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[var(--radius-lg)] border border-border/60 bg-card p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Workspace refs</p>
              <div className="mt-2 space-y-1.5 text-sm">
                {workspaceRefs.length ? workspaceRefs.map((item) => <p key={item} className="truncate">{item}</p>) : <p className="text-muted-foreground">暂无可预览路径</p>}
              </div>
            </div>
            <div className="rounded-[var(--radius-lg)] border border-border/60 bg-card p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">资产计数</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {Object.entries(preview?.asset_counts ?? {}).map(([key, value]) => (
                  <div key={key} className="rounded-[var(--radius-md)] border border-border/50 bg-background px-2.5 py-2">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{key}</p>
                    <p className="mt-1 text-base font-semibold">{String(value)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-[var(--radius-lg)] border border-border/60 bg-card p-3">
              <div className="flex items-center gap-2 text-sm font-medium"><Route className="size-4" /> 采样资产</div>
              <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                <p>漏洞记录：{vulnerabilityRecords.length}</p>
                <p>调试会话：{debugSessions.length}</p>
                <p>构建记录：{buildRuns.length}</p>
                <p>启动配置：{launchProfiles.length}</p>
                <p>历史报告：{historicalReports.length}</p>
              </div>
            </div>
            <div className="rounded-[var(--radius-lg)] border border-border/60 bg-card p-3">
              <div className="flex items-center gap-2 text-sm font-medium"><Sparkles className="size-4" /> 缺项解释预览</div>
              {selectedMissing ? (
                <div className="mt-3 space-y-2 text-sm">
                  <p className="font-medium">{selectedMissing.title}</p>
                  <p className="text-muted-foreground">{selectedMissing.reason}</p>
                  <p className="rounded-[var(--radius-md)] border border-border/50 bg-background px-2.5 py-2 text-xs text-muted-foreground">{selectedMissing.sample_text}</p>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {(missingPreview.slice(0, 2) as Array<ReportMissingHighlight & { sample_text?: string }>).map((item) => (
                    <div key={item.id} className="rounded-[var(--radius-md)] border border-border/50 bg-background px-2.5 py-2">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="card-surface">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><FileSearch className="size-4.5" /> 结构化预览</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-[var(--radius-lg)] border border-border/60 bg-card p-3">
            <JsonViewer data={selectedJson} compact />
          </div>
        </CardContent>
      </Card>

      <Card className="card-surface">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><History className="size-4.5" /> 历史报告参考</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {historicalReports.length ? historicalReports.slice(0, 4).map((item) => (
            <div key={item.report_id} className="rounded-[var(--radius-lg)] border border-border/60 bg-card px-3 py-2.5">
              <p className="font-medium">{item.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.pdf_ref}</p>
            </div>
          )) : <div className="rounded-[var(--radius-lg)] border border-dashed border-border/70 bg-card px-4 py-8 text-center text-sm text-muted-foreground">当前协议暂无历史报告参考。</div>}
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, RefreshCw } from "lucide-react";
import { dockLog } from "@/components/layout/dock";
import { reportGlobalError } from "@/components/common/global-error-center";
import { Button } from "@/components/ui/button";
import { AssetEmptyState } from "@/features/assets/asset-empty-state";
import { AssetGraphChart, type AssetGraphChartNodePayload } from "@/features/assets/asset-graph-chart";
import {
  ASSET_GRAPH_HEIGHT,
  ASSET_LINEAGE_MIN_WIDTH,
  buildLineageGraphLayout,
  buildProtocolMindmapModel,
  getAssetGraphNavigateTab,
  getAssetGraphStatusLabel,
  isAssetScope,
  normalizeProtocol,
  readCssHsl,
  shortenWorkspaceRef,
  type AssetGraphLayoutNode,
  type AssetNavigateTab,
  type AssetScope,
} from "@/features/assets/asset-utils";
import { assetsApi } from "@/lib/api/services/assets";
import { useUiStore } from "@/stores/ui-store";
import type { ProtocolAssetSummary } from "@/types/api/assets";

interface TooltipParams {
  dataType?: string;
  data?: Partial<AssetGraphLayoutNode>;
}

interface AssetLineageGraphProps {
  protocol: string;
  summary?: ProtocolAssetSummary | null;
  onNavigate: (tab: AssetNavigateTab, scope: AssetScope) => void;
}

function nodeTooltip(params: TooltipParams): string {
  if (params.dataType !== "node" || !params.data) {
    return "";
  }

  return [
    `<div style="min-width: 12rem">`,
    `<div style="font-weight: 600; margin-bottom: 0.25rem">${params.data.name ?? "资产节点"}</div>`,
    `<div style="font-size: 12px; opacity: 0.84">状态：${getAssetGraphStatusLabel(params.data.status)}</div>`,
    typeof params.data.count === "number" ? `<div style="font-size: 12px; opacity: 0.84">数量：${params.data.count}</div>` : "",
    params.data.workspace_ref ? `<div style="font-size: 11px; opacity: 0.72; margin-top: 0.25rem">${shortenWorkspaceRef(params.data.workspace_ref, 42)}</div>` : "",
    `</div>`,
  ].join("");
}

function lineageEdgeCurveness(targetId: string): number {
  if (targetId === "scope:specs" || targetId === "scope:vuldocs") return -0.06;
  if (targetId === "scope:kb") return 0.04;
  if (targetId === "scope:risk" || targetId === "scope:instrumented") return 0.06;
  if (targetId === "scope:reports" || targetId === "scope:vulns") return 0.08;
  return 0.02;
}

export function AssetLineageGraph({
  protocol,
  summary,
  onNavigate,
}: AssetLineageGraphProps): JSX.Element {
  const normalizedProtocol = normalizeProtocol(protocol);
  const theme = useUiStore((state) => state.theme);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const mindmapQuery = useQuery({
    queryKey: ["protocol-mindmap", normalizedProtocol],
    queryFn: () => assetsApi.getProtocolMindmap(normalizedProtocol),
    retry: 0,
  });

  useEffect(() => {
    if (!mindmapQuery.error) return;
    reportGlobalError(mindmapQuery.error, "资产血缘加载失败", "assets");
    dockLog("error", "assets", "Asset lineage failed");
  }, [mindmapQuery.error]);

  const mindmap = useMemo(
    () => buildProtocolMindmapModel(normalizedProtocol, mindmapQuery.data, summary),
    [mindmapQuery.data, normalizedProtocol, summary],
  );
  const layout = useMemo(() => buildLineageGraphLayout(mindmap), [mindmap]);
  const nodesById = useMemo(
    () => new Map(layout.nodes.map((node) => [node.id, node] as const)),
    [layout.nodes],
  );

  useEffect(() => {
    if (selectedNodeId && nodesById.has(selectedNodeId)) return;
    setSelectedNodeId(layout.nodes.find((node) => node.graphKey === "source")?.id ?? layout.nodes[0]?.id ?? null);
  }, [layout.nodes, nodesById, selectedNodeId]);

  const selectedNode = selectedNodeId ? nodesById.get(selectedNodeId) ?? null : null;

  const colors = useMemo(() => {
    void theme;
    return {
      card: readCssHsl("--card"),
      cardMuted: readCssHsl("--card", 0.88),
      background: readCssHsl("--background", 0.7),
      border: readCssHsl("--border", 0.92),
      borderSoft: readCssHsl("--border", 0.56),
      text: readCssHsl("--foreground"),
      muted: readCssHsl("--muted-foreground"),
      blue: readCssHsl("--accent-blue"),
      blueSoft: readCssHsl("--accent-blue", 0.14),
      orange: readCssHsl("--accent-orange"),
      orangeSoft: readCssHsl("--accent-orange", 0.18),
      success: readCssHsl("--color-success"),
      successSoft: readCssHsl("--color-success", 0.16),
      danger: readCssHsl("--color-danger"),
      dangerSoft: readCssHsl("--color-danger", 0.14),
    };
  }, [theme]);

  const option = useMemo(() => {
    const chartNodes = layout.nodes.map((node) => {
      const isSelected = node.id === selectedNodeId;
      const isProtocol = node.category === "protocol";
      const isPrimary = node.category === "primary";
      const isEmpty = node.status === "empty";
      const fillColor = isProtocol
        ? colors.blueSoft
        : isPrimary
          ? (isEmpty ? colors.background : colors.orangeSoft)
          : (isEmpty ? colors.background : colors.cardMuted);
      const strokeColor = isSelected
        ? colors.blue
        : isProtocol
          ? colors.blue
          : isPrimary
            ? colors.orange
            : (isEmpty ? colors.borderSoft : colors.success);

      return {
        ...node,
        value: node.count ?? 0,
        symbol: "roundRect",
        symbolSize: node.symbolSize,
        label: {
          show: true,
          position: "inside",
          width: node.symbolSize[0] - 18,
          overflow: "truncate",
          fontSize: node.category === "protocol" ? 13 : 11.5,
          fontWeight: node.category === "protocol" ? 700 : 600,
          color: colors.text,
          lineHeight: 14,
        },
        itemStyle: {
          color: fillColor,
          borderColor: strokeColor,
          borderWidth: isSelected ? 2.2 : (isProtocol ? 1.8 : 1.4),
        },
      };
    });

    const chartLinks = layout.edges.map((edge) => ({
      ...edge,
      lineStyle: {
        color: colors.borderSoft,
        width: 1.5,
        curveness: lineageEdgeCurveness(edge.target),
        opacity: 0.96,
      },
      label: edge.label
        ? {
            show: true,
            formatter: edge.label,
            fontSize: 10,
            color: colors.muted,
            backgroundColor: colors.card,
            borderColor: colors.borderSoft,
            borderWidth: 1,
            borderRadius: 4,
            padding: [2, 4],
          }
        : undefined,
    }));

    return {
      animationDuration: 260,
      animationDurationUpdate: 180,
      tooltip: {
        trigger: "item",
        confine: true,
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: 1,
        textStyle: {
          color: colors.text,
          fontSize: 12,
        },
        formatter: (params: TooltipParams) => nodeTooltip(params),
      },
      series: [
        {
          type: "graph",
          layout: "none",
          roam: false,
          left: 20,
          right: 20,
          top: 20,
          bottom: 20,
          coordinateSystem: null,
          emphasis: {
            focus: "adjacency",
            scale: false,
          },
          lineStyle: {
            color: colors.borderSoft,
            width: 1.5,
            curveness: 0.04,
            opacity: 0.96,
          },
          edgeLabel: {
            show: true,
            fontSize: 10,
            color: colors.muted,
          },
          data: chartNodes,
          links: chartLinks,
        },
      ],
    };
  }, [colors, layout.edges, layout.nodes, selectedNodeId]);

  const handleNodeClick = (node: AssetGraphChartNodePayload): void => {
    if (!node.id) return;
    setSelectedNodeId(node.id);
  };

  const canNavigate = Boolean(selectedNode?.scope && isAssetScope(selectedNode.scope) && selectedNode.status !== "empty");

  return (
    <div className="min-h-0 min-w-0 overflow-hidden rounded-[var(--radius-xl)] border border-border bg-card p-4 shadow-console">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
        <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 font-mono text-xs text-foreground">
          {normalizedProtocol}
        </span>
        <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-xs text-muted-foreground">
          稳定坐标血缘图
        </span>
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
          {mindmapQuery.isFetching ? <RefreshCw className="size-3.5 animate-spin" /> : null}
          {mindmap.synthetic ? "后端空数据时使用固定模板" : "后端 mindmap + 固定 lane 布局"}
        </span>
      </div>

      <div className="mt-4 grid min-h-0 min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-h-0 min-w-0 overflow-hidden rounded-[var(--radius-lg)] border border-border/60 bg-background/60 p-3">
          <AssetGraphChart
            option={option}
            height={ASSET_GRAPH_HEIGHT}
            minWidth={ASSET_LINEAGE_MIN_WIDTH}
            className="min-h-0 min-w-0 overflow-hidden"
            onNodeClick={handleNodeClick}
          />
        </div>

        <aside className="min-h-0 min-w-0 rounded-[var(--radius-lg)] border border-border/60 bg-background/60 p-4">
          {selectedNode ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Node Detail</p>
                <h3 className="mt-2 text-lg font-semibold text-foreground">{selectedNode.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{getAssetGraphStatusLabel(selectedNode.status)}</p>
              </div>

              <div className="grid gap-2 text-sm text-muted-foreground">
                <div className="rounded-[var(--radius-md)] border border-border/60 bg-card/70 px-3 py-2">
                  <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/80">Kind</span>
                  <p className="mt-1 text-foreground">{selectedNode.kind}</p>
                </div>
                <div className="rounded-[var(--radius-md)] border border-border/60 bg-card/70 px-3 py-2">
                  <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/80">Count</span>
                  <p className="mt-1 text-foreground">{selectedNode.count ?? 0}</p>
                </div>
                <div className="rounded-[var(--radius-md)] border border-border/60 bg-card/70 px-3 py-2">
                  <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/80">Workspace Ref</span>
                  <p className="mt-1 break-all font-mono text-[11px] text-foreground">
                    {selectedNode.workspace_ref ? shortenWorkspaceRef(selectedNode.workspace_ref, 64) : "—"}
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full justify-between"
                disabled={!canNavigate}
                onClick={() => {
                  if (!selectedNode.scope || !isAssetScope(selectedNode.scope)) {
                    dockLog("info", "assets", `${selectedNode.name} 暂无可跳转 scope`);
                    return;
                  }
                  onNavigate(getAssetGraphNavigateTab(selectedNode.scope), selectedNode.scope);
                }}
              >
                跳转到 {selectedNode.scope ? getAssetGraphNavigateTab(selectedNode.scope) === "files" ? "文件页" : "索引页" : "资产页"}
                <ArrowRight className="size-4" />
              </Button>
            </div>
          ) : (
            <AssetEmptyState
              title="选择图谱节点"
              description="点击血缘节点查看状态、数量与 workspace:// 引用。"
              className="h-full"
            />
          )}
        </aside>
      </div>
    </div>
  );
}

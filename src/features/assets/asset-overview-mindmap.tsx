import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { GitBranch, RefreshCw } from "lucide-react";
import { dockLog } from "@/components/layout/dock";
import { reportGlobalError } from "@/components/common/global-error-center";
import { AssetGraphChart, type AssetGraphChartNodePayload } from "@/features/assets/asset-graph-chart";
import {
  ASSET_GRAPH_HEIGHT,
  buildOverviewMindmapLayout,
  buildProtocolMindmapModel,
  getAssetGraphNavigateTab,
  getAssetGraphStatusLabel,
  getAssetScopeLabel,
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

interface AssetOverviewMindmapProps {
  protocol: string;
  summary?: ProtocolAssetSummary | null;
  onNavigate: (tab: AssetNavigateTab, scope: AssetScope) => void;
}

function nodeTooltip(params: TooltipParams): string {
  if (params.dataType !== "node" || !params.data) {
    return "";
  }

  const ref = params.data.workspace_ref ? shortenWorkspaceRef(params.data.workspace_ref, 44) : "";
  const count = typeof params.data.count === "number" ? params.data.count : 0;

  return [
    `<div style="min-width: 13rem">`,
    `<div style="font-weight: 600; margin-bottom: 0.25rem">${params.data.name ?? "资产节点"}</div>`,
    `<div style="font-size: 12px; opacity: 0.84">状态：${getAssetGraphStatusLabel(params.data.status)}</div>`,
    `<div style="font-size: 12px; opacity: 0.84">数量：${count}</div>`,
    ref ? `<div style="font-size: 11px; opacity: 0.72; margin-top: 0.25rem">${ref}</div>` : "",
    `</div>`,
  ].join("");
}

export function AssetOverviewMindmap({
  protocol,
  summary,
  onNavigate,
}: AssetOverviewMindmapProps): JSX.Element {
  const normalizedProtocol = normalizeProtocol(protocol);
  const theme = useUiStore((state) => state.theme);

  const mindmapQuery = useQuery({
    queryKey: ["protocol-mindmap", normalizedProtocol],
    queryFn: () => assetsApi.getProtocolMindmap(normalizedProtocol),
    retry: 0,
  });

  useEffect(() => {
    if (!mindmapQuery.error) return;
    reportGlobalError(mindmapQuery.error, "资产关系加载失败", "assets");
    dockLog("error", "assets", "Asset mindmap failed");
  }, [mindmapQuery.error]);

  const mindmap = useMemo(
    () => buildProtocolMindmapModel(normalizedProtocol, mindmapQuery.data, summary),
    [mindmapQuery.data, normalizedProtocol, summary],
  );
  const layout = useMemo(() => buildOverviewMindmapLayout(mindmap), [mindmap]);

  const colors = useMemo(() => {
    void theme;
    return {
      card: readCssHsl("--card"),
      cardMuted: readCssHsl("--card", 0.84),
      background: readCssHsl("--background", 0.66),
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
    const protocolCount = mindmap.counts.source ?? summary?.files_count ?? 0;

    const chartNodes = layout.nodes.map((node) => {
      const isProtocol = node.category === "protocol";
      const isPrimary = node.category === "primary";
      const isEmpty = node.status === "empty";
      const fillColor = isProtocol
        ? colors.blueSoft
        : isPrimary
          ? (isEmpty ? colors.background : colors.orangeSoft)
          : (isEmpty ? colors.background : colors.successSoft);
      const strokeColor = isProtocol
        ? colors.blue
        : isPrimary
          ? colors.orange
          : (node.status === "empty" ? colors.borderSoft : colors.success);

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
          fontSize: isProtocol ? 13 : 12,
          fontWeight: isProtocol ? 700 : 600,
          color: colors.text,
          lineHeight: 14,
        },
        itemStyle: {
          color: fillColor,
          borderColor: strokeColor,
          borderWidth: isProtocol ? 1.8 : 1.4,
          shadowBlur: 0,
        },
      };
    });

    const chartLinks = layout.edges.map((edge) => ({
      ...edge,
      lineStyle: {
        color: colors.borderSoft,
        width: 1.4,
        curveness: edge.target === "scope:vulns" ? 0.08 : 0.04,
        opacity: 0.94,
      },
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
          left: 18,
          right: 18,
          top: 18,
          bottom: 18,
          coordinateSystem: null,
          emphasis: {
            focus: "adjacency",
            scale: false,
          },
          lineStyle: {
            color: colors.borderSoft,
            width: 1.4,
            curveness: 0.04,
            opacity: 0.94,
          },
          edgeLabel: {
            show: false,
          },
          data: chartNodes,
          links: chartLinks,
        },
      ],
      graphic: protocolCount > 0 ? [] : [
        {
          type: "text",
          left: "center",
          top: "86%",
          silent: true,
          style: {
            text: "导入源码后将生成真实资产关系",
            fill: colors.muted,
            font: "500 12px 'Fira Sans', sans-serif",
          },
        },
      ],
    };
  }, [colors, layout.edges, layout.nodes, mindmap.counts.source, summary?.files_count]);

  const handleNodeClick = (node: AssetGraphChartNodePayload): void => {
    const scope = String(node.scope ?? "").trim();
    const isEmpty = String(node.status ?? "").trim() === "empty" || (typeof node.count === "number" && node.count <= 0);

    if (!scope || !isAssetScope(scope) || isEmpty) {
      dockLog("info", "assets", `${node.name ?? "资产节点"} 暂无可跳转内容`);
      return;
    }

    onNavigate(getAssetGraphNavigateTab(scope), scope);
  };

  const recentSections = [
    { key: "specs", label: "最近分析" },
    { key: "seeds", label: "最近种子" },
    { key: "reports", label: "最近报告" },
  ] as const;

  return (
    <div className="min-h-0 min-w-0 space-y-4">
      <section className="min-h-0 min-w-0 rounded-[var(--radius-xl)] border border-border bg-card p-4 shadow-console">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
          <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 font-mono text-xs text-foreground">
            {normalizedProtocol}
          </span>
          <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-xs text-muted-foreground">
            源码 {summary?.files_count ?? mindmap.counts.source ?? 0}
          </span>
          <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-xs text-muted-foreground">
            状态 {getAssetGraphStatusLabel(summary?.ready ? "ready" : mindmap.statuses.source)}
          </span>
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
            {mindmapQuery.isFetching ? <RefreshCw className="size-3.5 animate-spin" /> : <GitBranch className="size-3.5" />}
            {mindmap.synthetic ? "使用本地推断链路" : "已对齐后端 mindmap"}
          </span>
        </div>

        <div className="mt-4 min-h-0 min-w-0 overflow-hidden rounded-[var(--radius-lg)] border border-border/60 bg-background/60 p-3">
          <AssetGraphChart option={option} height={ASSET_GRAPH_HEIGHT} onNodeClick={handleNodeClick} />
        </div>

        <div className="mt-4 space-y-3">
          {recentSections.map((section) => {
            const items = mindmap.recent_items[section.key] ?? [];

            return (
              <div key={section.key} className="rounded-[var(--radius-lg)] border border-border/60 bg-background/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">{section.label}</p>
                  <span className="text-xs text-muted-foreground">
                    {section.key === "specs" ? getAssetScopeLabel("specs") : section.key === "seeds" ? getAssetScopeLabel("seeds") : getAssetScopeLabel("reports")}
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {items.length > 0 ? (
                    items.map((item) => (
                      <div key={item.workspace_ref} className="rounded-[var(--radius-md)] border border-border/50 bg-card/70 px-3 py-2">
                        <p className="truncate text-sm text-foreground">{item.name}</p>
                        <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                          {shortenWorkspaceRef(item.workspace_ref, 42)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[var(--radius-md)] border border-dashed border-border/60 bg-card/50 px-3 py-3 text-sm text-muted-foreground">
                      {mindmap.empty ? "导入源码后将生成真实资产关系" : "当前暂无最近资产记录"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

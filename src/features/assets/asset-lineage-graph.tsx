import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, FileStack, Loader2, RefreshCcw, Share2 } from "lucide-react";
import { dockLog } from "@/components/layout/dock";
import { reportGlobalError } from "@/components/common/global-error-center";
import { Button } from "@/components/ui/button";
import { AssetGraphViewportLayout } from "@/features/assets/asset-graph-viewport-layout";
import { buildProtocolLineageDiagram } from "@/features/assets/asset-uml-lineage";
import { AssetUmlCanvas } from "@/features/assets/uml/asset-uml-canvas";
import {
  buildProtocolMindmapModel,
  getAssetGraphNavigateTab,
  getAssetGraphStatusLabel,
  isAssetScope,
  normalizeProtocol,
  type AssetGraphModel,
  type AssetScope,
} from "@/features/assets/asset-utils";
import { assetsApi } from "@/lib/api/services/assets";
import type { ProtocolAssetSummary } from "@/types/api/assets";
import type { UmlAssetEntity, UmlAssetRelation } from "@/features/assets/uml/asset-uml-types";

interface AssetLineageGraphProps {
  protocol: string;
  summary?: ProtocolAssetSummary | null;
  onNavigate: (tab: "files" | "index", scope: AssetScope) => void;
}

function emptyMindmap(protocol: string, summary?: ProtocolAssetSummary | null): AssetGraphModel {
  return buildProtocolMindmapModel(normalizeProtocol(protocol), undefined, summary);
}

export function AssetLineageGraph({
  protocol,
  summary,
  onNavigate,
}: AssetLineageGraphProps): JSX.Element {
  const normalizedProtocol = normalizeProtocol(protocol);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedRelationId, setSelectedRelationId] = useState<string | null>(null);

  const mindmapQuery = useQuery({
    queryKey: ["protocol-mindmap", normalizedProtocol],
    queryFn: () => assetsApi.getProtocolMindmap(normalizedProtocol),
    retry: 0,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!mindmapQuery.error) return;
    reportGlobalError(mindmapQuery.error, "协议 UML 关系图加载失败", "assets");
    dockLog("error", "assets", "Asset lineage failed");
  }, [mindmapQuery.error]);

  const graphModel = useMemo(
    () => mindmapQuery.data
      ? buildProtocolMindmapModel(normalizedProtocol, mindmapQuery.data, summary)
      : emptyMindmap(normalizedProtocol, summary),
    [mindmapQuery.data, normalizedProtocol, summary],
  );
  const diagram = useMemo(
    () => buildProtocolLineageDiagram(normalizedProtocol, graphModel, summary),
    [graphModel, normalizedProtocol, summary],
  );
  const entityMap = useMemo(() => new Map(diagram.entities.map((entity) => [entity.id, entity] as const)), [diagram.entities]);
  const relationMap = useMemo(() => new Map(diagram.relations.map((relation) => [relation.id, relation] as const)), [diagram.relations]);

  useEffect(() => {
    if (selectedEntityId && entityMap.has(selectedEntityId)) return;
    const sourceEntity = diagram.entities.find((entity) => entity.kind === "source");
    setSelectedEntityId(sourceEntity?.id ?? diagram.entities[0]?.id ?? null);
  }, [diagram.entities, entityMap, selectedEntityId]);

  const selectedEntity = selectedEntityId ? entityMap.get(selectedEntityId) ?? null : null;
  const selectedRelation = selectedRelationId ? relationMap.get(selectedRelationId) ?? null : null;
  const canNavigate = Boolean(selectedEntity?.scope && isAssetScope(selectedEntity.scope) && selectedEntity.status !== "empty");

  const toolbar = (
    <>
      <span className="rounded-full border border-border/70 bg-transparent px-2.5 py-1 text-xs text-muted-foreground">
        协议 {normalizedProtocol}
      </span>
      <span className="rounded-full border border-border/70 bg-transparent px-2.5 py-1 text-xs text-muted-foreground">
        实体 {diagram.entities.length}
      </span>
      <span className="rounded-full border border-border/70 bg-transparent px-2.5 py-1 text-xs text-muted-foreground">
        关系 {diagram.relations.length}
      </span>
      <div className="ml-auto flex items-center gap-2">
        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          {mindmapQuery.isFetching ? <Loader2 className="size-3.5 animate-spin" /> : <FileStack className="size-3.5" />}
          中心放射 UML 资产拓扑
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void mindmapQuery.refetch()}
          disabled={mindmapQuery.isFetching}
        >
          <RefreshCcw className="size-4" />
          刷新
        </Button>
      </div>
    </>
  );

  return (
    <AssetGraphViewportLayout
      toolbar={toolbar}
      aside={(
        <aside className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card shadow-none">
          <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-4 pb-3 pt-4">
            {selectedRelation ? <Share2 className="size-4 text-[hsl(var(--accent-blue))]" /> : <FileStack className="size-4 text-[hsl(var(--accent-orange))]" />}
            <p className="text-sm font-medium text-foreground">{selectedRelation ? "关系说明" : "实体详情"}</p>
          </div>

          {selectedRelation ? (
            <div className="console-scrollbar mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4 pr-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Relation</p>
                <h3 className="mt-2 text-lg font-semibold text-foreground">{selectedRelation.label ?? selectedRelation.kind ?? "asset relation"}</h3>
              </div>

              <div className="space-y-2">
                <div className="rounded-[var(--radius-lg)] border border-border/60 bg-transparent px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">type</p>
                  <p className="mt-1 text-xs text-foreground">{selectedRelation.kind ?? "association"}</p>
                </div>
                <div className="rounded-[var(--radius-lg)] border border-border/60 bg-transparent px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">from</p>
                  <p className="mt-1 text-xs text-foreground">{entityMap.get(selectedRelation.source)?.title ?? selectedRelation.source}</p>
                </div>
                <div className="rounded-[var(--radius-lg)] border border-border/60 bg-transparent px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">to</p>
                  <p className="mt-1 text-xs text-foreground">{entityMap.get(selectedRelation.target)?.title ?? selectedRelation.target}</p>
                </div>
                <div className="rounded-[var(--radius-lg)] border border-border/60 bg-transparent px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">meaning</p>
                  <p className="mt-1 text-xs text-foreground">{selectedRelation.description ?? "该关系描述资产在流程中的依赖或流向。"}</p>
                </div>
              </div>
            </div>
          ) : selectedEntity ? (
            <div className="console-scrollbar mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4 pr-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Selected</p>
                <h3 className="mt-2 text-lg font-semibold text-foreground">{selectedEntity.title}</h3>
              </div>

              <div className="space-y-2">
                <div className="rounded-[var(--radius-lg)] border border-border/60 bg-transparent px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">type</p>
                  <p className="mt-1 text-xs text-foreground">{selectedEntity.kind}</p>
                </div>
                <div className="rounded-[var(--radius-lg)] border border-border/60 bg-transparent px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">status</p>
                  <p className="mt-1 text-xs text-foreground">{getAssetGraphStatusLabel(selectedEntity.status)}</p>
                </div>
                <div className="rounded-[var(--radius-lg)] border border-border/60 bg-transparent px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">workspace ref</p>
                  <p className="mt-1 break-all font-mono text-xs text-foreground">{selectedEntity.workspaceRef ?? "—"}</p>
                </div>
              </div>

              <div className="space-y-2">
                {selectedEntity.attributes.map((row, index) => (
                  <div key={`${selectedEntity.id}-${row.key}-${index}`} className="rounded-[var(--radius-lg)] border border-border/60 bg-transparent px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{row.key}</p>
                    <p className="mt-1 break-all font-mono text-xs text-foreground">{String(row.value)}</p>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full justify-between"
                disabled={!canNavigate}
                onClick={() => {
                  if (!selectedEntity?.scope || !isAssetScope(selectedEntity.scope)) {
                    dockLog("info", "assets", `${selectedEntity?.title ?? "当前实体"} 暂无可跳转 scope`);
                    return;
                  }
                  onNavigate(getAssetGraphNavigateTab(selectedEntity.scope), selectedEntity.scope);
                }}
              >
                跳转到 {selectedEntity.scope ? (getAssetGraphNavigateTab(selectedEntity.scope) === "files" ? "文件页" : "索引页") : "资产页"}
                <ArrowRight className="size-4" />
              </Button>
            </div>
          ) : (
            <div className="m-4 flex min-h-0 flex-1 items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-border/70 bg-transparent px-4 text-center text-sm text-muted-foreground">
              选择 UML 实体或关系以查看详情。
            </div>
          )}
        </aside>
      )}
    >
      <div className="h-full min-h-0 min-w-0">
        <AssetUmlCanvas
          model={diagram}
          minHeight={520}
          className="h-full min-h-0 rounded-[var(--radius-lg)]"
          selectedEntityId={selectedEntityId}
          selectedRelationId={selectedRelationId}
          onEntitySelect={(entity: UmlAssetEntity) => {
            setSelectedRelationId(null);
            setSelectedEntityId(entity.id);
            dockLog("info", "assets", `Lineage entity selected: ${entity.title}`);
          }}
          onRelationSelect={(relation: UmlAssetRelation) => {
            setSelectedEntityId(null);
            setSelectedRelationId(relation.id);
            dockLog("info", "assets", `Lineage relation selected: ${relation.label ?? relation.kind ?? relation.id}`);
          }}
          onBackgroundClick={() => {
            setSelectedEntityId(null);
            setSelectedRelationId(null);
          }}
        />
      </div>
    </AssetGraphViewportLayout>
  );
}

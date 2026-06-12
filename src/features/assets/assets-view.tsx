import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { dockLog } from "@/components/layout/dock";
import { reportGlobalError } from "@/components/common/global-error-center";
import { useAuthStore } from "@/stores/auth-store";
import { AssetImportActions } from "@/features/assets/asset-import-actions";
import { AssetReferencePanel } from "@/features/assets/asset-reference-panel";
import { AssetShell } from "@/features/assets/asset-shell";
import {
  normalizeProtocol,
  type AssetPrimaryTab,
  type AssetScope,
} from "@/features/assets/asset-utils";
import { assetsApi } from "@/lib/api/services/assets";
import type { WorkspaceTreeItem } from "@/types/api/assets";

const AssetOverviewMindmap = lazy(() =>
  import("@/features/assets/asset-overview-mindmap").then((module) => ({ default: module.AssetOverviewMindmap })),
);
const AssetFileBrowser = lazy(() =>
  import("@/features/assets/asset-file-browser").then((module) => ({ default: module.AssetFileBrowser })),
);
const AssetSourcegraphSearch = lazy(() =>
  import("@/features/assets/asset-sourcegraph-search").then((module) => ({ default: module.AssetSourcegraphSearch })),
);
const AssetLineageGraph = lazy(() =>
  import("@/features/assets/asset-lineage-graph").then((module) => ({ default: module.AssetLineageGraph })),
);
const AssetIndexTable = lazy(() =>
  import("@/features/assets/asset-index-table").then((module) => ({ default: module.AssetIndexTable })),
);

function useQueryErrorToast(error: unknown, title: string, source: string, message: string): void {
  useEffect(() => {
    if (!error) return;
    reportGlobalError(error, title, source);
    dockLog("error", source, message);
  }, [error, message, source, title]);
}

function AssetTabFallback(): JSX.Element {
  return (
    <div className="min-h-0 min-w-0 rounded-[var(--radius-xl)] border border-border bg-card p-4 shadow-console">
      <div className="rounded-[var(--radius-lg)] border border-border/60 bg-background/60 px-4 py-10 text-center text-sm text-muted-foreground">
        页面加载中...
      </div>
    </div>
  );
}

export function AssetsView(): JSX.Element {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === "admin";

  const [protocol, setProtocol] = useState("legacy-default");
  const [protocolInput, setProtocolInput] = useState("legacy-default");
  const [activeTab, setActiveTab] = useState<AssetPrimaryTab>("overview");
  const [scope, setScope] = useState<AssetScope>("source");
  const [path, setPath] = useState("/");
  const [selectedItem, setSelectedItem] = useState<WorkspaceTreeItem | null>(null);
  const [refPanelOpen, setRefPanelOpen] = useState(true);
  const [importOpen, setImportOpen] = useState(false);

  const normalizedProtocol = normalizeProtocol(protocol);

  const protocolsQuery = useQuery({
    queryKey: ["asset-protocols"],
    queryFn: assetsApi.listProtocols,
    retry: 0,
  });
  const summaryQuery = useQuery({
    queryKey: ["protocol-assets-summary", normalizedProtocol],
    queryFn: () => assetsApi.getProtocolAssetsSummary(normalizedProtocol),
  });

  useQueryErrorToast(protocolsQuery.error, "协议列表加载失败", "assets", "Asset protocols failed");
  useQueryErrorToast(summaryQuery.error, "协议资产摘要加载失败", "assets", "Asset summary failed");

  const protocols = useMemo(() => protocolsQuery.data ?? [], [protocolsQuery.data]);
  const summary = summaryQuery.data ?? null;
  const showReferencePanel = activeTab === "files" || activeTab === "search" || activeTab === "index";

  const refreshLightData = async (): Promise<void> => {
    dockLog("info", "assets", "Asset shell refreshed");
    await Promise.all([protocolsQuery.refetch(), summaryQuery.refetch()]);
  };

  const applyProtocol = (): void => {
    const nextProtocol = normalizeProtocol(protocolInput);
    setProtocol(nextProtocol);
    setProtocolInput(nextProtocol);
    setScope("source");
    setPath("/");
    setSelectedItem(null);
  };

  const gridStyle = useMemo(
    () => ({
      gridTemplateColumns: refPanelOpen ? "minmax(0, 1fr) 300px" : "minmax(0, 1fr) 44px",
    }),
    [refPanelOpen],
  );

  const navigateFromGraph = (tab: Extract<AssetPrimaryTab, "files" | "index">, nextScope: AssetScope): void => {
    setScope(nextScope);
    setPath("/");
    setSelectedItem(null);
    setActiveTab(tab);
    setRefPanelOpen(true);
  };

  const handleSearchSelection = (item: WorkspaceTreeItem | null): void => {
    setSelectedItem(item);
    if (!item?.scope) return;
    setScope(item.scope as AssetScope);
    setRefPanelOpen(true);
  };

  const mainContent = (() => {
    switch (activeTab) {
      case "files":
        return (
          <AssetFileBrowser
            protocol={normalizedProtocol}
            scope={scope}
            path={path}
            selectedItem={selectedItem}
            onScopeChange={setScope}
            onPathChange={setPath}
            onSelectedItemChange={setSelectedItem}
          />
        );
      case "search":
        return (
          <AssetSourcegraphSearch
            protocol={normalizedProtocol}
            scope={scope}
            path={path}
            selectedItem={selectedItem}
            onSelectedItemChange={handleSearchSelection}
          />
        );
      case "lineage":
        return (
          <AssetLineageGraph
            protocol={normalizedProtocol}
            summary={summary}
            onNavigate={navigateFromGraph}
          />
        );
      case "index":
        return (
          <AssetIndexTable
            protocol={normalizedProtocol}
            scope={scope}
            path={path}
            selectedItem={selectedItem}
            onSelectedItemChange={setSelectedItem}
          />
        );
      case "overview":
      default:
        return (
          <AssetOverviewMindmap
            protocol={normalizedProtocol}
            summary={summary}
            onNavigate={navigateFromGraph}
          />
        );
    }
  })();

  return (
    <div className="min-h-0 min-w-0 space-y-4">
      <AssetShell
        protocol={normalizedProtocol}
        protocols={protocols}
        protocolInput={protocolInput}
        onProtocolInputChange={setProtocolInput}
        onProtocolApply={applyProtocol}
        summary={summary}
        view={activeTab}
        onViewChange={setActiveTab}
        onRefresh={refreshLightData}
        refreshPending={protocolsQuery.isFetching || summaryQuery.isFetching}
        actions={(
          <AssetImportActions
            protocol={normalizedProtocol}
            isAdmin={isAdmin}
            importOpen={importOpen}
            onImportOpenChange={setImportOpen}
            onAfterChange={refreshLightData}
            onProtocolDeleted={() => {
              setPath("/");
              setSelectedItem(null);
            }}
          />
        )}
      />

      {showReferencePanel ? (
        <div className="grid min-h-0 min-w-0 gap-4" style={gridStyle}>
          <div className="min-h-0 min-w-0">
            <Suspense fallback={<AssetTabFallback />}>
              {mainContent}
            </Suspense>
          </div>
          <div className="min-h-0 min-w-0">
            <AssetReferencePanel
              open={refPanelOpen}
              onOpenChange={setRefPanelOpen}
              protocol={normalizedProtocol}
              scope={scope}
              selectedItem={selectedItem}
              summary={summary}
            />
          </div>
        </div>
      ) : (
        <div className="min-h-0 min-w-0">
          <Suspense fallback={<AssetTabFallback />}>
            {mainContent}
          </Suspense>
        </div>
      )}
    </div>
  );
}

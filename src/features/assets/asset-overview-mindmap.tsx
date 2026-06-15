import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Boxes, Loader2, RefreshCcw } from "lucide-react";
import { dockLog } from "@/components/layout/dock";
import { reportGlobalError } from "@/components/common/global-error-center";
import { Button } from "@/components/ui/button";
import { AssetEmptyState } from "@/features/assets/asset-empty-state";
import { AssetGraphViewportLayout } from "@/features/assets/asset-graph-viewport-layout";
import { buildWorkspaceRef, normalizeProtocol } from "@/features/assets/asset-utils";
import { AssetUmlCanvas } from "@/features/assets/uml/asset-uml-canvas";
import {
  layoutOverviewCatalog,
} from "@/features/assets/uml/asset-uml-layout";
import type {
  UmlAssetEntity,
  UmlAssetStatus,
} from "@/features/assets/uml/asset-uml-types";
import { assetsApi } from "@/lib/api/services/assets";
import type { ProtocolAssetSummary, ProtocolMindmapResponse } from "@/types/api/assets";

interface AssetOverviewMindmapProps {
  protocol: string;
  protocols: string[];
  summary?: ProtocolAssetSummary | null;
  onProtocolChange: (protocol: string) => void;
}

interface AssetCatalogFetchResult {
  entries: AssetCatalogProtocolEntry[];
  degradedProtocols: string[];
}

interface AssetCatalogProtocolEntry {
  protocol: string;
  summary?: ProtocolAssetSummary | null;
  mindmap?: ProtocolMindmapResponse | null;
  error?: boolean;
}

const BATCH_SIZE = 4;

const STATUS_ORDER: UmlAssetStatus[] = ["degraded", "running", "ready", "available", "empty"];

function countOf(entry: AssetCatalogProtocolEntry, key: string): number {
  const counts = entry.mindmap?.counts ?? {};

  if (key === "source") {
    return Math.max(0, entry.summary?.files_count ?? counts.source ?? 0);
  }

  if (key === "crash") {
    return Math.max(0, counts.crash ?? counts.vulns ?? 0);
  }

  return Math.max(0, counts[key] ?? 0);
}

function statusOf(entry: AssetCatalogProtocolEntry): UmlAssetStatus {
  if (entry.error) return "degraded";

  const rawStatus = String(
    entry.mindmap?.statuses?.protocol
      ?? entry.mindmap?.nodes.find((node) => node.kind === "protocol")?.status
      ?? "",
  ).trim().toLowerCase();

  if (STATUS_ORDER.includes(rawStatus as UmlAssetStatus)) {
    return rawStatus as UmlAssetStatus;
  }

  if (entry.summary?.ready) return "ready";

  const hasAssets = [
    "source",
    "specs",
    "seeds",
    "risk",
    "jobs",
    "crash",
    "vulns",
    "reports",
    "debug",
    "kb",
  ].some((key) => countOf(entry, key) > 0);

  return hasAssets ? "available" : "empty";
}

function buildProtocolEntity(entry: AssetCatalogProtocolEntry): UmlAssetEntity {
  const normalized = normalizeProtocol(entry.protocol);
  const status = statusOf(entry);
  const workspaceRef = buildWorkspaceRef(normalized, "source");

  return {
    id: `protocol:${normalized}`,
    title: normalized,
    stereotype: "<<protocol>>",
    subtitle: workspaceRef,
    kind: "protocol",
    status,
    protocol: normalized,
    scope: "source",
    workspaceRef,
    x: 0,
    y: 0,
    width: 278,
    attributes: [
      { key: "status", value: status, tone: status === "degraded" ? "warning" : status === "ready" ? "success" : "default" },
      { key: "source", value: `${countOf(entry, "source")} files`, tone: "info" },
      { key: "seeds", value: countOf(entry, "seeds") },
      { key: "jobs", value: countOf(entry, "jobs") },
      { key: "crash", value: countOf(entry, "crash"), tone: "warning" },
      { key: "vulns", value: countOf(entry, "vulns"), tone: "danger" },
      { key: "reports", value: countOf(entry, "reports") },
      { key: "specs", value: countOf(entry, "specs") },
      { key: "risk", value: countOf(entry, "risk"), tone: "warning" },
      { key: "debug", value: countOf(entry, "debug") },
      { key: "kb", value: countOf(entry, "kb") },
    ],
  };
}

function buildCatalogLayout(entries: AssetCatalogProtocolEntry[], protocolCount: number) {
  const protocolEntities = entries.map(buildProtocolEntity);
  const totalSourceFiles = entries.reduce((sum, entry) => sum + countOf(entry, "source"), 0);
  const totalCrash = entries.reduce((sum, entry) => sum + countOf(entry, "crash"), 0);
  const totalVulns = entries.reduce((sum, entry) => sum + countOf(entry, "vulns"), 0);
  const totalJobs = entries.reduce((sum, entry) => sum + countOf(entry, "jobs"), 0);
  const totalReports = entries.reduce((sum, entry) => sum + countOf(entry, "reports"), 0);
  const degradedCount = entries.filter((entry) => entry.error).length;

  const catalogEntity: UmlAssetEntity = {
    id: "catalog:workspace",
    title: "Workspace Asset Catalog",
    stereotype: "<<asset catalog>>",
    kind: "catalog",
    status: degradedCount > 0 ? "degraded" : protocolCount > 0 ? "ready" : "empty",
    x: 0,
    y: 0,
    width: 388,
    attributes: [
      { key: "protocols", value: protocolCount, tone: "info" },
      { key: "source files", value: totalSourceFiles },
      { key: "crashes", value: totalCrash, tone: "warning" },
      { key: "vulnerabilities", value: totalVulns, tone: "danger" },
      { key: "jobs", value: totalJobs },
      { key: "reports", value: totalReports },
      { key: "degraded", value: degradedCount, tone: degradedCount > 0 ? "warning" : "default" },
    ],
  };

  return layoutOverviewCatalog([catalogEntity, ...protocolEntities]);
}

async function fetchCatalogEntries(
  protocolList: string[],
  currentProtocol: string,
  currentSummary?: ProtocolAssetSummary | null,
): Promise<AssetCatalogFetchResult> {
  const entries: AssetCatalogProtocolEntry[] = [];
  const degradedProtocols: string[] = [];

  for (let index = 0; index < protocolList.length; index += BATCH_SIZE) {
    const batch = protocolList.slice(index, index + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(async (protocol) => {
      try {
        const [summary, mindmap] = await Promise.all([
          protocol === currentProtocol && currentSummary
            ? Promise.resolve(currentSummary)
            : assetsApi.getProtocolAssetsSummary(protocol),
          assetsApi.getProtocolMindmap(protocol),
        ]);
        return {
          protocol,
          summary,
          mindmap,
          error: false,
        } satisfies AssetCatalogProtocolEntry;
      } catch (error) {
        degradedProtocols.push(protocol);
        reportGlobalError(error, `协议 ${protocol} 资产目录加载失败`, "assets");
        dockLog("error", "assets", `Asset catalog degraded: ${protocol}`);
        return {
          protocol,
          summary: protocol === currentProtocol ? currentSummary ?? undefined : undefined,
          mindmap: undefined,
          error: true,
        } satisfies AssetCatalogProtocolEntry;
      }
    }));
    entries.push(...batchResults);
  }

  return {
    entries,
    degradedProtocols,
  };
}

export function AssetOverviewMindmap({
  protocol,
  protocols,
  summary,
  onProtocolChange,
}: AssetOverviewMindmapProps): JSX.Element {
  const normalizedProtocol = normalizeProtocol(protocol);
  const normalizedProtocols = useMemo(
    () => protocols.map((item) => normalizeProtocol(item)).filter(Boolean),
    [protocols],
  );

  const protocolList = useMemo(() => {
    const values = normalizedProtocols.length > 0
      ? Array.from(new Set([normalizedProtocol, ...normalizedProtocols]))
      : [normalizedProtocol];
    return values.sort((left, right) => left.localeCompare(right, "zh-CN", { sensitivity: "base" }));
  }, [normalizedProtocol, normalizedProtocols]);

  const catalogQuery = useQuery({
    queryKey: ["assets-catalog-overview", protocolList.join(","), normalizedProtocol, summary?.files_count ?? 0, summary?.ready ?? false],
    queryFn: () => fetchCatalogEntries(protocolList, normalizedProtocol, summary),
    retry: 0,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!catalogQuery.error) return;
    reportGlobalError(catalogQuery.error, "全局资产目录加载失败", "assets");
    dockLog("error", "assets", "Asset catalog failed");
  }, [catalogQuery.error]);

  const entries = catalogQuery.data?.entries ?? protocolList.map((item) => ({
    protocol: item,
    summary: item === normalizedProtocol ? summary ?? undefined : undefined,
    error: false,
  }));
  const degradedProtocols = catalogQuery.data?.degradedProtocols ?? [];
  const layout = useMemo(
    () => buildCatalogLayout(entries, normalizedProtocols.length || entries.length),
    [entries, normalizedProtocols.length],
  );
  const totalProtocols = normalizedProtocols.length || entries.length;
  const readyProtocols = entries.filter((entry) => entry.summary?.ready).length;
  const loadedProtocols = catalogQuery.data?.entries.filter((entry) => Boolean(entry.summary || entry.mindmap || entry.error)).length ?? 0;
  const hasAnyProtocol = totalProtocols > 0;

  const toolbar = (
    <>
      <span className="rounded-full border border-border/70 bg-transparent px-2.5 py-1 text-xs text-muted-foreground">
        协议 {totalProtocols}
      </span>
      <span className="rounded-full border border-border/70 bg-transparent px-2.5 py-1 text-xs text-muted-foreground">
        已加载 {loadedProtocols}
      </span>
      <span className="rounded-full border border-border/70 bg-transparent px-2.5 py-1 text-xs text-muted-foreground">
        就绪 {readyProtocols}
      </span>
      <span className="rounded-full border border-border/70 bg-transparent px-2.5 py-1 text-xs text-muted-foreground">
        降级 {degradedProtocols.length}
      </span>
      <div className="ml-auto flex items-center gap-2">
        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          {catalogQuery.isFetching ? <Loader2 className="size-3.5 animate-spin" /> : <Boxes className="size-3.5" />}
          全局 UML 资产目录
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void catalogQuery.refetch()}
          disabled={catalogQuery.isFetching}
        >
          <RefreshCcw className="size-4" />
          刷新
        </Button>
      </div>
    </>
  );

  if (!hasAnyProtocol) {
    return (
      <AssetGraphViewportLayout toolbar={toolbar}>
        <AssetEmptyState
          title="资产目录为空"
          description="当前节点还没有协议项目。导入源码后，总览会显示全局 UML 资产目录。"
          className="flex h-full min-h-0 items-center justify-center rounded-[var(--radius-lg)] border border-border bg-card p-6 shadow-console"
        />
      </AssetGraphViewportLayout>
    );
  }

  return (
    <AssetGraphViewportLayout toolbar={toolbar}>
      <AssetUmlCanvas
        model={layout}
        minHeight={560}
        className="h-full min-h-0 rounded-[var(--radius-lg)]"
        selectedEntityId={`protocol:${normalizedProtocol}`}
        onEntitySelect={(entity) => {
          if (!entity.id.startsWith("protocol:")) return;
          onProtocolChange(entity.id.replace(/^protocol:/, ""));
          dockLog("info", "assets", `Catalog protocol selected: ${entity.title}`);
        }}
      />
    </AssetGraphViewportLayout>
  );
}

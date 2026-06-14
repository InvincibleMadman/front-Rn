import type { ProtocolAssetSummary, ProtocolMindmapResponse } from "@/types/api/assets";
import { buildWorkspaceRef, normalizeProtocol, shortenWorkspaceRef } from "@/features/assets/asset-utils";

export type AssetUmlRole = "catalog" | "protocol" | "primary" | "secondary" | "support";

export interface AssetUmlAttributeRow {
  key: string;
  value: string;
  tone?: "default" | "muted" | "accent" | "success" | "danger";
}

export interface AssetUmlNode {
  id: string;
  title: string;
  role: AssetUmlRole;
  status: string;
  x: number;
  y: number;
  width: number;
  height: number;
  paletteIndex?: number;
  scope?: string;
  kind?: string;
  count?: number;
  workspaceRef?: string;
  attributes: AssetUmlAttributeRow[];
  selected?: boolean;
  clickable?: boolean;
}

export interface AssetUmlEdge {
  source: string;
  target: string;
  label?: string;
  inferred?: boolean;
  composite?: boolean;
}

export interface AssetUmlLayout {
  nodes: AssetUmlNode[];
  edges: AssetUmlEdge[];
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface AssetCatalogProtocolEntry {
  protocol: string;
  summary?: ProtocolAssetSummary | null;
  mindmap?: ProtocolMindmapResponse | null;
  error?: boolean;
}

type MindmapLike = ProtocolMindmapResponse & {
  synthetic?: boolean;
  empty?: boolean;
};

const ROLE_BASE_SIZE: Record<AssetUmlRole, { width: number; height: number }> = {
  catalog: { width: 380, height: 124 },
  protocol: { width: 324, height: 148 },
  primary: { width: 304, height: 138 },
  secondary: { width: 286, height: 130 },
  support: { width: 260, height: 120 },
};

const ROLE_ROW_HEIGHT: Record<AssetUmlRole, number> = {
  catalog: 22,
  protocol: 22,
  primary: 21,
  secondary: 20,
  support: 20,
};

const ROLE_HEADER_HEIGHT: Record<AssetUmlRole, number> = {
  catalog: 36,
  protocol: 35,
  primary: 34,
  secondary: 34,
  support: 32,
};

const LINEAGE_COORDINATES: Record<string, { x: number; y: number }> = {
  protocol: { x: 100, y: 246 },
  source: { x: 360, y: 246 },
  specs: { x: 650, y: 104 },
  vuldocs: { x: 650, y: 206 },
  kb: { x: 650, y: 308 },
  seeds: { x: 950, y: 150 },
  risk: { x: 950, y: 326 },
  instrumented: { x: 950, y: 446 },
  jobs: { x: 1250, y: 246 },
  crash: { x: 1540, y: 104 },
  debug: { x: 1540, y: 246 },
  reports: { x: 1540, y: 388 },
  vulns: { x: 1820, y: 388 },
  build: { x: 650, y: 430 },
  binaries: { x: 950, y: 560 },
  dicts: { x: 1250, y: 560 },
  build_logs: { x: 1540, y: 560 },
  build_plans: { x: 1820, y: 560 },
  build_runs: { x: 2100, y: 560 },
  launch_profiles: { x: 2380, y: 560 },
};

const LINEAGE_SCOPE_ORDER = [
  "source",
  "specs",
  "vuldocs",
  "kb",
  "seeds",
  "risk",
  "instrumented",
  "jobs",
  "crash",
  "debug",
  "reports",
  "vulns",
  "build",
  "binaries",
  "dicts",
  "build_logs",
  "build_plans",
  "build_runs",
  "launch_profiles",
] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatInteger(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "0";
  }
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatStatusLabel(status: string): string {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "ready") return "已就绪";
  if (normalized === "available") return "有资产";
  if (normalized === "degraded") return "降级";
  if (normalized === "empty") return "空";
  return normalized || "未知";
}

function measureNode(role: AssetUmlRole, title: string, attributes: AssetUmlAttributeRow[]): { width: number; height: number } {
  const base = ROLE_BASE_SIZE[role];
  const header = ROLE_HEADER_HEIGHT[role];
  const rowHeight = ROLE_ROW_HEIGHT[role];
  const longestValue = Math.max(
    title.length,
    ...attributes.map((row) => `${row.key}: ${row.value}`.length),
  );
  const widthBoost = clamp((longestValue - 22) * 4, 0, role === "catalog" ? 104 : 84);
  const heightBoost = Math.max(0, attributes.length - 3) * Math.max(14, rowHeight - 4);
  return {
    width: clamp(base.width + widthBoost, base.width, base.width + 108),
    height: Math.max(base.height, header + (attributes.length * rowHeight) + 20 + heightBoost),
  };
}

function createCatalogNode(
  protocol: string,
  summary: ProtocolAssetSummary | null | undefined,
  mindmap: ProtocolMindmapResponse | null | undefined,
  degraded: boolean,
  selectedProtocol: string,
  index: number,
): AssetUmlNode {
  const normalizedProtocol = normalizeProtocol(protocol);
  const sourceCount = summary?.files_count ?? mindmap?.counts?.source ?? 0;
  const status = degraded
    ? "degraded"
    : summary?.ready
    ? "ready"
    : ((sourceCount > 0 || Object.values(mindmap?.counts ?? {}).some((value) => Number(value) > 0)) ? "available" : "empty");
  const primaryAssets = ["specs", "seeds", "risk", "jobs"].reduce(
    (total, key) => total + (mindmap?.counts?.[key] ?? 0),
    0,
  );
  const outputAssets = ["reports", "vulns", "debug"].reduce(
    (total, key) => total + (mindmap?.counts?.[key] ?? 0),
    0,
  );
  const isSelected = normalizedProtocol === normalizeProtocol(selectedProtocol);
  const attributes: AssetUmlAttributeRow[] = [
    { key: "status", value: formatStatusLabel(status), tone: status === "ready" ? "success" : status === "empty" ? "muted" : "accent" },
    { key: "source", value: formatInteger(sourceCount) },
    { key: "assets", value: formatInteger(primaryAssets), tone: "accent" },
    { key: "outputs", value: formatInteger(outputAssets) },
    { key: "workspace_ref", value: shortenWorkspaceRef(summary?.source_ref ?? buildWorkspaceRef(normalizedProtocol, "source"), 52), tone: "muted" },
  ];
  const size = measureNode("protocol", normalizedProtocol, attributes);
  return {
    id: `protocol:${normalizedProtocol}`,
    title: normalizedProtocol,
    role: "protocol",
    status,
    x: 0,
    y: 0,
    width: size.width,
    height: size.height,
    paletteIndex: (index % 5) + 1,
    kind: "protocol",
    scope: "source",
    count: sourceCount,
    workspaceRef: summary?.source_ref ?? buildWorkspaceRef(normalizedProtocol, "source"),
    attributes,
    selected: isSelected,
    clickable: true,
  };
}

export function buildAssetsCatalogUmlLayout(
  entries: AssetCatalogProtocolEntry[],
  selectedProtocol: string,
): AssetUmlLayout {
  const normalizedSelected = normalizeProtocol(selectedProtocol);
  const catalogSummary = entries.reduce(
    (accumulator, entry) => {
      const filesCount = entry.summary?.files_count ?? 0;
      accumulator.protocolCount += 1;
      accumulator.filesCount += filesCount;
      if (entry.summary?.ready) accumulator.readyCount += 1;
      if (entry.error) accumulator.degradedCount += 1;
      return accumulator;
    },
    { protocolCount: 0, filesCount: 0, readyCount: 0, degradedCount: 0 },
  );

  const rootAttributes: AssetUmlAttributeRow[] = [
    { key: "protocols", value: formatInteger(catalogSummary.protocolCount), tone: "accent" },
    { key: "ready", value: formatInteger(catalogSummary.readyCount), tone: "success" },
    { key: "files_total", value: formatInteger(catalogSummary.filesCount) },
    { key: "degraded", value: formatInteger(catalogSummary.degradedCount), tone: "danger" },
  ];
  const rootSize = measureNode("catalog", "Assets Catalog", rootAttributes);

  const protocolNodes = entries.map((entry, index) => createCatalogNode(entry.protocol, entry.summary, entry.mindmap, Boolean(entry.error), normalizedSelected, index));
  const columns = Math.max(2, Math.min(5, Math.ceil(Math.sqrt(Math.max(protocolNodes.length, 1)))));
  const nodeWidth = ROLE_BASE_SIZE.protocol.width + 8;
  const nodeHeight = ROLE_BASE_SIZE.protocol.height + 4;
  const gapX = 30;
  const gapY = 28;
  const gridWidth = columns * nodeWidth + Math.max(0, columns - 1) * gapX;
  const rootX = Math.max(0, Math.round((gridWidth - rootSize.width) / 2));
  const rootY = 0;
  const startY = rootSize.height + 72;

  const nodes: AssetUmlNode[] = [
    {
      id: "catalog:workspace",
      title: "Assets Catalog",
      role: "catalog",
      status: catalogSummary.degradedCount > 0 ? "degraded" : (catalogSummary.readyCount > 0 ? "ready" : "empty"),
      x: rootX,
      y: rootY,
      width: rootSize.width,
      height: rootSize.height,
      paletteIndex: 1,
      kind: "catalog",
      count: catalogSummary.protocolCount,
      workspaceRef: "workspace://catalog/",
      attributes: rootAttributes,
      clickable: false,
    },
    ...protocolNodes.map((node, index) => {
      const row = Math.floor(index / columns);
      const col = index % columns;
      return {
        ...node,
        x: col * (nodeWidth + gapX),
        y: startY + (row * (nodeHeight + gapY)),
      };
    }),
  ];

  const edges: AssetUmlEdge[] = protocolNodes.map((node) => ({
    source: "catalog:workspace",
    target: node.id,
    composite: true,
    label: "protocol",
    inferred: Boolean(node.status === "degraded"),
  }));

  const bounds = nodes.reduce(
    (accumulator, node) => ({
      x: Math.min(accumulator.x, node.x),
      y: Math.min(accumulator.y, node.y),
      width: Math.max(accumulator.width, node.x + node.width),
      height: Math.max(accumulator.height, node.y + node.height),
    }),
    { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY, width: 0, height: 0 },
  );

  return {
    nodes,
    edges,
    bounds: {
      x: Number.isFinite(bounds.x) ? bounds.x : 0,
      y: Number.isFinite(bounds.y) ? bounds.y : 0,
      width: bounds.width,
      height: bounds.height,
    },
  };
}

function protocolNodeRole(key: string): AssetUmlRole {
  if (key === "protocol") return "catalog";
  if (key === "source" || key === "specs" || key === "risk" || key === "seeds" || key === "jobs") {
    return "primary";
  }
  if (LINEAGE_SCOPE_ORDER.includes(key as (typeof LINEAGE_SCOPE_ORDER)[number])) {
    return "secondary";
  }
  return "support";
}

function buildNodeAttributes(
  protocol: string,
  node: MindmapLike["nodes"][number],
  summary?: ProtocolAssetSummary | null,
): AssetUmlAttributeRow[] {
  const scope = String(node.scope ?? "").trim();
  const workspaceRef = String(node.workspace_ref ?? "").trim() || (scope ? buildWorkspaceRef(protocol, scope) : "");
  const count = typeof node.count === "number" ? node.count : 0;
  const attributes: AssetUmlAttributeRow[] = [
    { key: "kind", value: String(node.kind || "asset"), tone: "accent" },
    { key: "status", value: formatStatusLabel(String(node.status || "")), tone: node.status === "ready" ? "success" : node.status === "empty" ? "muted" : "accent" },
  ];

  if (typeof node.count === "number" || count > 0) {
    attributes.push({ key: "count", value: formatInteger(count) });
  }

  if (workspaceRef) {
    attributes.push({ key: "workspace_ref", value: shortenWorkspaceRef(workspaceRef, 54), tone: "muted" });
  }

  if (node.id === `protocol:${normalizeProtocol(protocol)}`) {
    attributes.unshift({ key: "files", value: formatInteger(summary?.files_count ?? 0) });
  }

  if (scope) {
    attributes.push({ key: "scope", value: scope, tone: "accent" });
  }

  return attributes;
}

export function buildProtocolLineageUmlLayout(
  protocol: string,
  mindmap: MindmapLike,
  summary?: ProtocolAssetSummary | null,
): AssetUmlLayout {
  const normalizedProtocol = normalizeProtocol(protocol);
  const nodesByKey = new Map<string, MindmapLike["nodes"][number]>();

  for (const node of mindmap.nodes) {
    const key = String(node.id || "").startsWith("protocol:") ? "protocol" : String(node.id || "").replace(/^scope:/, "");
    nodesByKey.set(key, node);
  }

  const positionedNodes = new Map<string, AssetUmlNode>();
  const rootNode = nodesByKey.get("protocol") ?? {
    id: `protocol:${normalizedProtocol}`,
    name: normalizedProtocol,
    kind: "protocol",
    status: summary?.ready ? "ready" : ((summary?.files_count ?? 0) > 0 ? "available" : "empty"),
  };

  const rootAttributes: AssetUmlAttributeRow[] = [
    { key: "kind", value: "protocol", tone: "accent" },
    { key: "status", value: formatStatusLabel(String(rootNode.status || "")), tone: summary?.ready ? "success" : "accent" },
    { key: "files", value: formatInteger(summary?.files_count ?? mindmap.counts.source ?? 0) },
    { key: "workspace_ref", value: shortenWorkspaceRef(summary?.source_ref ?? buildWorkspaceRef(normalizedProtocol, "source"), 54), tone: "muted" },
  ];
  const rootSize = measureNode("catalog", normalizedProtocol, rootAttributes);
  positionedNodes.set("protocol", {
    id: rootNode.id,
    title: normalizedProtocol,
    role: "catalog",
    status: String(rootNode.status || "empty"),
    x: LINEAGE_COORDINATES.protocol.x,
    y: LINEAGE_COORDINATES.protocol.y,
    width: rootSize.width,
    height: rootSize.height,
    paletteIndex: 1,
    kind: "protocol",
    scope: "source",
    count: summary?.files_count ?? mindmap.counts.source ?? 0,
    workspaceRef: summary?.source_ref ?? buildWorkspaceRef(normalizedProtocol, "source"),
    attributes: rootAttributes,
    selected: true,
    clickable: true,
  });

  for (const key of LINEAGE_SCOPE_ORDER) {
    const node = nodesByKey.get(key);
    if (!node) continue;
    const role = protocolNodeRole(key);
    const attributes = buildNodeAttributes(normalizedProtocol, node, summary);
    const size = measureNode(role, String(node.name || key), attributes);
    const position = LINEAGE_COORDINATES[key] ?? { x: 2300, y: 120 + (positionedNodes.size * 88) };
    positionedNodes.set(key, {
      id: node.id,
      title: String(node.name || key),
      role,
      status: String(node.status || "empty"),
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
      paletteIndex: role === "primary" ? 2 : role === "secondary" ? 3 + (key.length % 3) : 2,
      scope: String(node.scope || key),
      kind: String(node.kind || role),
      count: typeof node.count === "number" ? node.count : 0,
      workspaceRef: String(node.workspace_ref || "") || (node.scope ? buildWorkspaceRef(normalizedProtocol, node.scope) : undefined),
      attributes,
      clickable: true,
    });
  }

  for (const node of mindmap.nodes) {
    const key = String(node.id || "").startsWith("protocol:") ? "protocol" : String(node.id || "").replace(/^scope:/, "");
    if (positionedNodes.has(key)) continue;
    const role = protocolNodeRole(key);
    const attributes = buildNodeAttributes(normalizedProtocol, node, summary);
    const size = measureNode(role, String(node.name || key), attributes);
    const position = { x: 2300, y: 120 + (positionedNodes.size * 88) };
    positionedNodes.set(key, {
      id: node.id,
      title: String(node.name || key),
      role,
      status: String(node.status || "empty"),
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
      paletteIndex: 4,
      scope: node.scope,
      kind: node.kind,
      count: typeof node.count === "number" ? node.count : 0,
      workspaceRef: String(node.workspace_ref || "") || (node.scope ? buildWorkspaceRef(normalizedProtocol, node.scope) : undefined),
      attributes,
      clickable: true,
    });
  }

  const edges = mindmap.edges
    .map<AssetUmlEdge | null>((edge) => {
      const sourceKey = String(edge.source || "").startsWith("protocol:") ? "protocol" : String(edge.source || "").replace(/^scope:/, "");
      const targetKey = String(edge.target || "").startsWith("protocol:") ? "protocol" : String(edge.target || "").replace(/^scope:/, "");
      if (!positionedNodes.has(sourceKey) || !positionedNodes.has(targetKey)) return null;
      return {
        source: sourceKey,
        target: targetKey,
        label: edge.label,
        inferred: Boolean(edge.inferred),
      };
    })
    .filter((item): item is AssetUmlEdge => Boolean(item));

  const bounds = [...positionedNodes.values()].reduce(
    (accumulator, node) => ({
      x: Math.min(accumulator.x, node.x),
      y: Math.min(accumulator.y, node.y),
      width: Math.max(accumulator.width, node.x + node.width),
      height: Math.max(accumulator.height, node.y + node.height),
    }),
    { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY, width: 0, height: 0 },
  );

  return {
    nodes: [...positionedNodes.values()],
    edges,
    bounds: {
      x: Number.isFinite(bounds.x) ? bounds.x : 0,
      y: Number.isFinite(bounds.y) ? bounds.y : 0,
      width: bounds.width,
      height: bounds.height,
    },
  };
}

export function describeCatalogProtocol(summary?: ProtocolAssetSummary | null): string {
  if (!summary) return "degraded";
  if (summary.ready) return "ready";
  return summary.files_count > 0 ? "available" : "empty";
}

export function summarizeCatalogFiles(entries: AssetCatalogProtocolEntry[]): number {
  return entries.reduce((total, entry) => total + (entry.summary?.files_count ?? 0), 0);
}

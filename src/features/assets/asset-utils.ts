import type { LucideIcon } from "lucide-react";
import {
  Binary,
  BookOpen,
  Bug,
  File,
  FileCode2,
  FileText,
  Folder,
  FolderTree,
  Hammer,
  History,
  ListTree,
  Play,
  ScrollText,
  Wrench,
} from "lucide-react";
import type {
  ProtocolAssetSummary,
  ProtocolMindmapEdge,
  ProtocolMindmapNode,
  ProtocolMindmapResponse,
  WorkspaceIndexItem,
  WorkspaceSearchMatch,
  WorkspaceTreeItem,
} from "@/types/api/assets";

export const ASSET_SCOPES = [
  "source",
  "specs",
  "vuldocs",
  "kb",
  "seeds",
  "risk",
  "jobs",
  "debug",
  "reports",
  "history",
  "build",
  "binaries",
  "dicts",
  "build_logs",
  "build_plans",
  "build_runs",
  "launch_profiles",
] as const;

export const ASSET_QUERY_SCOPE_SUGGESTIONS = [
  "source",
  "specs",
  "vuldocs",
  "kb",
  "seeds",
  "risk",
  "jobs",
  "debug",
  "reports",
  "history",
] as const;

export const ASSET_QUERY_EXT_SUGGESTIONS = ["c", "h", "json", "dict", "log", "md", "yaml", "txt"] as const;
export const ASSET_QUERY_TYPE_SUGGESTIONS = ["text", "json", "hex", "file", "directory", "archive", "data", "bug"] as const;
export const ASSET_QUERY_EXAMPLES = [
  "server.c",
  "*.dict",
  "scope:risk crash",
  "type:json",
  "ext:c",
  "path:src",
  "content:Modbus",
  "job:20260608",
] as const;

export type AssetScope = (typeof ASSET_SCOPES)[number];

export const ASSET_PRIMARY_TABS = [
  "overview",
  "files",
  "search",
  "lineage",
  "index",
] as const;

export type AssetPrimaryTab = (typeof ASSET_PRIMARY_TABS)[number];
export type AssetNavigateTab = Extract<AssetPrimaryTab, "files" | "index">;
export type AssetGraphNodeCategory = "protocol" | "primary" | "secondary";
export type AssetIndexSort = "updated" | "name" | "scope";

export const ASSET_GRAPH_HEIGHT = 520;
export const ASSET_LINEAGE_MIN_WIDTH = 1580;

export interface ParsedAssetQuery {
  freeText: string;
  scope: AssetScope[];
  ext: string[];
  type: string[];
  path: string[];
  content: string[];
  job: string[];
}

export interface AssetSearchRequestState {
  q?: string;
  scopes?: string[];
  ext?: string;
  type?: string;
  path?: string;
  content: boolean;
  limit: number;
}

export interface AssetIndexFilterState {
  scopes: AssetScope[];
  ext: string[];
  type: string[];
  path: string[];
  sort: AssetIndexSort;
}

export interface AssetQuerySuggestion {
  id: string;
  label: string;
  insertValue: string;
  description: string;
  kind: "scope" | "ext" | "type" | "path" | "content" | "example";
}

export interface AssetGraphModel extends ProtocolMindmapResponse {
  synthetic: boolean;
  empty: boolean;
}

export interface AssetGraphLayoutNode extends ProtocolMindmapNode {
  graphKey: string;
  category: AssetGraphNodeCategory;
  x: number;
  y: number;
  symbolSize: [number, number];
}

export interface AssetGraphLayout {
  nodes: AssetGraphLayoutNode[];
  edges: ProtocolMindmapEdge[];
}

interface TemplateGraphNode {
  key: string;
  name: string;
  scope?: string;
  kind: "primary" | "secondary";
}

const SCOPE_META: Record<AssetScope, { label: string; icon: LucideIcon }> = {
  source: { label: "源码", icon: FileCode2 },
  specs: { label: "分析", icon: ScrollText },
  vuldocs: { label: "文档", icon: FileText },
  kb: { label: "知识", icon: BookOpen },
  seeds: { label: "种子", icon: ListTree },
  risk: { label: "风险", icon: Wrench },
  jobs: { label: "任务", icon: Play },
  debug: { label: "调试", icon: Bug },
  reports: { label: "报告", icon: FileText },
  history: { label: "历史", icon: History },
  build: { label: "构建", icon: Hammer },
  binaries: { label: "二进制", icon: Binary },
  dicts: { label: "字典", icon: BookOpen },
  build_logs: { label: "构建日志", icon: ScrollText },
  build_plans: { label: "构建计划", icon: FolderTree },
  build_runs: { label: "构建运行", icon: ListTree },
  launch_profiles: { label: "启动配置", icon: Play },
};

const GRAPH_TEMPLATE_NODES: readonly TemplateGraphNode[] = [
  { key: "source", name: "源码", scope: "source", kind: "primary" },
  { key: "specs", name: "分析", scope: "specs", kind: "primary" },
  { key: "vuldocs", name: "文档", scope: "vuldocs", kind: "secondary" },
  { key: "kb", name: "知识库", scope: "kb", kind: "secondary" },
  { key: "risk", name: "风险", scope: "risk", kind: "primary" },
  { key: "instrumented", name: "插桩", scope: "risk", kind: "secondary" },
  { key: "seeds", name: "种子", scope: "seeds", kind: "primary" },
  { key: "jobs", name: "任务", scope: "jobs", kind: "primary" },
  { key: "crash", name: "Crash", scope: "jobs", kind: "secondary" },
  { key: "debug", name: "调试", scope: "debug", kind: "secondary" },
  { key: "reports", name: "报告", scope: "reports", kind: "secondary" },
  { key: "vulns", name: "漏洞", scope: "history", kind: "secondary" },
] as const;

const GRAPH_TEMPLATE_EDGES: readonly ProtocolMindmapEdge[] = [
  { source: "protocol:__protocol__", target: "scope:source", label: "协议提取" },
  { source: "protocol:__protocol__", target: "scope:specs", label: "分析沉淀" },
  { source: "protocol:__protocol__", target: "scope:kb", label: "知识归档" },
  { source: "scope:source", target: "scope:seeds", label: "种子生成", inferred: true },
  { source: "scope:source", target: "scope:risk", label: "风险分析", inferred: true },
  { source: "scope:seeds", target: "scope:jobs", label: "Fuzz 输入", inferred: true },
  { source: "scope:jobs", target: "scope:crash", label: "崩溃产出", inferred: true },
  { source: "scope:jobs", target: "scope:debug", label: "Crash 调试", inferred: true },
  { source: "scope:jobs", target: "scope:reports", label: "任务报告", inferred: true },
  { source: "scope:reports", target: "scope:vulns", label: "漏洞归档", inferred: true },
  { source: "scope:vuldocs", target: "scope:kb", label: "文档蒸馏", inferred: true },
  { source: "scope:risk", target: "scope:instrumented", label: "插桩处理", inferred: true },
] as const;

const GRAPH_TEMPLATE_ORDER = GRAPH_TEMPLATE_NODES.map((item) => item.key);
const PRIMARY_GRAPH_NODE_KEYS = ["source", "specs", "risk", "seeds", "jobs"] as const;
const PRIMARY_RING_ANGLES: Record<(typeof PRIMARY_GRAPH_NODE_KEYS)[number], number> = {
  source: -152,
  specs: -84,
  risk: 150,
  seeds: 8,
  jobs: 84,
};
const SECONDARY_PARENT_KEYS: Record<string, string> = {
  vuldocs: "specs",
  kb: "vuldocs",
  instrumented: "risk",
  crash: "jobs",
  debug: "jobs",
  reports: "jobs",
  vulns: "reports",
};
const LINEAGE_COORDINATES: Record<string, { x: number; y: number }> = {
  protocol: { x: 120, y: 236 },
  source: { x: 360, y: 236 },
  specs: { x: 610, y: 100 },
  vuldocs: { x: 610, y: 182 },
  kb: { x: 610, y: 264 },
  risk: { x: 610, y: 382 },
  seeds: { x: 860, y: 154 },
  instrumented: { x: 860, y: 336 },
  jobs: { x: 1110, y: 236 },
  crash: { x: 1360, y: 108 },
  debug: { x: 1360, y: 236 },
  reports: { x: 1360, y: 364 },
  vulns: { x: 1600, y: 364 },
};
const GRAPH_STATUS_LABELS: Record<string, string> = {
  ready: "已就绪",
  available: "已有资产",
  empty: "待生成",
};
const GRAPH_NODE_SIZES: Record<AssetGraphNodeCategory, [number, number]> = {
  protocol: [150, 56],
  primary: [116, 44],
  secondary: [96, 36],
};

function stripQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, "").trim();
}

function uniqueValues<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function templateNodeForKey(key: string): TemplateGraphNode | undefined {
  return GRAPH_TEMPLATE_NODES.find((item) => item.key === key);
}

function compareGraphKeys(left: string, right: string): number {
  const leftIndex = GRAPH_TEMPLATE_ORDER.indexOf(left);
  const rightIndex = GRAPH_TEMPLATE_ORDER.indexOf(right);

  if (leftIndex >= 0 && rightIndex >= 0) return leftIndex - rightIndex;
  if (leftIndex >= 0) return -1;
  if (rightIndex >= 0) return 1;

  return left.localeCompare(right, "zh-CN", { sensitivity: "base" });
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function spreadAngles(count: number): number[] {
  if (count <= 1) return [0];

  const step = count === 2 ? 20 : 24;
  const start = -((count - 1) * step) / 2;
  return Array.from({ length: count }, (_, index) => start + (step * index));
}

function assetCountsFromSummary(summary?: ProtocolAssetSummary | null): Record<string, number> {
  return {
    source: Math.max(0, summary?.files_count ?? 0),
    specs: 0,
    vuldocs: 0,
    kb: 0,
    seeds: 0,
    risk: 0,
    instrumented: 0,
    jobs: 0,
    debug: 0,
    reports: 0,
    vulns: 0,
    crash: 0,
  };
}

function deriveNodeStatus(key: string, count: number, summary?: ProtocolAssetSummary | null): string {
  if (key === "source" && (summary?.ready || count > 0)) {
    return "ready";
  }
  return count > 0 ? "available" : "empty";
}

function deriveProtocolStatus(counts: Record<string, number>, summary?: ProtocolAssetSummary | null): string {
  if (summary?.ready || Object.values(counts).some((value) => value > 0)) {
    return "ready";
  }
  return "empty";
}

function buildTemplateEdges(protocol: string): ProtocolMindmapEdge[] {
  return GRAPH_TEMPLATE_EDGES.map((edge) => ({
    ...edge,
    source: edge.source.replace("__protocol__", protocol),
    target: edge.target.replace("__protocol__", protocol),
  }));
}

function buildFallbackMindmap(protocol: string, summary?: ProtocolAssetSummary | null): ProtocolMindmapResponse {
  const normalizedProtocol = normalizeProtocol(protocol);
  const counts = assetCountsFromSummary(summary);
  if (counts.vulns > 0 && counts.crash === 0) {
    counts.crash = counts.vulns;
  }

  const statuses: Record<string, string> = {};
  GRAPH_TEMPLATE_ORDER.forEach((key) => {
    statuses[key] = deriveNodeStatus(key, counts[key] ?? 0, summary);
  });

  return {
    protocol: normalizedProtocol,
    nodes: [
      {
        id: `protocol:${normalizedProtocol}`,
        name: normalizedProtocol,
        kind: "protocol",
        status: deriveProtocolStatus(counts, summary),
      },
      ...GRAPH_TEMPLATE_NODES.map((template) => ({
        id: `scope:${template.key}`,
        name: template.name,
        kind: template.kind,
        scope: template.scope,
        status: statuses[template.key],
        count: counts[template.key] ?? 0,
        workspace_ref: template.scope ? buildWorkspaceRef(normalizedProtocol, template.scope) : undefined,
      })),
    ],
    edges: buildTemplateEdges(normalizedProtocol),
    counts,
    statuses,
    recent_items: {
      reports: [],
      specs: [],
      seeds: [],
    },
  };
}

function edgeEndpointKey(value: string): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "";
  if (normalized.startsWith("protocol:")) return "protocol";
  if (normalized.startsWith("scope:")) return normalized.slice("scope:".length);
  return normalized;
}

function splitQueryTerms(value: string): string[] {
  return String(value ?? "")
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function semanticTypeForItem(item: Pick<WorkspaceTreeItem, "type" | "extension" | "virtual_path">): string {
  if (item.type === "directory") return "directory";

  const extension = String(item.extension ?? "").toLowerCase();
  if (extension === "json") return "json";
  if (["zip", "tar", "tgz", "gz", "bz2", "xz", "7z"].includes(extension)) return "archive";
  if (["db", "sqlite", "csv"].includes(extension)) return "data";
  if (["log", "txt", "md", "yaml", "yml", "xml", "json", "c", "cc", "cpp", "cxx", "h", "hh", "hpp", "hxx", "py", "js", "ts", "tsx", "java", "go", "rs", "dict"].includes(extension)) {
    return "text";
  }

  const virtualPath = String(item.virtual_path ?? "").toLowerCase();
  if (["crash", "hang", "asan", "ubsan", "poison"].some((keyword) => virtualPath.includes(keyword))) {
    return "bug";
  }

  return "file";
}

export function isAssetScope(value: string): value is AssetScope {
  return (ASSET_SCOPES as readonly string[]).includes(value);
}

export function getAssetScopeLabel(scope: string): string {
  return isAssetScope(scope) ? SCOPE_META[scope].label : scope || "未知";
}

export function getAssetScopeIcon(scope: string): LucideIcon {
  return isAssetScope(scope) ? SCOPE_META[scope].icon : FolderTree;
}

export function normalizeProtocol(protocol?: string | null): string {
  const normalized = String(protocol ?? "").trim();
  return normalized || "legacy-default";
}

export function normalizeVirtualPath(path?: string | null): string {
  const raw = String(path ?? "").trim();
  if (!raw) return "/";

  if (raw.includes("\0")) {
    throw new Error("Invalid virtual path");
  }

  const normalized = raw.replace(/\\/g, "/");
  const parts = normalized
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part !== ".");

  if (parts.some((part) => part === "..")) {
    throw new Error("Path traversal is not allowed");
  }

  return parts.length > 0 ? `/${parts.join("/")}` : "/";
}

export function normalizeVirtualPathOrRoot(path?: string | null): string {
  try {
    return normalizeVirtualPath(path);
  } catch {
    return "/";
  }
}

export function getParentVirtualPath(path?: string | null): string {
  const normalizedPath = normalizeVirtualPathOrRoot(path);
  if (normalizedPath === "/") return "/";

  const parts = normalizedPath.split("/").filter(Boolean);
  parts.pop();
  return parts.length > 0 ? `/${parts.join("/")}` : "/";
}

export function getVirtualPathSegments(path?: string | null): Array<{ label: string; path: string }> {
  const normalizedPath = normalizeVirtualPathOrRoot(path);
  const parts = normalizedPath.split("/").filter(Boolean);
  const segments = [{ label: "root", path: "/" }];

  let currentPath = "";
  for (const part of parts) {
    currentPath += `/${part}`;
    segments.push({ label: part, path: currentPath });
  }

  return segments;
}

export function buildWorkspaceRef(protocol: string, scope: string, virtualPath?: string): string {
  const normalizedProtocol = normalizeProtocol(protocol);
  const normalizedScope = String(scope).trim() || "source";

  if (!virtualPath || normalizeVirtualPath(virtualPath) === "/") {
    return `workspace://${normalizedProtocol}/${normalizedScope}/`;
  }

  return `workspace://${normalizedProtocol}/${normalizedScope}${normalizeVirtualPath(virtualPath)}`;
}

export function getWorkspaceItemRef(
  protocol: string,
  scope: string,
  item?: Pick<WorkspaceTreeItem, "workspace_ref" | "virtual_path"> | null,
): string {
  if (item?.workspace_ref && isWorkspaceRef(item.workspace_ref)) {
    return item.workspace_ref;
  }

  return buildWorkspaceRef(protocol, scope, item?.virtual_path);
}

export function isWorkspaceRef(value: string): boolean {
  return /^workspace:\/\/[^/]+\/[^/]+(?:\/.*)?$/.test(String(value ?? "").trim());
}

export async function safeCopyWorkspaceRef(ref: string): Promise<void> {
  if (!isWorkspaceRef(ref)) {
    throw new Error("Only workspace:// references can be copied");
  }

  if (!globalThis.navigator?.clipboard?.writeText) {
    throw new Error("Clipboard API is unavailable");
  }

  await globalThis.navigator.clipboard.writeText(ref);
}

export function formatBytes(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (value === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let nextValue = Math.abs(value);
  let unitIndex = 0;

  while (nextValue >= 1024 && unitIndex < units.length - 1) {
    nextValue /= 1024;
    unitIndex += 1;
  }

  const digits = nextValue >= 100 || unitIndex === 0 ? 0 : 1;
  const prefix = value < 0 ? "-" : "";
  return `${prefix}${nextValue.toFixed(digits)} ${units[unitIndex]}`;
}

export function formatUpdatedAt(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const timestamp = value > 1_000_000_000_000 ? value : value * 1000;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function shortenWorkspaceRef(value: string, maxLength = 56): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (text.length <= maxLength) return text;

  const headLength = Math.max(16, Math.floor((maxLength - 1) * 0.55));
  const tailLength = Math.max(10, maxLength - headLength - 1);
  return `${text.slice(0, headLength)}…${text.slice(-tailLength)}`;
}

export function sortWorkspaceItems<T extends Pick<WorkspaceTreeItem, "name" | "type">>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === "directory" ? -1 : 1;
    }

    return left.name.localeCompare(right.name, "zh-CN", { sensitivity: "base" });
  });
}

export function parseAssetQuery(query: string): ParsedAssetQuery {
  const tokens = String(query ?? "").match(/"[^"]+"|'[^']+'|\S+/g) ?? [];
  const freeTextTokens: string[] = [];
  const scope: AssetScope[] = [];
  const ext: string[] = [];
  const type: string[] = [];
  const path: string[] = [];
  const content: string[] = [];
  const job: string[] = [];

  for (const token of tokens) {
    const separatorIndex = token.indexOf(":");
    if (separatorIndex <= 0) {
      freeTextTokens.push(stripQuotes(token));
      continue;
    }

    const key = token.slice(0, separatorIndex).toLowerCase();
    const rawValue = stripQuotes(token.slice(separatorIndex + 1));
    if (!rawValue) continue;

    const values = rawValue
      .split(",")
      .map((item) => stripQuotes(item))
      .filter(Boolean);

    if (key === "scope") {
      values.forEach((value) => {
        if (isAssetScope(value)) scope.push(value);
      });
      continue;
    }

    if (key === "ext") {
      ext.push(...values.map((value) => value.replace(/^\./, "")));
      continue;
    }

    if (key === "type") {
      type.push(...values);
      continue;
    }

    if (key === "path") {
      path.push(...values);
      continue;
    }

    if (key === "content") {
      content.push(...values);
      continue;
    }

    if (key === "job") {
      job.push(...values);
      continue;
    }

    freeTextTokens.push(stripQuotes(token));
  }

  return {
    freeText: freeTextTokens.join(" ").trim(),
    scope: uniqueValues(scope),
    ext: uniqueValues(ext),
    type: uniqueValues(type),
    path: uniqueValues(path),
    content: uniqueValues(content),
    job: uniqueValues(job),
  };
}

export function buildAssetSearchRequest(query: string, contentEnabled: boolean, limit = 100): AssetSearchRequestState {
  const parsed = parseAssetQuery(query);
  const qTokens = [parsed.freeText, ...parsed.job.map((item) => `job:${item}`)].filter(Boolean).join(" ").trim();

  return {
    q: qTokens || undefined,
    scopes: parsed.scope.length > 0 ? parsed.scope : undefined,
    ext: parsed.ext[0] || undefined,
    type: parsed.type[0] || undefined,
    path: parsed.path[0] || undefined,
    content: contentEnabled || parsed.content.length > 0,
    limit,
  };
}

export function buildAssetIndexFilters(query: string, fallbackScope: AssetScope): AssetIndexFilterState {
  const parsed = parseAssetQuery(query);
  return {
    scopes: parsed.scope.length > 0 ? parsed.scope : [fallbackScope],
    ext: parsed.ext,
    type: parsed.type,
    path: parsed.path.map((item) => normalizeVirtualPathOrRoot(item)),
    sort: parsed.type.includes("directory") ? "scope" : "updated",
  };
}

export function sortIndexItems(items: WorkspaceIndexItem[], sort: AssetIndexSort): WorkspaceIndexItem[] {
  const nextItems = [...items];

  if (sort === "updated") {
    nextItems.sort((left, right) => {
      if (left.type !== right.type) {
        return left.type === "directory" ? -1 : 1;
      }
      return (right.updated_at ?? 0) - (left.updated_at ?? 0) || left.name.localeCompare(right.name, "zh-CN", { sensitivity: "base" });
    });
    return nextItems;
  }

  if (sort === "scope") {
    nextItems.sort((left, right) => {
      const leftScope = String(left.scope ?? "");
      const rightScope = String(right.scope ?? "");
      return leftScope.localeCompare(rightScope, "zh-CN", { sensitivity: "base" }) || left.name.localeCompare(right.name, "zh-CN", { sensitivity: "base" });
    });
    return nextItems;
  }

  nextItems.sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === "directory" ? -1 : 1;
    }
    return left.name.localeCompare(right.name, "zh-CN", { sensitivity: "base" });
  });
  return nextItems;
}

export function filterIndexItems(items: WorkspaceIndexItem[], filters: AssetIndexFilterState): WorkspaceIndexItem[] {
  return items.filter((item) => {
    const scope = String(item.scope ?? "").trim();
    const extension = String(item.extension ?? "").trim().toLowerCase();
    const itemType = semanticTypeForItem(item);
    const normalizedPath = normalizeVirtualPathOrRoot(item.virtual_path);

    if (filters.scopes.length > 0 && !filters.scopes.includes(scope as AssetScope)) {
      return false;
    }

    if (filters.ext.length > 0 && !filters.ext.includes(extension)) {
      return false;
    }

    if (filters.type.length > 0 && !filters.type.includes(itemType) && !filters.type.includes(item.type)) {
      return false;
    }

    if (filters.path.length > 0 && !filters.path.every((term) => normalizedPath.includes(term.replace(/^\/+/, "/")))) {
      return false;
    }

    return true;
  });
}

export function buildIndexFilterSummary(filters: AssetIndexFilterState): string {
  const parts: string[] = [];
  if (filters.scopes.length > 0) parts.push(`scope:${filters.scopes.join(",")}`);
  if (filters.ext.length > 0) parts.push(`ext:${filters.ext.join(",")}`);
  if (filters.type.length > 0) parts.push(`type:${filters.type.join(",")}`);
  if (filters.path.length > 0) parts.push(`path:${filters.path.join(",")}`);
  parts.push(`sort:${filters.sort}`);
  return parts.join(" · ");
}

export function collectAssetPathSuggestions(items: Array<Pick<WorkspaceTreeItem, "virtual_path">>, limit = 8): string[] {
  const seen = new Set<string>();

  for (const item of items) {
    const normalized = normalizeVirtualPathOrRoot(item.virtual_path);
    if (normalized === "/") continue;
    const segments = normalized.split("/").filter(Boolean);
    let currentPath = "";
    for (const segment of segments) {
      currentPath += `/${segment}`;
      if (!seen.has(currentPath)) {
        seen.add(currentPath);
      }
      if (seen.size >= limit) {
        return Array.from(seen);
      }
    }
  }

  return Array.from(seen);
}

export function buildAssetQuerySuggestions(
  query: string,
  pathSuggestions: string[] = [],
): AssetQuerySuggestion[] {
  const trimmed = query.trim();
  const tokens = trimmed ? trimmed.split(/\s+/) : [];
  const activeToken = tokens[tokens.length - 1] ?? "";
  const separatorIndex = activeToken.indexOf(":");
  const key = separatorIndex > 0 ? activeToken.slice(0, separatorIndex).toLowerCase() : "";
  const value = separatorIndex > 0 ? activeToken.slice(separatorIndex + 1).toLowerCase() : activeToken.toLowerCase();

  if (!trimmed) {
    return ASSET_QUERY_EXAMPLES.map((example) => ({
      id: `example:${example}`,
      label: example,
      insertValue: example,
      description: "示例查询",
      kind: "example",
    }));
  }

  const insertWithPrefix = (replacement: string): string => {
    const base = tokens.slice(0, -1).join(" ");
    return [base, replacement].filter(Boolean).join(" ").trim();
  };

  if (key === "scope") {
    return ASSET_QUERY_SCOPE_SUGGESTIONS
      .filter((item) => item.includes(value))
      .map((item) => ({
        id: `scope:${item}`,
        label: `scope:${item}`,
        insertValue: insertWithPrefix(`scope:${item}`),
        description: getAssetScopeLabel(item),
        kind: "scope",
      }));
  }

  if (key === "ext") {
    return ASSET_QUERY_EXT_SUGGESTIONS
      .filter((item) => item.includes(value))
      .map((item) => ({
        id: `ext:${item}`,
        label: `ext:${item}`,
        insertValue: insertWithPrefix(`ext:${item}`),
        description: "扩展名过滤",
        kind: "ext",
      }));
  }

  if (key === "type") {
    return ASSET_QUERY_TYPE_SUGGESTIONS
      .filter((item) => item.includes(value))
      .map((item) => ({
        id: `type:${item}`,
        label: `type:${item}`,
        insertValue: insertWithPrefix(`type:${item}`),
        description: "类型过滤",
        kind: "type",
      }));
  }

  if (key === "path") {
    return pathSuggestions
      .filter((item) => item.toLowerCase().includes(value))
      .map((item) => ({
        id: `path:${item}`,
        label: `path:${item.replace(/^\//, "")}`,
        insertValue: insertWithPrefix(`path:${item.replace(/^\//, "")}`),
        description: "路径前缀建议",
        kind: "path",
      }));
  }

  if (key === "content") {
    return [
      {
        id: "content:hint",
        label: activeToken || "content:keyword",
        insertValue: trimmed,
        description: "内容搜索会受后端字节数和文件数限制",
        kind: "content",
      },
    ];
  }

  const sharedSuggestions: AssetQuerySuggestion[] = [
    {
      id: "scope:source",
      label: "scope:source",
      insertValue: insertWithPrefix("scope:source"),
      description: "按源码范围过滤",
      kind: "scope",
    },
    {
      id: "ext:c",
      label: "ext:c",
      insertValue: insertWithPrefix("ext:c"),
      description: "按扩展名过滤",
      kind: "ext",
    },
    {
      id: "type:json",
      label: "type:json",
      insertValue: insertWithPrefix("type:json"),
      description: "按语义类型过滤",
      kind: "type",
    },
    {
      id: "path:src",
      label: "path:src",
      insertValue: insertWithPrefix("path:src"),
      description: "按路径前缀过滤",
      kind: "path",
    },
    {
      id: "content:Modbus",
      label: "content:keyword",
      insertValue: insertWithPrefix("content:"),
      description: "内容搜索默认关闭，只有写 content: 才会启用",
      kind: "content",
    },
  ];

  const matchedShared = sharedSuggestions.filter((item) => item.label.toLowerCase().includes(value));
  const matchedPaths = pathSuggestions
    .filter((item) => item.toLowerCase().includes(value))
    .map((item) => ({
      id: `path:${item}`,
      label: `path:${item.replace(/^\//, "")}`,
      insertValue: insertWithPrefix(`path:${item.replace(/^\//, "")}`),
      description: "路径前缀建议",
      kind: "path" as const,
    }));

  return [...matchedShared, ...matchedPaths].slice(0, 8);
}

export function workspaceItemFromSearchMatch(match: WorkspaceSearchMatch): WorkspaceTreeItem {
  return {
    ...match.item,
    name: match.item.name,
    type: match.item.type,
    virtual_path: normalizeVirtualPathOrRoot(match.item.virtual_path),
    size: match.item.size ?? null,
    updated_at: match.item.updated_at ?? 0,
    scope: match.item.scope,
    protocol: match.item.protocol,
    workspace_ref: match.item.workspace_ref,
    extension: match.item.extension,
    previewable: match.item.previewable,
    downloadable: match.item.downloadable,
    depth: match.item.depth,
  };
}

export function workspaceItemFromIndexItem(item: WorkspaceIndexItem): WorkspaceTreeItem {
  return {
    ...item,
    name: item.name,
    type: item.type,
    virtual_path: normalizeVirtualPathOrRoot(item.virtual_path),
    size: item.size ?? null,
    updated_at: item.updated_at ?? 0,
    scope: item.scope,
    protocol: item.protocol,
    workspace_ref: item.workspace_ref,
    extension: item.extension,
    previewable: item.previewable,
    downloadable: item.downloadable,
    depth: item.depth,
  };
}

export function getWorkspaceItemIcon(item: Pick<WorkspaceTreeItem, "type" | "extension">): LucideIcon {
  if (item.type === "directory") return Folder;

  const extension = String(item.extension ?? "").toLowerCase();
  if (["c", "cc", "cpp", "cxx", "h", "hh", "hpp", "hxx", "py", "js", "ts", "tsx", "go", "rs", "java"].includes(extension)) {
    return FileCode2;
  }
  if (["json", "yaml", "yml", "xml", "md", "txt", "log"].includes(extension)) {
    return FileText;
  }
  return File;
}

export function getProtocolMindmapNodeKey(node: Pick<ProtocolMindmapNode, "id" | "kind" | "scope">): string {
  if (node.kind === "protocol") return "protocol";
  const id = String(node.id ?? "").trim();
  if (id.startsWith("scope:")) return id.slice("scope:".length);
  if (id.startsWith("protocol:")) return "protocol";
  const scope = String(node.scope ?? "").trim();
  if (scope) return scope;
  return id || "unknown";
}

export function getAssetGraphCategory(node: Pick<ProtocolMindmapNode, "kind">): AssetGraphNodeCategory {
  if (node.kind === "protocol") return "protocol";
  if (node.kind === "primary") return "primary";
  return "secondary";
}

export function getAssetGraphNodeSize(category: AssetGraphNodeCategory): [number, number] {
  return GRAPH_NODE_SIZES[category];
}

export function getAssetGraphStatusLabel(status?: string): string {
  const normalized = String(status ?? "").trim().toLowerCase();
  return GRAPH_STATUS_LABELS[normalized] ?? (normalized || "未知状态");
}

export function getAssetGraphNavigateTab(scope?: string | null): AssetNavigateTab {
  const normalized = String(scope ?? "").trim();
  return normalized === "jobs" || normalized === "history" ? "index" : "files";
}

export function readCssHsl(name: string, alpha?: number, fallback = "215 16% 47%"): string {
  if (typeof document === "undefined") {
    return alpha === undefined ? `hsl(${fallback})` : `hsl(${fallback} / ${alpha})`;
  }

  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  return alpha === undefined ? `hsl(${raw})` : `hsl(${raw} / ${alpha})`;
}

export function buildProtocolMindmapModel(
  protocol: string,
  response?: ProtocolMindmapResponse | null,
  summary?: ProtocolAssetSummary | null,
): AssetGraphModel {
  const normalizedProtocol = normalizeProtocol(protocol);
  const fallback = buildFallbackMindmap(normalizedProtocol, summary);
  const templateEdges = buildTemplateEdges(normalizedProtocol);
  const actualNodes = response?.nodes ?? [];
  const actualEdges = response?.edges ?? [];
  const extraKeys: string[] = [];
  const actualNodesByKey = new Map<string, ProtocolMindmapNode>();

  actualNodes.forEach((node) => {
    const key = getProtocolMindmapNodeKey(node);
    if (!actualNodesByKey.has(key) && key !== "protocol" && !GRAPH_TEMPLATE_ORDER.includes(key)) {
      extraKeys.push(key);
    }
    actualNodesByKey.set(key, node);
  });

  const counts: Record<string, number> = {
    ...fallback.counts,
    ...(response?.counts ?? {}),
  };
  if ((counts.source ?? 0) === 0 && summary?.files_count) {
    counts.source = Math.max(0, summary.files_count);
  }
  if ((counts.crash ?? 0) === 0 && (counts.vulns ?? 0) > 0) {
    counts.crash = counts.vulns;
  }

  const statuses: Record<string, string> = {
    ...fallback.statuses,
    ...(response?.statuses ?? {}),
  };

  const orderedKeys = ["protocol", ...GRAPH_TEMPLATE_ORDER, ...extraKeys];
  const nodes: ProtocolMindmapNode[] = orderedKeys.map((key) => {
    if (key === "protocol") {
      const actual = actualNodesByKey.get("protocol");
      return {
        id: actual?.id ?? `protocol:${normalizedProtocol}`,
        name: String(actual?.name ?? normalizedProtocol).trim() || normalizedProtocol,
        kind: "protocol",
        status: String(actual?.status ?? deriveProtocolStatus(counts, summary)).trim() || deriveProtocolStatus(counts, summary),
      };
    }

    const actual = actualNodesByKey.get(key);
    const template = templateNodeForKey(key);
    const scope = String(actual?.scope ?? template?.scope ?? "").trim() || undefined;
    const count = typeof actual?.count === "number" ? actual.count : counts[key] ?? 0;
    const status = String(actual?.status ?? statuses[key] ?? deriveNodeStatus(key, count, summary)).trim() || deriveNodeStatus(key, count, summary);
    const workspaceRef = String(actual?.workspace_ref ?? "").trim() || (scope ? buildWorkspaceRef(normalizedProtocol, scope) : undefined);

    counts[key] = count;
    statuses[key] = status;

    return {
      id: actual?.id ?? `scope:${key}`,
      name: String(actual?.name ?? template?.name ?? key).trim() || key,
      kind: actual?.kind ?? template?.kind ?? "secondary",
      scope,
      status,
      count,
      workspace_ref: workspaceRef,
    };
  });

  const nodesByKey = new Map(nodes.map((node) => [getProtocolMindmapNodeKey(node), node] as const));
  const seenEdges = new Set<string>();
  const edges: ProtocolMindmapEdge[] = [];

  [...actualEdges, ...templateEdges].forEach((edge) => {
    const sourceKey = edgeEndpointKey(edge.source);
    const targetKey = edgeEndpointKey(edge.target);
    const sourceNode = nodesByKey.get(sourceKey);
    const targetNode = nodesByKey.get(targetKey);
    if (!sourceNode || !targetNode) return;

    const signature = `${sourceNode.id}>${targetNode.id}`;
    if (seenEdges.has(signature)) return;
    seenEdges.add(signature);
    edges.push({
      source: sourceNode.id,
      target: targetNode.id,
      label: edge.label,
      inferred: edge.inferred,
    });
  });

  const empty = !Object.values(counts).some((value) => Number(value) > 0);
  const protocolNode = nodesByKey.get("protocol");
  if (protocolNode) {
    protocolNode.status = protocolNode.status || deriveProtocolStatus(counts, summary);
  }

  return {
    protocol: normalizedProtocol,
    nodes,
    edges,
    counts,
    statuses,
    recent_items: {
      reports: response?.recent_items?.reports ?? [],
      specs: response?.recent_items?.specs ?? [],
      seeds: response?.recent_items?.seeds ?? [],
    },
    synthetic: actualNodes.length === 0,
    empty,
  };
}

export function buildOverviewMindmapLayout(model: AssetGraphModel): AssetGraphLayout {
  const nodesByKey = new Map(model.nodes.map((node) => [getProtocolMindmapNodeKey(node), node] as const));
  const positions = new Map<string, { x: number; y: number }>();
  positions.set("protocol", { x: 0, y: 0 });

  PRIMARY_GRAPH_NODE_KEYS.forEach((key) => {
    if (!nodesByKey.has(key)) return;
    const angle = degreesToRadians(PRIMARY_RING_ANGLES[key]);
    positions.set(key, {
      x: Math.cos(angle) * 196,
      y: Math.sin(angle) * 164,
    });
  });

  const incomingParents = new Map<string, string>();
  model.edges.forEach((edge) => {
    const sourceKey = edgeEndpointKey(edge.source);
    const targetKey = edgeEndpointKey(edge.target);
    if (!sourceKey || !targetKey || sourceKey === targetKey) return;
    if (!incomingParents.has(targetKey)) {
      incomingParents.set(targetKey, sourceKey);
    }
  });

  const childrenByParent = new Map<string, string[]>();
  nodesByKey.forEach((_node, key) => {
    if (key === "protocol" || PRIMARY_GRAPH_NODE_KEYS.includes(key as (typeof PRIMARY_GRAPH_NODE_KEYS)[number])) {
      return;
    }

    const parentKey = nodesByKey.has(SECONDARY_PARENT_KEYS[key] ?? "")
      ? SECONDARY_PARENT_KEYS[key]
      : (incomingParents.get(key) ?? "protocol");

    const bucket = childrenByParent.get(parentKey) ?? [];
    bucket.push(key);
    childrenByParent.set(parentKey, bucket);
  });

  const placeBranch = (parentKey: string, depth: number): void => {
    const parentPosition = positions.get(parentKey);
    if (!parentPosition) return;

    const childKeys = [...(childrenByParent.get(parentKey) ?? [])].sort(compareGraphKeys);
    if (childKeys.length === 0) return;

    const baseAngle = parentKey === "protocol" ? 0 : Math.atan2(parentPosition.y, parentPosition.x);
    const angleOffsets = spreadAngles(childKeys.length);
    const distance = depth === 0 ? 126 : 98;

    childKeys.forEach((key, index) => {
      if (positions.has(key)) return;

      const angle = baseAngle + degreesToRadians(angleOffsets[index]);
      positions.set(key, {
        x: parentPosition.x + (Math.cos(angle) * distance),
        y: parentPosition.y + (Math.sin(angle) * distance * 0.82),
      });
      placeBranch(key, depth + 1);
    });
  };

  PRIMARY_GRAPH_NODE_KEYS.forEach((key) => placeBranch(key, 0));
  placeBranch("protocol", 0);

  const unplacedKeys = [...nodesByKey.keys()].filter((key) => !positions.has(key));
  unplacedKeys.sort(compareGraphKeys).forEach((key, index) => {
    const angle = degreesToRadians(-36 + (index * 18));
    positions.set(key, {
      x: Math.cos(angle) * 248,
      y: Math.sin(angle) * 188,
    });
  });

  return {
    nodes: model.nodes.map((node) => {
      const graphKey = getProtocolMindmapNodeKey(node);
      const position = positions.get(graphKey) ?? { x: 0, y: 0 };
      const category = getAssetGraphCategory(node);

      return {
        ...node,
        graphKey,
        category,
        x: position.x,
        y: position.y,
        symbolSize: getAssetGraphNodeSize(category),
      };
    }),
    edges: model.edges,
  };
}

export function buildLineageGraphLayout(model: AssetGraphModel): AssetGraphLayout {
  const nodesByKey = new Map(model.nodes.map((node) => [getProtocolMindmapNodeKey(node), node] as const));
  const positions = new Map<string, { x: number; y: number }>();

  Object.entries(LINEAGE_COORDINATES).forEach(([key, value]) => {
    if (nodesByKey.has(key)) {
      positions.set(key, value);
    }
  });

  const extraKeys = [...nodesByKey.keys()].filter((key) => !positions.has(key));
  extraKeys.sort(compareGraphKeys).forEach((key, index) => {
    positions.set(key, {
      x: 1840,
      y: 104 + (index * 84),
    });
  });

  return {
    nodes: model.nodes.map((node) => {
      const graphKey = getProtocolMindmapNodeKey(node);
      const position = positions.get(graphKey) ?? { x: 1840, y: 104 };
      const category = getAssetGraphCategory(node);

      return {
        ...node,
        graphKey,
        category,
        x: position.x,
        y: position.y,
        symbolSize: getAssetGraphNodeSize(category),
      };
    }),
    edges: model.edges,
  };
}

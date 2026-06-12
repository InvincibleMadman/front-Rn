export interface AssetGraphNode {
  id: string;
  name: string;
  category?: string;
}

export interface AssetGraphEdge {
  source: string;
  target: string;
}

export interface AssetsOverviewGraphResponse {
  nodes: AssetGraphNode[];
  edges: AssetGraphEdge[];
  protocol_count: number;
}

export interface AssetListItem {
  protocol: string;
  workspace_ref: string;
  scope?: string;
  kind?: string;
  name?: string;
  virtual_path?: string;
  size?: number | null;
  updated_at?: number;
  type?: "directory" | "file";
}

export interface ProtocolAssetSummary {
  protocol: string;
  source_ref: string;
  files_count: number;
  ready: boolean;
}

export interface WorkspaceTreeItem {
  name: string;
  type: "directory" | "file";
  virtual_path: string;
  size: number | null;
  updated_at: number;
  protocol?: string;
  scope?: string;
  workspace_ref?: string;
  previewable?: boolean;
  downloadable?: boolean;
  depth?: number;
  extension?: string;
}

export interface WorkspaceTreeResponse {
  protocol: string;
  scope: string;
  path: string;
  items: WorkspaceTreeItem[];
}

export interface WorkspaceIndexItem extends WorkspaceTreeItem {}

export interface WorkspaceIndexParams {
  scopes?: string[];
  max_depth?: number;
  limit?: number;
  cursor?: string;
  include_dirs?: boolean;
  include_counts?: boolean;
}

export interface WorkspaceIndexResponse {
  protocol: string;
  items: WorkspaceIndexItem[];
  next_cursor: string | null;
  counts_by_scope: Record<string, number>;
  truncated: boolean;
  scanned_count: number;
  limited_by_max_depth: boolean;
  limited_by_max_items: boolean;
}

export interface WorkspacePreviewResponse {
  preview_type: "text" | "json" | "hex";
  truncated?: boolean;
  content?: string;
  size: number;
  hex?: string;
  ascii?: string;
}

export interface WorkspaceSearchSnippet {
  line: number;
  text: string;
}

export interface WorkspaceSearchMatch {
  item: WorkspaceIndexItem;
  score: number;
  reason: string;
  snippets?: WorkspaceSearchSnippet[];
}

export interface WorkspaceSearchParams {
  q?: string;
  scopes?: string[];
  ext?: string;
  type?: string;
  path?: string;
  content?: boolean;
  limit?: number;
  cursor?: string;
}

export interface WorkspaceSearchResponse {
  protocol: string;
  items: WorkspaceSearchMatch[];
  next_cursor: string | null;
  truncated: boolean;
  scanned_count: number;
  content_limited: boolean;
  limited_by_max_depth: boolean;
  limited_by_max_items: boolean;
}

export interface ProtocolMindmapNode {
  id: string;
  name: string;
  kind: string;
  status: string;
  scope?: string;
  count?: number;
  workspace_ref?: string;
}

export interface ProtocolMindmapEdge {
  source: string;
  target: string;
  label?: string;
  inferred?: boolean;
}

export interface ProtocolMindmapRecentItem {
  name: string;
  workspace_ref: string;
}

export interface ProtocolMindmapResponse {
  protocol: string;
  nodes: ProtocolMindmapNode[];
  edges: ProtocolMindmapEdge[];
  counts: Record<string, number>;
  statuses: Record<string, string>;
  recent_items: Record<string, ProtocolMindmapRecentItem[]>;
}

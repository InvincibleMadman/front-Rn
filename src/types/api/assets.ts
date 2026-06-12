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
  previewable?: boolean;
  downloadable?: boolean;
}

export interface WorkspaceTreeResponse {
  protocol: string;
  scope: string;
  path: string;
  items: WorkspaceTreeItem[];
}

export interface WorkspacePreviewResponse {
  preview_type: "text" | "json" | "hex";
  truncated?: boolean;
  content?: string;
  size: number;
  hex?: string;
  ascii?: string;
}

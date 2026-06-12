export interface ApiNode {
  id: string;
  name: string;
  baseUrl: string;
  description?: string;
  enabled?: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  secretConfigured?: boolean;
  readonly?: boolean;
}

export interface FuzzNodesConfig {
  defaultNodeId?: string;
  nodes: ApiNode[];
}

export interface NodePingResult {
  ok: boolean;
  baseUrl?: string;
  latencyMs?: number;
  endpoint?: "/api/v1/system/info" | "/api/v1/config";
  data?: unknown;
}

import { apiClient } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";
import { useUiStore } from "@/stores/ui-store";
import type { ApiNode, NodePingResult } from "@/types/api/nodes";

interface NodeRecordResponse {
  node_id: string;
  name: string;
  base_url: string;
  description?: string;
  enabled: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  secret_configured: boolean;
}

function csrfHeaders(): HeadersInit {
  const csrfToken = useAuthStore.getState().csrfToken;
  return csrfToken ? { "X-CSRF-Token": csrfToken } : {};
}

function mapNode(node: NodeRecordResponse): ApiNode {
  return {
    id: node.node_id,
    name: node.name,
    baseUrl: node.base_url,
    description: node.description,
    enabled: node.enabled,
    createdBy: node.created_by,
    createdAt: node.created_at,
    updatedAt: node.updated_at,
    secretConfigured: node.secret_configured,
  };
}

export const nodesApi = {
  async loadAllNodes(): Promise<{ defaultNodeId: string; nodes: ApiNode[] }> {
    const response = await apiClient.requestEnvelope<{ items: NodeRecordResponse[] }>("/web-api/nodes", {
      credentials: "include",
    });
    const nodes = response.data.items.map(mapNode);
    useUiStore.getState().setApiNodes(nodes);
    const selectedId = useUiStore.getState().selectedApiNodeId || nodes[0]?.id || "local";
    const selected = nodes.find((node) => node.id === selectedId) ?? nodes[0];
    if (selected) useUiStore.getState().setSelectedApiNode(selected);
    return { defaultNodeId: selected?.id ?? "local", nodes };
  },

  async createNode(node: { id: string; name: string; baseUrl: string; description?: string; enabled?: boolean; nodeSecret: string }): Promise<ApiNode> {
    const response = await apiClient.requestEnvelope<{ node: NodeRecordResponse }>("/web-api/nodes", {
      method: "POST",
      credentials: "include",
      headers: csrfHeaders(),
      body: JSON.stringify({
        node_id: node.id,
        name: node.name,
        base_url: node.baseUrl,
        description: node.description ?? "",
        enabled: node.enabled ?? true,
        node_secret: node.nodeSecret,
      }),
    });
    return mapNode(response.data.node);
  },

  async updateNode(nodeId: string, patch: Partial<{ name: string; baseUrl: string; description: string; enabled: boolean; nodeSecret: string }>): Promise<ApiNode> {
    const response = await apiClient.requestEnvelope<{ node: NodeRecordResponse }>(`/web-api/nodes/${encodeURIComponent(nodeId)}`, {
      method: "PATCH",
      credentials: "include",
      headers: csrfHeaders(),
      body: JSON.stringify({
        name: patch.name,
        base_url: patch.baseUrl,
        description: patch.description,
        enabled: patch.enabled,
        node_secret: patch.nodeSecret,
      }),
    });
    return mapNode(response.data.node);
  },

  async deleteNode(nodeId: string): Promise<void> {
    await apiClient.requestEnvelope<null>(`/web-api/nodes/${encodeURIComponent(nodeId)}`, {
      method: "DELETE",
      credentials: "include",
      headers: csrfHeaders(),
    });
  },

  selectNode(node: ApiNode): void {
    useUiStore.getState().setSelectedApiNode(node);
  },

  getSelectedNodeId(): string | null {
    return useUiStore.getState().selectedApiNodeId;
  },

  async pingNode(node: ApiNode): Promise<NodePingResult> {
    const response = await apiClient.requestEnvelope<{ status: string; response?: unknown }>(`/web-api/nodes/${encodeURIComponent(node.id)}/ping`, {
      method: "POST",
      credentials: "include",
      headers: csrfHeaders(),
    });
    return { ok: response.data.status === "online", data: response.data.response };
  },
};

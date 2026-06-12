import { apiClient } from "@/lib/api/client";
import { resolveApiUrl } from "@/lib/api/url";
import { useAuthStore } from "@/stores/auth-store";
import { useUiStore } from "@/stores/ui-store";
import type {
  AssetListItem,
  AssetsOverviewGraphResponse,
  ProtocolAssetSummary,
  WorkspacePreviewResponse,
  WorkspaceTreeResponse,
} from "@/types/api/assets";

function selectedNodeId(): string {
  return useUiStore.getState().selectedApiNodeId || "local";
}

function nodeApiPath(path: string): string {
  return `/node-api/${encodeURIComponent(selectedNodeId())}/api/v1${path}`;
}

function csrfHeaders(): HeadersInit {
  const csrfToken = useAuthStore.getState().csrfToken;
  return csrfToken ? { "X-CSRF-Token": csrfToken } : {};
}

export const assetsApi = {
  async getOverviewGraph(): Promise<AssetsOverviewGraphResponse> {
    const response = await apiClient.requestEnvelope<AssetsOverviewGraphResponse>(nodeApiPath("/assets/overview-graph"), {
      credentials: "include",
    });
    return response.data;
  },

  async listAssets(params?: { keyword?: string; scope?: string; kind?: string; protocol?: string }): Promise<AssetListItem[]> {
    const query = new URLSearchParams();
    Object.entries(params ?? {}).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });
    const suffix = query.toString() ? `?${query.toString()}` : "";
    const response = await apiClient.requestEnvelope<{ items: AssetListItem[] }>(nodeApiPath(`/assets${suffix}`), {
      credentials: "include",
    });
    return response.data.items;
  },

  async getProtocolAssets(protocol: string): Promise<ProtocolAssetSummary[]> {
    const response = await apiClient.requestEnvelope<{ items: ProtocolAssetSummary[] }>(nodeApiPath(`/protocols/${encodeURIComponent(protocol)}/assets`), {
      credentials: "include",
    });
    return response.data.items;
  },

  async getProtocolAssetsSummary(protocol: string): Promise<ProtocolAssetSummary> {
    const response = await apiClient.requestEnvelope<ProtocolAssetSummary>(nodeApiPath(`/protocols/${encodeURIComponent(protocol)}/assets/summary`), {
      credentials: "include",
    });
    return response.data;
  },

  async getWorkspaceTree(protocol: string, scope: string, path = "/"): Promise<WorkspaceTreeResponse> {
    const response = await apiClient.requestEnvelope<WorkspaceTreeResponse>(
      `${nodeApiPath(`/protocols/${encodeURIComponent(protocol)}/workspace/tree`)}?scope=${encodeURIComponent(scope)}&path=${encodeURIComponent(path)}`,
      { credentials: "include" },
    );
    return response.data;
  },

  async getWorkspacePreview(protocol: string, scope: string, path: string): Promise<WorkspacePreviewResponse> {
    const response = await apiClient.requestEnvelope<WorkspacePreviewResponse>(
      `${nodeApiPath(`/protocols/${encodeURIComponent(protocol)}/workspace/preview`)}?scope=${encodeURIComponent(scope)}&path=${encodeURIComponent(path)}`,
      { credentials: "include" },
    );
    return response.data;
  },

  getWorkspaceDownloadUrl(protocol: string, scope: string, path: string): string {
    return resolveApiUrl(`${nodeApiPath(`/protocols/${encodeURIComponent(protocol)}/workspace/download`)}?scope=${encodeURIComponent(scope)}&path=${encodeURIComponent(path)}`);
  },

  async uploadArchive(protocol: string, file: File, replaceExisting: boolean): Promise<ProtocolAssetSummary> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("replace_existing", String(replaceExisting));
    const response = await apiClient.requestEnvelope<ProtocolAssetSummary>(nodeApiPath(`/protocols/${encodeURIComponent(protocol)}/source/upload-archive`), {
      method: "POST",
      credentials: "include",
      headers: csrfHeaders(),
      body: formData,
    });
    return response.data;
  },

  async importGit(protocol: string, repoUrl: string, branch: string, replaceExisting: boolean): Promise<ProtocolAssetSummary> {
    const response = await apiClient.requestEnvelope<ProtocolAssetSummary>(nodeApiPath(`/protocols/${encodeURIComponent(protocol)}/source/import-git`), {
      method: "POST",
      credentials: "include",
      headers: csrfHeaders(),
      body: JSON.stringify({ repo_url: repoUrl, branch, replace_existing: replaceExisting }),
    });
    return response.data;
  },

  async getSourceStatus(protocol: string): Promise<ProtocolAssetSummary> {
    const response = await apiClient.requestEnvelope<ProtocolAssetSummary>(nodeApiPath(`/protocols/${encodeURIComponent(protocol)}/source/status`), {
      credentials: "include",
    });
    return response.data;
  },

  async deleteProtocol(protocol: string): Promise<void> {
    await apiClient.requestEnvelope<unknown>(nodeApiPath(`/protocols/${encodeURIComponent(protocol)}`), {
      method: "DELETE",
      credentials: "include",
      headers: csrfHeaders(),
    });
  },
};

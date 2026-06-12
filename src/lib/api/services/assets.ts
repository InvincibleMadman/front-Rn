import { apiClient } from "@/lib/api/client";
import { resolveApiUrl } from "@/lib/api/url";
import { useAuthStore } from "@/stores/auth-store";
import { useUiStore } from "@/stores/ui-store";
import type {
  AssetListItem,
  AssetsOverviewGraphResponse,
  ProtocolAssetSummary,
  ProtocolMindmapResponse,
  WorkspaceIndexParams,
  WorkspaceIndexResponse,
  WorkspacePreviewResponse,
  WorkspaceSearchParams,
  WorkspaceSearchResponse,
  WorkspaceTreeResponse,
} from "@/types/api/assets";

type ProtocolListEnvelopeData = string[] | { protocols?: unknown[]; items?: unknown[]; documents?: unknown[] };
type WorkspaceItemLike = {
  protocol?: string;
  scope?: string;
  workspace_ref?: string;
  virtual_path?: string;
};

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function arrayFromField(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function normalizeProtocolList(data: ProtocolListEnvelopeData): string[] {
  const record = isRecord(data) ? data : undefined;
  const raw = Array.isArray(data)
    ? data
    : record
      ? arrayFromField(record.protocols) ?? arrayFromField(record.items) ?? arrayFromField(record.documents) ?? []
      : [];

  return raw
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (isRecord(item)) return String(item.protocol ?? item.name ?? item.id ?? "").trim();
      return "";
    })
    .filter(Boolean);
}

function queryString(params: Record<string, boolean | number | string | Array<boolean | number | string> | null | undefined>): string {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value == null) return;

    if (Array.isArray(value)) {
      if (value.length === 0) return;
      query.set(key, value.map((item) => String(item)).join(","));
      return;
    }

    query.set(key, String(value));
  });

  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

function parseWorkspaceRef(value?: string): { protocol?: string; scope?: string; virtualPath?: string } | null {
  const ref = String(value ?? "").trim();
  const match = /^workspace:\/\/([^/]+)\/([^/]+)(\/.*)?$/.exec(ref);
  if (!match) return null;

  return {
    protocol: match[1],
    scope: match[2],
    virtualPath: match[3] || "/",
  };
}

function normalizeWorkspaceItem<T extends WorkspaceItemLike>(item: T, fallbackProtocol: string, fallbackScope?: string): T {
  const refParts = parseWorkspaceRef(item.workspace_ref);

  return {
    ...item,
    protocol: item.protocol ?? refParts?.protocol ?? fallbackProtocol,
    scope: item.scope ?? refParts?.scope ?? fallbackScope,
    virtual_path: item.virtual_path ?? refParts?.virtualPath ?? "/",
  };
}

function normalizeWorkspaceItems<T extends WorkspaceItemLike>(items: T[] | undefined, fallbackProtocol: string, fallbackScope?: string): T[] {
  return (items ?? []).map((item) => normalizeWorkspaceItem(item, fallbackProtocol, fallbackScope));
}

export const assetsApi = {
  async getOverviewGraph(): Promise<AssetsOverviewGraphResponse> {
    const response = await apiClient.requestEnvelope<AssetsOverviewGraphResponse>(nodeApiPath("/assets/overview-graph"), {
      credentials: "include",
    });
    return response.data;
  },

  async listProtocols(): Promise<string[]> {
    const response = await apiClient.requestEnvelope<ProtocolListEnvelopeData>(nodeApiPath("/protocols"), {
      credentials: "include",
    });
    return normalizeProtocolList(response.data);
  },

  async listAssets(params?: { keyword?: string; scope?: string; kind?: string; protocol?: string }): Promise<AssetListItem[]> {
    const suffix = queryString(params ?? {});
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

  async getProtocolMindmap(protocol: string): Promise<ProtocolMindmapResponse> {
    const response = await apiClient.requestEnvelope<ProtocolMindmapResponse>(nodeApiPath(`/protocols/${encodeURIComponent(protocol)}/assets/mindmap`), {
      credentials: "include",
    });
    return response.data;
  },

  async getWorkspaceTree(protocol: string, scope: string, path = "/"): Promise<WorkspaceTreeResponse> {
    const response = await apiClient.requestEnvelope<WorkspaceTreeResponse>(
      `${nodeApiPath(`/protocols/${encodeURIComponent(protocol)}/workspace/tree`)}${queryString({ scope, path })}`,
      { credentials: "include" },
    );
    return {
      ...response.data,
      items: normalizeWorkspaceItems(response.data.items, protocol, scope),
    };
  },

  async getWorkspaceIndex(protocol: string, params?: WorkspaceIndexParams): Promise<WorkspaceIndexResponse> {
    const fallbackScope = params?.scopes?.length === 1 ? params.scopes[0] : undefined;
    const response = await apiClient.requestEnvelope<WorkspaceIndexResponse>(
      `${nodeApiPath(`/protocols/${encodeURIComponent(protocol)}/workspace/index`)}${queryString({
        scopes: params?.scopes,
        max_depth: params?.max_depth,
        limit: params?.limit,
        cursor: params?.cursor,
        include_dirs: params?.include_dirs,
        include_counts: params?.include_counts,
      })}`,
      { credentials: "include" },
    );
    return {
      ...response.data,
      items: normalizeWorkspaceItems(response.data.items, protocol, fallbackScope),
    };
  },

  async searchWorkspace(protocol: string, params?: WorkspaceSearchParams): Promise<WorkspaceSearchResponse> {
    const fallbackScope = params?.scopes?.length === 1 ? params.scopes[0] : undefined;
    const response = await apiClient.requestEnvelope<WorkspaceSearchResponse>(
      `${nodeApiPath(`/protocols/${encodeURIComponent(protocol)}/workspace/search`)}${queryString({
        q: params?.q,
        scopes: params?.scopes,
        ext: params?.ext,
        type: params?.type,
        path: params?.path,
        content: params?.content,
        limit: params?.limit,
        cursor: params?.cursor,
      })}`,
      { credentials: "include" },
    );
    return {
      ...response.data,
      items: response.data.items.map((match) => ({
        ...match,
        item: normalizeWorkspaceItem(match.item, protocol, fallbackScope),
      })),
    };
  },

  async getWorkspacePreview(protocol: string, scope: string, path: string): Promise<WorkspacePreviewResponse> {
    const response = await apiClient.requestEnvelope<WorkspacePreviewResponse>(
      `${nodeApiPath(`/protocols/${encodeURIComponent(protocol)}/workspace/preview`)}${queryString({ scope, path })}`,
      { credentials: "include" },
    );
    return response.data;
  },

  getWorkspaceDownloadUrl(protocol: string, scope: string, path: string): string {
    return resolveApiUrl(`${nodeApiPath(`/protocols/${encodeURIComponent(protocol)}/workspace/download`)}${queryString({ scope, path })}`);
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

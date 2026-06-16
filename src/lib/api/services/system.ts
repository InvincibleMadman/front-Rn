import { apiClient } from "@/lib/api/client";
import type { AppConfigResponse, ConfigPatchRequest, HealthResponse, SystemCapabilitiesResponse, SystemInfoResponse } from "@/types/api/config";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.map((item) => String(item)) : undefined;
}

function enabledFlag(record: Record<string, unknown>, key: string): string | undefined {
  return record[key] === true ? key : undefined;
}

function normalizeCapabilities(data: SystemCapabilitiesResponse): SystemCapabilitiesResponse {
  const record = isRecord(data) ? data : {};
  const offline = asStringArray(record.offline);
  const jobs = asStringArray(record.jobs);
  const config = asStringArray(record.config);
  const debug = asStringArray(record.debug);
  const debuggerCapabilities = asStringArray(record.debugger);
  const kbVisualization = asStringArray(record.kb_visualization);
  const backendOffline = [
    enabledFlag(record, "protocol_scoped_storage"),
    enabledFlag(record, "vuldoc_upload"),
    enabledFlag(record, "document_distillation"),
    enabledFlag(record, "knowledge_base"),
    kbVisualization?.length ? `kb_visualization: ${kbVisualization.join(", ")}` : undefined,
  ].filter((item): item is string => Boolean(item));

  return {
    ...data,
    offline: offline ?? backendOffline,
    jobs: jobs ?? ["create", "stop", "metrics", "history", "artifacts", "logs", "websocket"],
    config: config ?? ["read", "patch"],
    debug: debug ?? debuggerCapabilities ?? [],
  };
}

export interface PublicDefaultNodeResponse {
  node: {
    node_id: string;
    name: string;
    base_url: string;
    enabled: boolean;
  } | null;
  status: "online" | "offline" | "missing" | "unknown";
  latency_ms?: number | null;
  error?: string | null;
}

export const systemApi = {
  getConfig: async (): Promise<AppConfigResponse> => {
    const response = await apiClient.requestEnvelope<AppConfigResponse>("/api/v1/config");
    return response.data;
  },

  patchConfig: async (body: ConfigPatchRequest): Promise<AppConfigResponse> => {
    const response = await apiClient.requestEnvelope<AppConfigResponse>("/api/v1/config", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return response.data;
  },

  getSystemInfo: async (): Promise<SystemInfoResponse> => {
    const response = await apiClient.requestEnvelope<SystemInfoResponse>("/api/v1/system/info");
    return response.data;
  },

  getSystemCapabilities: async (): Promise<SystemCapabilitiesResponse> => {
    const response = await apiClient.requestEnvelope<SystemCapabilitiesResponse>("/api/v1/system/capabilities");
    return normalizeCapabilities(response.data);
  },

  getHealth: async (): Promise<HealthResponse> => {
    const response = await apiClient.requestEnvelope<unknown>("/healthz", { timeoutMs: 8_000 });
    return { ok: true, message: response.message, data: response.data };
  },

  getPublicDefaultNode: async (): Promise<PublicDefaultNodeResponse> => {
    const response = await apiClient.requestEnvelope<PublicDefaultNodeResponse>("/web-api/public/default-node", {
      timeoutMs: 8_000,
    });
    return response.data;
  },
};

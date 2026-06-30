import { apiClient } from "@/lib/api/client";
import { resolveWsUrl } from "@/lib/api/url";
import type { OperationLogTail, OperationRecord } from "@/types/api/operations";

export function createOperationId(kind: string): string {
  return `op-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const operationsApi = {
  listOperations: async (): Promise<OperationRecord[]> => {
    const response = await apiClient.requestEnvelope<OperationRecord[] | { items?: OperationRecord[] }>("/api/v1/operations");
    return Array.isArray(response.data) ? response.data : response.data.items ?? [];
  },
  getOperation: async (operationId: string): Promise<OperationRecord> => {
    const response = await apiClient.requestEnvelope<OperationRecord>(`/api/v1/operations/${encodeURIComponent(operationId)}`);
    return response.data;
  },
  tailLogs: async (operationId: string, since = 0, limit = 200, options?: { kinds?: string[] }): Promise<OperationLogTail> => {
    const params = new URLSearchParams({ since: String(since), limit: String(limit) });
    (options?.kinds ?? []).forEach((kind) => params.append("kinds", kind));
    const response = await apiClient.requestEnvelope<OperationLogTail>(`/api/v1/operations/${encodeURIComponent(operationId)}/logs/tail?${params.toString()}`);
    return response.data;
  },
  cancelOperation: async (operationId: string, reason?: string): Promise<OperationRecord> => {
    const response = await apiClient.requestEnvelope<OperationRecord>(`/api/v1/operations/${encodeURIComponent(operationId)}/cancel`, {
      method: "POST",
      body: JSON.stringify(reason ? { reason } : {}),
      operationId,
    });
    return response.data;
  },
  logsWsUrl: (operationId: string): string => resolveWsUrl(`/api/v1/operations/${encodeURIComponent(operationId)}/logs/ws`),
};

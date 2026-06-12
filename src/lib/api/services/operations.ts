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
  tailLogs: async (operationId: string, since = 0, limit = 200): Promise<OperationLogTail> => {
    const response = await apiClient.requestEnvelope<OperationLogTail>(`/api/v1/operations/${encodeURIComponent(operationId)}/logs/tail?since=${since}&limit=${limit}`);
    return response.data;
  },
  logsWsUrl: (operationId: string): string => resolveWsUrl(`/api/v1/operations/${encodeURIComponent(operationId)}/logs/ws`),
};

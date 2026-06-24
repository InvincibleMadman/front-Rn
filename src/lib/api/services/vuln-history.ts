import { apiClient } from "@/lib/api/client";
import type { VulnHistoryListResponse, VulnHistoryRecord, VulnQuery, VulnSummary, VulnTrendResponse } from "@/types/api/vuln-history";

function qs(params: object): string {
  const query = new URLSearchParams();
  Object.entries(params as Record<string, unknown>).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  });
  const text = query.toString();
  return text ? `?${text}` : "";
}

export const vulnHistoryApi = {
  getSummary: async (params: { protocol?: string } = {}): Promise<VulnSummary> => {
    const response = await apiClient.requestEnvelope<VulnSummary>(`/api/v1/vulnerabilities/summary${qs(params)}`);
    return response.data;
  },
  getTrends: async (params: { protocol?: string } = {}): Promise<VulnTrendResponse> => {
    const response = await apiClient.requestEnvelope<VulnTrendResponse>(`/api/v1/vulnerabilities/trends${qs(params)}`);
    return response.data;
  },
  records: async (params: VulnQuery = {}): Promise<VulnHistoryListResponse> => {
    const response = await apiClient.requestEnvelope<VulnHistoryListResponse>(`/api/v1/vulnerabilities/records${qs(params)}`);
    return response.data;
  },
  summary: async (protocol: string): Promise<Record<string, unknown>> => {
    const response = await apiClient.requestEnvelope<Record<string, unknown>>(`/api/v1/protocols/${encodeURIComponent(protocol)}/vulnerabilities/summary`);
    return response.data;
  },
  list: async (protocol: string, params: { coarse_type?: string; limit?: number; offset?: number } = {}): Promise<VulnHistoryListResponse> => {
    const response = await apiClient.requestEnvelope<VulnHistoryListResponse | VulnHistoryRecord[]>(`/api/v1/protocols/${encodeURIComponent(protocol)}/vulns/history${qs(params)}`);
    return Array.isArray(response.data) ? { items: response.data, total: response.data.length } : response.data;
  },
  get: async (protocol: string, recordId: string): Promise<VulnHistoryRecord> => {
    const response = await apiClient.requestEnvelope<VulnHistoryRecord>(`/api/v1/protocols/${encodeURIComponent(protocol)}/vulns/history/${encodeURIComponent(recordId)}`);
    return response.data;
  },
};

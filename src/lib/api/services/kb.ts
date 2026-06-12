import { apiClient } from "@/lib/api/client";
import type { KbEntry } from "@/types/api/vuldocs";
import type { KbGraphResponse, KbSearchParams, KbSummaryResponse, KbTimelineResponse } from "@/types/api/kb";

function qs(params: KbSearchParams): string {
  const query = new URLSearchParams();
  (Object.entries(params) as Array<[string, string | number | undefined]>).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  const text = query.toString();
  return text ? `?${text}` : "";
}

export const kbApi = {
  summary: async (protocol: string): Promise<KbSummaryResponse> => {
    const response = await apiClient.requestEnvelope<KbSummaryResponse>(`/api/v1/protocols/${encodeURIComponent(protocol)}/kb/summary`);
    return response.data;
  },
  search: async (protocol: string, params: KbSearchParams = {}): Promise<KbEntry[]> => {
    const response = await apiClient.requestEnvelope<KbEntry[] | { items?: KbEntry[]; entries?: KbEntry[] }>(`/api/v1/protocols/${encodeURIComponent(protocol)}/kb/search${qs(params)}`);
    return Array.isArray(response.data) ? response.data : response.data.items ?? response.data.entries ?? [];
  },
  vulns: async (protocol: string, params: KbSearchParams = {}): Promise<KbEntry[]> => {
    const response = await apiClient.requestEnvelope<KbEntry[] | { items?: KbEntry[]; entries?: KbEntry[] }>(`/api/v1/protocols/${encodeURIComponent(protocol)}/kb/vulns${qs(params)}`);
    return Array.isArray(response.data) ? response.data : response.data.items ?? response.data.entries ?? [];
  },
  vuln: async (protocol: string, vulnId: string): Promise<KbEntry> => {
    const response = await apiClient.requestEnvelope<KbEntry>(`/api/v1/protocols/${encodeURIComponent(protocol)}/kb/vulns/${encodeURIComponent(vulnId)}`);
    return response.data;
  },
  graph: async (protocol: string): Promise<KbGraphResponse> => {
    const response = await apiClient.requestEnvelope<KbGraphResponse>(`/api/v1/protocols/${encodeURIComponent(protocol)}/kb/graph`);
    return response.data;
  },
  timeline: async (protocol: string): Promise<KbTimelineResponse> => {
    const response = await apiClient.requestEnvelope<KbTimelineResponse>(`/api/v1/protocols/${encodeURIComponent(protocol)}/kb/timeline`);
    return response.data;
  },
};

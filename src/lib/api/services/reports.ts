import { apiClient } from "@/lib/api/client";
import { resolveApiUrl, resolveNodeApiPath } from "@/lib/api/url";
import { useAuthStore } from "@/stores/auth-store";
import type { ReportPreview, ReportRecord, ReportSummary } from "@/types/api/reports";

function nodeApiPath(path: string): string {
  return resolveNodeApiPath(`/api/v1${path}`);
}

function csrfHeaders(): HeadersInit {
  const csrfToken = useAuthStore.getState().csrfToken;
  return csrfToken ? { "X-CSRF-Token": csrfToken } : {};
}

export const reportsApi = {
  async getSummary(protocol: string): Promise<ReportSummary> {
    const response = await apiClient.requestEnvelope<ReportSummary>(nodeApiPath(`/protocols/${encodeURIComponent(protocol)}/reports/summary`), {
      credentials: "include",
    });
    return response.data;
  },

  async getPreview(protocol: string): Promise<ReportPreview> {
    const response = await apiClient.requestEnvelope<ReportPreview>(nodeApiPath(`/protocols/${encodeURIComponent(protocol)}/reports/preview`), {
      credentials: "include",
    });
    return response.data;
  },

  async list(protocol: string): Promise<ReportRecord[]> {
    const response = await apiClient.requestEnvelope<{ items: ReportRecord[] }>(nodeApiPath(`/protocols/${encodeURIComponent(protocol)}/reports`), {
      credentials: "include",
    });
    return response.data.items ?? [];
  },

  async generate(protocol: string, body: Record<string, unknown>): Promise<ReportRecord> {
    const response = await apiClient.requestEnvelope<ReportRecord>(nodeApiPath(`/protocols/${encodeURIComponent(protocol)}/reports/generate`), {
      method: "POST",
      credentials: "include",
      headers: csrfHeaders(),
      body: JSON.stringify(body),
    });
    return response.data;
  },

  downloadUrl(protocol: string, reportId: string): string {
    return resolveApiUrl(nodeApiPath(`/protocols/${encodeURIComponent(protocol)}/reports/${encodeURIComponent(reportId)}/download`));
  },
};

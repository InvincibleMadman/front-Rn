import { apiClient } from "@/lib/api/client";
import { resolveWsUrl } from "@/lib/api/url";
import type { DebugCandidate, DebugSession, DebugSessionRequest, DebugSummary } from "@/types/api/debug";

type DebugCandidateListResponse = DebugCandidate[] | { items?: DebugCandidate[]; candidates?: DebugCandidate[] };
type DebugSessionListResponse = DebugSession[] | { items?: DebugSession[]; sessions?: DebugSession[] };

function normalizeCandidates(data: DebugCandidateListResponse): DebugCandidate[] {
  return Array.isArray(data) ? data : data.items ?? data.candidates ?? [];
}

function normalizeSessions(data: DebugSessionListResponse): DebugSession[] {
  return Array.isArray(data) ? data : data.items ?? data.sessions ?? [];
}

export const debugApi = {
  listCandidates: async (jobId?: string): Promise<DebugCandidate[]> => {
    const path = jobId ? `/api/v1/debug/candidates?job_id=${encodeURIComponent(jobId)}` : "/api/v1/debug/candidates";
    const response = await apiClient.requestEnvelope<DebugCandidateListResponse>(path);
    return normalizeCandidates(response.data);
  },
  listJobCandidates: async (jobId: string): Promise<DebugCandidate[]> => {
    const response = await apiClient.requestEnvelope<DebugCandidateListResponse>(`/api/v1/jobs/${encodeURIComponent(jobId)}/debug/candidates`);
    return normalizeCandidates(response.data);
  },
  createSession: async (body: DebugSessionRequest): Promise<DebugSession> => {
    const response = await apiClient.requestEnvelope<DebugSession>("/api/v1/debug/sessions", {
      method: "POST",
      body: JSON.stringify(body),
      operationId: body.operation_id,
    });
    return response.data;
  },
  createBatchSessions: async (body: Record<string, unknown>): Promise<DebugSession[]> => {
    const response = await apiClient.requestEnvelope<DebugSessionListResponse>("/api/v1/debug/sessions/batch", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return normalizeSessions(response.data);
  },
  getSession: async (sessionId: string): Promise<DebugSession> => {
    const response = await apiClient.requestEnvelope<DebugSession>(`/api/v1/debug/sessions/${encodeURIComponent(sessionId)}`);
    return response.data;
  },
  sessionLogsTail: async (sessionId: string, since = 0, limit = 200) => {
    const response = await apiClient.requestEnvelope(`/api/v1/debug/sessions/${encodeURIComponent(sessionId)}/logs/tail?since=${since}&limit=${limit}`);
    return response.data;
  },
  sessionLogsWsUrl: (sessionId: string): string => resolveWsUrl(`/api/v1/debug/sessions/${encodeURIComponent(sessionId)}/logs/ws`),
  listProtocolSessions: async (protocol: string, params: { coarse_type?: string } = {}): Promise<DebugSession[]> => {
    const query = params.coarse_type ? `?coarse_type=${encodeURIComponent(params.coarse_type)}` : "";
    const response = await apiClient.requestEnvelope<DebugSessionListResponse>(`/api/v1/protocols/${encodeURIComponent(protocol)}/debug/sessions${query}`);
    return normalizeSessions(response.data);
  },
  getProtocolSummary: async (protocol: string): Promise<DebugSummary> => {
    const response = await apiClient.requestEnvelope<DebugSummary>(`/api/v1/protocols/${encodeURIComponent(protocol)}/debug/summary`);
    return response.data;
  },
};

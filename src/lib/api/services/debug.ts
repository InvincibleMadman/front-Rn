import { apiClient } from "@/lib/api/client";
import { resolveWsUrl } from "@/lib/api/url";
import type {
  DebugCandidate,
  DebugLiveSession,
  DebugSession,
  DebugSessionRequest,
  DebugSummary,
} from "@/types/api/debug";

type DebugCandidateListResponse = DebugCandidate[] | { items?: DebugCandidate[]; candidates?: DebugCandidate[] };
type DebugSessionListResponse = DebugSession[] | { items?: DebugSession[]; sessions?: DebugSession[] };

function normalizeCandidates(data: DebugCandidateListResponse): DebugCandidate[] {
  return Array.isArray(data) ? data : data.items ?? data.candidates ?? [];
}

function normalizeSessions(data: DebugSessionListResponse): DebugSession[] {
  return Array.isArray(data) ? data : data.items ?? data.sessions ?? [];
}

function withQuery(path: string, params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "") return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `${path}?${query}` : path;
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
  createSession: async (
    body: DebugSessionRequest,
    options: { async?: boolean } = {},
  ): Promise<DebugSession> => {
    const useAsync = options.async ?? body.run_mode === "async";
    const path = useAsync ? "/api/v1/debug/sessions?async=true" : "/api/v1/debug/sessions";
    const response = await apiClient.requestEnvelope<DebugSession>(path, {
      method: "POST",
      body: JSON.stringify({ ...body, run_mode: useAsync ? "async" : body.run_mode }),
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
  getLiveSession: async (sessionId: string): Promise<DebugLiveSession> => {
    const response = await apiClient.requestEnvelope<DebugLiveSession>(`/api/v1/debug/sessions/${encodeURIComponent(sessionId)}/live`);
    return response.data;
  },
  sessionLogsTail: async (
    sessionId: string,
    since = 0,
    limit = 200,
    params: { kinds?: string[] } = {},
  ) => {
    const path = withQuery(`/api/v1/debug/sessions/${encodeURIComponent(sessionId)}/logs/tail`, {
      since,
      limit,
      kinds: params.kinds?.join(","),
    });
    const response = await apiClient.requestEnvelope(path);
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
  uploadReplayScript: async (protocol: string, file: File, runtime: string): Promise<Record<string, unknown>> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("runtime", runtime);
    const response = await apiClient.requestEnvelope<Record<string, unknown>>(`/api/v1/protocols/${encodeURIComponent(protocol)}/debug/replay-scripts/upload`, {
      method: "POST",
      body: formData,
    });
    return response.data;
  },
  deleteReplayScript: async (protocol: string, filename: string): Promise<void> => {
    await apiClient.requestEnvelope(`/api/v1/protocols/${encodeURIComponent(protocol)}/debug/replay-scripts/${encodeURIComponent(filename)}`, {
      method: "DELETE",
    });
  },
};

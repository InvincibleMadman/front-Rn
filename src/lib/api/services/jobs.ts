import { apiClient } from "@/lib/api/client";
import { resolveApiUrl, resolveWsUrl } from "@/lib/api/url";
import type {
  AnalysisResult,
  ArtifactRecord,
  EventMessage,
  Job,
  JobCreateRequest,
  JobRuntimeResponse,
  JobsListQuery,
  JobsMonitorOverview,
  JobsSummary,
  LogsTailResponse,
  Metrics,
} from "@/types/api/jobs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringFrom(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function numberFrom(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().replace(/%$/, "").replace(/,/g, "");
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.map((item) => String(item)) : undefined;
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberField(record: Record<string, unknown>, key: string): number | undefined {
  return numberFrom(record[key]);
}

function withQuery(path: string, query: Record<string, unknown>): string {
  const search = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  const text = search.toString();
  return text ? `${path}?${text}` : path;
}

function normalizeMetrics(metrics: Metrics | Record<string, unknown> | null | undefined): Metrics | null {
  if (!metrics || !isRecord(metrics)) return null;
  const rawStats = isRecord(metrics.fuzzer_stats) ? metrics.fuzzer_stats : isRecord(metrics.raw) ? metrics.raw : {};
  const normalized: Metrics = {
    ...(metrics as Metrics),
    timestamp: stringFrom(metrics.timestamp) ?? stringFrom(metrics.at) ?? new Date().toISOString(),
    raw: isRecord(rawStats)
      ? Object.fromEntries(Object.entries(rawStats).map(([key, value]) => [key, String(value)]))
      : undefined,
  };

  ([
    "cycles_done", "execs_done", "execs_per_sec", "paths_total", "pending_total",
    "unique_crashes", "unique_hangs", "bitmap_cvg", "stability",
  ] as const).forEach((key) => {
    const direct = numberFrom(normalized[key]);
    const fromStats = numberFrom(rawStats[key]);
    const value = direct ?? fromStats;
    if (value !== undefined) normalized[key] = value;
  });

  const statsFile = stringFrom(metrics.stats_file_path) ?? stringFrom(rawStats.stats_file_path);
  if (statsFile) normalized.stats_file_path = statsFile;
  return normalized;
}

function normalizeJob(job: Job): Job {
  const request = isRecord(job.request) ? job.request : {};
  const normalized: Job = { ...job };
  normalized.protocol = stringFrom(job.protocol) ?? stringField(request, "protocol");
  normalized.cwd = stringFrom(job.cwd) ?? stringField(request, "cwd");
  normalized.target_cmd = asStringArray(job.target_cmd) ?? asStringArray(request.target_cmd);
  normalized.afl_path = stringFrom(job.afl_path) ?? stringField(request, "afl_path");
  normalized.input_dir = stringFrom(job.input_dir) ?? stringField(request, "input_dir");
  normalized.output_dir = stringFrom(job.output_dir) ?? stringField(request, "output_dir");
  normalized.timeout_sec = numberField(job as unknown as Record<string, unknown>, "timeout_sec") ?? numberField(request, "timeout_sec");
  normalized.dry_run = typeof job.dry_run === "boolean" ? job.dry_run : typeof request.dry_run === "boolean" ? (request.dry_run as boolean) : undefined;
  normalized.debug = isRecord(job.debug) ? job.debug as Job["debug"] : isRecord(request.debug) ? request.debug as Job["debug"] : undefined;
  normalized.pids = Array.isArray(job.pids) ? job.pids : typeof job.pid === "number" ? [job.pid] : [];
  const rawMetrics = isRecord(job.metrics) ? job.metrics : null;
  const lastMetrics = normalizeMetrics(rawMetrics);
  if (lastMetrics) normalized.last_metrics = lastMetrics;
  return normalized;
}

function normalizeArtifact(artifact: ArtifactRecord): ArtifactRecord {
  const normalized: ArtifactRecord = { ...artifact };
  if (!normalized.discovered_at && typeof artifact.mtime === "number") {
    normalized.discovered_at = new Date(artifact.mtime * 1000).toISOString();
  }
  if (!normalized.path && typeof artifact.seed_path === "string") normalized.path = artifact.seed_path;
  if (!normalized.seed_path && typeof artifact.path === "string") normalized.seed_path = artifact.path;
  return normalized;
}

export const jobsApi = {
  createJob: async (payload: JobCreateRequest): Promise<Job> => {
    const response = await apiClient.requestEnvelope<Job>("/api/v1/jobs", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return normalizeJob(response.data);
  },

  listJobs: async (query: JobsListQuery = {}): Promise<Job[]> => {
    const response = await apiClient.requestEnvelope<{ items?: Job[] } | Job[]>(withQuery("/api/v1/jobs", query));
    const data = response.data;
    const items = Array.isArray(data) ? data : (data.items ?? []);
    return items.map(normalizeJob);
  },

  requestSummary: async (query: JobsListQuery = {}): Promise<JobsSummary> => {
    const response = await apiClient.requestEnvelope<JobsSummary>(withQuery("/api/v1/jobs/summary", query));
    return response.data;
  },

  getMonitorOverview: async (query: { job_id?: string; status?: string; protocol?: string } = {}): Promise<JobsMonitorOverview> => {
    const response = await apiClient.requestEnvelope<JobsMonitorOverview>(withQuery("/api/v1/jobs/monitor/overview", query));
    return {
      ...response.data,
      selected_job_metrics: normalizeMetrics(response.data.selected_job_metrics ?? null),
    } as JobsMonitorOverview;
  },

  getRuntime: async (jobId: string): Promise<JobRuntimeResponse> => {
    const response = await apiClient.requestEnvelope<JobRuntimeResponse>(`/api/v1/jobs/${encodeURIComponent(jobId)}/runtime`);
    return {
      ...response.data,
      metrics: normalizeMetrics(response.data.metrics ?? null),
    };
  },

  getJob: async (jobId: string): Promise<Job> => {
    const response = await apiClient.requestEnvelope<Job>(`/api/v1/jobs/${encodeURIComponent(jobId)}`);
    return normalizeJob(response.data);
  },

  stopJob: async (jobId: string): Promise<Job> => {
    const response = await apiClient.requestEnvelope<Job>(`/api/v1/jobs/${encodeURIComponent(jobId)}/stop`, { method: "POST", body: JSON.stringify({}) });
    return normalizeJob(response.data);
  },

  getMetrics: async (jobId: string): Promise<Metrics | null> => {
    const response = await apiClient.requestEnvelope<Record<string, unknown>>(`/api/v1/jobs/${encodeURIComponent(jobId)}/metrics`);
    return normalizeMetrics(response.data);
  },

  getMetricsHistory: async (jobId: string, limit = 200): Promise<Metrics[]> => {
    const response = await apiClient.requestEnvelope<Metrics[] | { items?: Metrics[]; points?: Metrics[] }>(`/api/v1/jobs/${encodeURIComponent(jobId)}/metrics/history?limit=${limit}`);
    const data = response.data;
    const items = Array.isArray(data) ? data : (data.points ?? data.items ?? []);
    return items.map(normalizeMetrics).filter((item): item is Metrics => item !== null);
  },

  listArtifacts: async (jobId: string): Promise<ArtifactRecord[]> => {
    const response = await apiClient.requestEnvelope<{ job_id?: string; items?: ArtifactRecord[] }>(`/api/v1/jobs/${encodeURIComponent(jobId)}/artifacts`);
    return (response.data.items ?? []).map(normalizeArtifact);
  },

  getArtifact: async (jobId: string, artifactId: string): Promise<ArtifactRecord> => {
    const response = await apiClient.requestEnvelope<ArtifactRecord>(`/api/v1/jobs/${encodeURIComponent(jobId)}/artifacts/${encodeURIComponent(artifactId)}`);
    return normalizeArtifact(response.data);
  },

  replayArtifact: async (jobId: string, artifactId: string): Promise<AnalysisResult> => {
    const response = await apiClient.requestEnvelope<AnalysisResult>(`/api/v1/jobs/${encodeURIComponent(jobId)}/artifacts/${encodeURIComponent(artifactId)}/replay`, { method: "POST", body: JSON.stringify({}) });
    return response.data;
  },

  analyzeArtifact: async (jobId: string, artifactId: string): Promise<AnalysisResult> => {
    const response = await apiClient.requestEnvelope<AnalysisResult>(`/api/v1/jobs/${encodeURIComponent(jobId)}/artifacts/${encodeURIComponent(artifactId)}/analyze`, { method: "POST", body: JSON.stringify({}) });
    return response.data;
  },

  tailLogs: async (jobId: string, limit = 200): Promise<LogsTailResponse> => {
    const response = await apiClient.requestEnvelope<LogsTailResponse | string[]>(`/api/v1/jobs/${encodeURIComponent(jobId)}/logs/tail?lines=${limit}`);
    const data = response.data;
    if (Array.isArray(data)) {
      return { lines: data, status: "unknown", next_seq: 0 };
    }
    return {
      lines: data.lines ?? [],
      status: data.status ?? "unknown",
      next_seq: data.next_seq ?? 0,
    };
  },

  downloadLogsUrl: (jobId: string): string => resolveApiUrl(`/api/v1/jobs/${encodeURIComponent(jobId)}/logs/download`),
  eventsWsUrl: (jobId: string): string => resolveWsUrl(`/api/v1/jobs/${encodeURIComponent(jobId)}/events/ws`),
  metricsWsUrl: (jobId: string): string => resolveWsUrl(`/api/v1/jobs/${encodeURIComponent(jobId)}/metrics/ws`),
  artifactsWsUrl: (jobId: string): string => resolveWsUrl(`/api/v1/jobs/${encodeURIComponent(jobId)}/artifacts/ws`),

  parseEventMessage(raw: string): EventMessage {
    const payload = JSON.parse(raw) as unknown;
    if (!isRecord(payload)) return { type: "raw", log_tail: [String(payload)] };
    return {
      type: stringFrom(payload.type) ?? "event",
      event_type: stringFrom(payload.event_type) ?? stringFrom(payload.type) ?? "event",
      job_id: stringFrom(payload.job_id),
      status: stringFrom(payload.status),
      job: isRecord(payload.job) ? payload.job : undefined,
      log_tail: Array.isArray(payload.log_tail) ? payload.log_tail.map(String) : undefined,
      timestamp: stringFrom(payload.timestamp) ?? stringFrom(payload.at) ?? new Date().toISOString(),
      payload: isRecord(payload.payload) ? payload.payload : payload as Record<string, unknown>,
    };
  },

  parseMetricsMessage(raw: string): Metrics {
    const payload = JSON.parse(raw) as Record<string, unknown>;
    const data = isRecord(payload.data) ? payload.data : payload;
    return normalizeMetrics(data) ?? { timestamp: new Date().toISOString() };
  },

  parseArtifactMessage(raw: string): ArtifactRecord[] {
    const payload = JSON.parse(raw) as Record<string, unknown>;
    const items = Array.isArray(payload.items) ? payload.items : [];
    return items.map((item) => normalizeArtifact(item as ArtifactRecord));
  },
};

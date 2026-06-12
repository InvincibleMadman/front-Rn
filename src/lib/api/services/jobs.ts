import { apiClient } from "@/lib/api/client";
import { resolveApiUrl, resolveWsUrl } from "@/lib/api/url";
import type { AnalysisResult, ArtifactRecord, EventMessage, Job, JobCreateRequest, LogsTailResponse, Metrics } from "@/types/api/jobs";

/* ── helpers ── */

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

/* ── normalizers ── */

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

/**
 * 后端 JobRecord 结构：
 * { job_id, protocol, status, pid, request: { cwd, target_cmd, afl_path, ... }, output_dir, log_path, command, metrics, ... }
 *
 * 前端 normalizeJob 从 request.* 字段 fallback 提取关键信息。
 */
function normalizeJob(job: Job): Job {
  const request = isRecord(job.request) ? job.request : {};
  const normalized: Job = { ...job };

  // 从 request fallback 提取常用字段
  normalized.protocol = stringFrom(job.protocol) ?? stringField(request, "protocol");
  normalized.cwd = stringFrom(job.cwd) ?? stringField(request, "cwd");
  normalized.target_cmd = asStringArray(job.target_cmd) ?? asStringArray(request.target_cmd);
  normalized.afl_path = stringFrom(job.afl_path) ?? stringField(request, "afl_path");
  normalized.input_dir = stringFrom(job.input_dir) ?? stringField(request, "input_dir");
  normalized.output_dir = stringFrom(job.output_dir) ?? stringField(request, "output_dir");
  normalized.timeout_sec = numberField(job as unknown as Record<string, unknown>, "timeout_sec") ?? numberField(request, "timeout_sec");
  normalized.dry_run = typeof job.dry_run === "boolean" ? job.dry_run : typeof request.dry_run === "boolean" ? (request.dry_run as boolean) : undefined;
  normalized.debug = isRecord(job.debug) ? job.debug as Job["debug"] : isRecord(request.debug) ? request.debug as Job["debug"] : undefined;

  // pid: 后端只有 pid: int | null，前端兼容 pids 数组
  normalized.pids = Array.isArray(job.pids) ? job.pids : typeof job.pid === "number" ? [job.pid] : [];

  // metrics: 后端 metrics 是 dict（可能为空），last_metrics 不存在
  const rawMetrics = isRecord(job.metrics) ? job.metrics : null;
  const lastMetrics = normalizeMetrics(rawMetrics);
  if (lastMetrics) {
    normalized.last_metrics = lastMetrics;
  }

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

/* ── API methods ── */

export const jobsApi = {
  createJob: async (payload: JobCreateRequest): Promise<Job> => {
    const response = await apiClient.requestEnvelope<Job>("/api/v1/jobs", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return normalizeJob(response.data);
  },

  listJobs: async (): Promise<Job[]> => {
    // 后端返回 { ok, message, data: { items: JobRecord[] } }
    const response = await apiClient.requestEnvelope<{ items?: Job[] } | Job[]>("/api/v1/jobs");
    const data = response.data;
    const items = Array.isArray(data) ? data : (data.items ?? []);
    return items.map(normalizeJob);
  },

  requestSummary: async (): Promise<Record<string, unknown>> => {
    const response = await apiClient.requestEnvelope<Record<string, unknown>>("/api/v1/jobs/summary");
    return response.data;
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
    // 后端返回 dict（可能为空 {}）
    const response = await apiClient.requestEnvelope<Record<string, unknown>>(`/api/v1/jobs/${encodeURIComponent(jobId)}/metrics`);
    return normalizeMetrics(response.data);
  },

  getMetricsHistory: async (jobId: string, limit = 200): Promise<Metrics[]> => {
    // 后端直接返回 raw array（ApiResponse data 层是 array）
    const response = await apiClient.requestEnvelope<Metrics[] | { items?: Metrics[]; points?: Metrics[] }>(`/api/v1/jobs/${encodeURIComponent(jobId)}/metrics/history?limit=${limit}`);
    const data = response.data;
    const items = Array.isArray(data) ? data : (data.points ?? data.items ?? []);
    return items.map(normalizeMetrics).filter((item): item is Metrics => item !== null);
  },

  listArtifacts: async (jobId: string): Promise<ArtifactRecord[]> => {
    // 后端返回 { ok, message, data: { job_id, items: ArtifactRecord[] } }
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

  /**
   * 后端返回 { ok, message, data: { lines: string[], status: string, next_seq: number } }
   * 前端返回完整 LogsTailResponse，不再只返回 string[]。
   */
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

  /**
   * 后端 events WS 消息格式：{ type: "events", job_id, status, job, log_tail }
   * 前端解析为 EventMessage，保留所有字段。
   */
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
    const payload = JSON.parse(raw) as unknown;
    // 后端格式：{ type: "metrics", job_id, data: {...} }
    const data = isRecord(payload) && isRecord(payload.data) ? payload.data : payload;
    return normalizeMetrics(data as Metrics) ?? { timestamp: new Date().toISOString() };
  },

  parseArtifactMessage(raw: string): ArtifactRecord[] {
    const payload = JSON.parse(raw) as unknown;
    // 后端格式：{ type: "artifacts", job_id, items: [...] }
    if (isRecord(payload) && Array.isArray(payload.items)) return (payload.items as ArtifactRecord[]).map(normalizeArtifact);
    if (isRecord(payload) && isRecord(payload.data) && Array.isArray(payload.data.items)) return (payload.data.items as ArtifactRecord[]).map(normalizeArtifact);
    if (Array.isArray(payload)) return (payload as ArtifactRecord[]).map(normalizeArtifact);
    return isRecord(payload) ? [normalizeArtifact(payload as ArtifactRecord)] : [];
  },
};

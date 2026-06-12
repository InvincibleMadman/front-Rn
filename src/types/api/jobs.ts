export type JobStatus = "starting" | "running" | "stopping" | "finished" | "failed" | string;
export type ArtifactKind = "crash" | "hang" | string;
export type ReplayStatus = "pending" | "running" | "succeeded" | "failed" | string;

export interface JobDebugConfig {
  transport_type?: "stdin" | "file" | "udp" | "tcp" | "custom" | string;
  transport_config?: Record<string, unknown>;
}

export interface JobCreateRequest {
  protocol: string;
  cwd?: string;
  cwd_ref?: string;
  target_cmd?: string[];
  afl_path?: string;
  input_dir?: string;
  input_dir_ref?: string;
  output_dir?: string;
  output_dir_ref?: string;
  launch_profile_id?: string;
  fuzzer_args?: string[];
  env?: Record<string, string>;
  timeout_sec?: number;
  dry_run?: boolean;
  debug?: JobDebugConfig;
  [key: string]: unknown;
}

export interface AflJobConfig {
  afl_binary?: string;
  target_binary?: string;
  input_dir?: string;
  output_dir?: string;
  run_cwd?: string | null;
  source_dir?: string | null;
  build_dir?: string | null;
  target_args?: string[];
  fuzzer_args?: string[];
  env?: Record<string, string>;
  workers?: number;
  [key: string]: unknown;
}

export interface Metrics {
  timestamp?: string;
  at?: string;
  cycles_done?: number;
  execs_done?: number;
  execs_per_sec?: number;
  paths_total?: number;
  pending_total?: number;
  unique_crashes?: number;
  unique_hangs?: number;
  bitmap_cvg?: number;
  stability?: number | null;
  stats_file_path?: string | null;
  raw?: Record<string, string>;
  fuzzer_stats?: Record<string, string | number>;
  [key: string]: unknown;
}

export interface ArtifactRecord {
  artifact_id: string;
  name?: string;
  kind?: ArtifactKind;
  path?: string;
  size?: number;
  mtime?: number;
  discovered_at?: string;
  source_dir?: string;
  seed_path?: string;
  protocol?: string;
  job_id?: string;
  target?: unknown;
  debug_session_request?: unknown;
  [key: string]: unknown;
}

export interface AnalysisResult {
  artifact_id?: string;
  status?: ReplayStatus;
  mode?: string;
  stdout?: string;
  stderr?: string;
  summary?: string;
  output_path?: string | null;
  debug_session_request?: unknown;
  [key: string]: unknown;
}

/**
 * 后端 JobRecord：
 * { job_id, protocol, status, pid, request: {...}, output_dir, log_path, command, validation, metrics, created_at, updated_at, ... }
 *
 * 前端 normalizeJob 从 request.* fallback 提取 target_cmd, cwd, afl_path, input_dir, output_dir 等。
 */
export interface Job {
  job_id: string;
  name?: string;
  protocol?: string;
  status: JobStatus;
  created_at?: string;
  started_at?: string;
  updated_at?: string;
  finished_at?: string | null;
  stopped_at?: string | null;
  cwd?: string;
  target_cmd?: string[];
  afl_path?: string;
  input_dir?: string;
  output_dir?: string;
  timeout_sec?: number;
  dry_run?: boolean;
  debug?: JobDebugConfig;
  request?: Record<string, unknown>;
  afl?: AflJobConfig;
  pid?: number | null;
  pids?: number[];
  stats_file_path?: string | null;
  log_path?: string | null;
  db_path?: string | null;
  error?: string | null;
  metrics?: Record<string, unknown> | null;
  last_metrics?: Metrics | null;
  command?: string[];
  validation?: Record<string, unknown>;
  operation_id?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * 后端 WebSocket events 消息格式：
 * { type: "events", job_id, status, job, log_tail }
 *
 * 前端需要适配这个结构，不再是 { event_type, timestamp, payload }。
 */
export interface EventMessage {
  /** 后端字段：消息类型 "events" / "metrics" / "artifacts" */
  type?: string;
  /** 前端兼容：旧字段名 */
  event_type?: string;
  job_id?: string;
  /** 后端字段：job status */
  status?: string;
  /** 后端字段：完整 job 对象 */
  job?: Record<string, unknown>;
  /** 后端字段：最近日志行 */
  log_tail?: string[];
  /** 前端兼容：旧字段 */
  timestamp?: string;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * 后端 logs/tail 返回格式：
 * { lines: string[], status: string, next_seq: number }
 */
export interface LogsTailResponse {
  lines: string[];
  status?: string;
  next_seq?: number;
  [key: string]: unknown;
}

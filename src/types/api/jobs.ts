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
  memory_limit_mb?: number;
  workers?: number;
  scheduler?: string;
  risk_enabled?: boolean;
  node_name?: string;
  notes?: string;
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

export interface EventMessage {
  type?: string;
  event_type?: string;
  job_id?: string;
  status?: string;
  job?: Record<string, unknown>;
  log_tail?: string[];
  timestamp?: string;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface LogsTailResponse {
  lines: string[];
  status?: string;
  next_seq?: number;
  [key: string]: unknown;
}

export interface JobsListQuery {
  status?: string;
  protocol?: string;
  node_name?: string;
  scheduler?: string;
  risk_enabled?: boolean;
  keyword?: string;
  has_crash?: boolean;
  has_hang?: boolean;
  limit?: number;
  offset?: number;
  sort?: string;
  order?: "asc" | "desc";
}

export interface JobsSummary {
  total: number;
  running: number;
  starting: number;
  stopping: number;
  finished: number;
  failed: number;
  by_status: Record<string, number>;
  by_protocol: Record<string, number>;
  by_node: Record<string, number>;
  by_scheduler: Record<string, number>;
  recent_jobs: Job[];
  crash_count: number;
  hang_count: number;
  risk_enabled_count: number;
  risk_enabled_ratio: number;
  active_protocols: string[];
  active_nodes: string[];
  latest_updated_at?: string | null;
}

export interface JobRuntimeSummary {
  job_id?: string;
  protocol?: string;
  status?: string;
  working_directory?: string | null;
  afl_binary?: string | null;
  input_dir?: string | null;
  output_dir?: string | null;
  memory_limit?: string | number | null;
  timeout?: string | number | null;
  schedule_mode?: string | null;
  workers?: number;
  scheduler?: string;
  risk_enabled?: boolean;
  node_name?: string;
  timeout_sec?: number | null;
  transport_type?: string | null;
  transport_config?: Record<string, unknown>;
  env_count?: number;
  notes?: string | null;
  command?: string[];
  afl_flags?: Array<{ flag: string; value: unknown }>;
  target_command?: string[];
  target_binary?: string | null;
  target_args?: string[];
  fuzzer_args?: string[];
}

export interface JobsMonitorItem {
  job_id: string;
  status?: string;
  protocol?: string;
  node_name?: string;
  scheduler?: string;
  risk_enabled?: boolean;
  updated_at?: string;
  execs_done?: number;
  bitmap_cvg?: number;
  unique_crashes?: number;
  unique_hangs?: number;
}

export interface JobsArtifactFeedItem {
  job_id: string;
  protocol?: string;
  artifact_id?: string;
  kind?: string;
  discovered_at?: string;
  seed_path?: string;
}

export interface JobsAlertItem {
  job_id?: string;
  protocol?: string;
  level?: string;
  kind?: string;
  message?: string;
  at?: string;
}

export interface JobsTrendPoint {
  timestamp: string;
  execs_done: number;
  bitmap_cvg: number;
  unique_crashes: number;
  unique_hangs: number;
}

export interface JobsMonitorOverview {
  summary: JobsSummary;
  trend: JobsTrendPoint[];
  status_channels: {
    jobs_by_status: Record<string, number>;
    artifacts_by_kind: Record<string, number>;
    top_protocol?: string | null;
    top_node?: string | null;
    recent_events: Array<{ job_id?: string; protocol?: string; status?: string; label?: string; updated_at?: string }>;
  };
  recent_task_activity: JobsMonitorItem[];
  recent_artifacts: JobsArtifactFeedItem[];
  alert_timeline: JobsAlertItem[];
  selected_job_runtime?: JobRuntimeSummary | null;
  selected_job_metrics?: Metrics | null;
}

export interface JobRuntimeResponse {
  runtime: JobRuntimeSummary;
  metrics: Metrics | null;
  artifact_counts: Record<string, number>;
}

export type JobsActivity = JobsMonitorOverview;

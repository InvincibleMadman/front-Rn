export type TransportType = "stdin" | "file" | "udp" | "tcp" | "custom" | string;

export interface DebugTarget {
  binary_path?: string;
  cwd?: string;
  args?: string[];
  env?: Record<string, string>;
  protocol?: string;
  transport_type?: TransportType;
  transport_config?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface DebugSessionRequest {
  operation_id?: string;
  protocol: string;
  artifact_path: string;
  artifact_id?: string;
  job_id?: string;
  target: DebugTarget;
  [key: string]: unknown;
}

export interface DebugCandidate {
  job_id?: string;
  artifact_id?: string;
  path?: string;
  seed_path?: string;
  name?: string;
  kind?: string;
  size?: number;
  protocol?: string;
  target?: DebugTarget;
  debug_session_request?: DebugSessionRequest;
  [key: string]: unknown;
}

export interface VulnerabilityLocation {
  function_name?: string;
  file_path?: string;
  line?: number;
  line_start?: number;
  line_end?: number;
  [key: string]: unknown;
}

export interface DebugReport {
  schema_version?: string;
  session_id?: string;
  operation_id?: string;
  history_record_id?: string;
  protocol?: string;
  job_id?: string;
  artifact?: Record<string, unknown>;
  target?: DebugTarget;
  vulnerability_location?: VulnerabilityLocation;
  error_type?: string;
  vuln_type?: string;
  coarse_type?: string;
  cwe?: string;
  signal?: string;
  exit_code?: number;
  crash_signature?: string;
  root_cause?: string;
  direct_cause?: string;
  possible_exploitation_description?: string;
  poc_concept?: string;
  repro_steps?: unknown[];
  fix_suggestion?: string;
  confidence?: number;
  stack_summary?: string;
  gdb_context_excerpt?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface DebugSession {
  session_id: string;
  protocol?: string;
  status?: string;
  operation_id?: string;
  states?: unknown[];
  gdb_context?: Record<string, unknown>;
  classification?: Record<string, unknown>;
  debug_report?: DebugReport;
  debug_report_path?: string;
  history_record_id?: string;
  [key: string]: unknown;
}

export interface DebugSummary {
  protocol: string;
  total: number;
  by_status: Record<string, number>;
  by_coarse_type: Record<string, number>;
  recent_sessions: DebugSession[];
}

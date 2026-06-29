export type TransportType = "stdin" | "file" | "udp" | "tcp" | "custom" | string;

export interface DebugTarget {
  binary_path?: string;
  cwd?: string;
  args?: string[];
  env?: Record<string, string>;
  protocol?: string;
  transport_type?: TransportType;
  transport_config?: Record<string, unknown>;
  startup_timeout?: number;
  ready_check?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface DebugReplayConfig {
  mode?: "builtin_transport" | "script";
  script_ref?: string;
  runtime?: "python3" | "bash" | "native";
  args?: string[];
  env?: Record<string, string>;
  timeout_sec?: number;
}

export interface DebugPrepStep {
  argv: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export interface DebugSessionRequest {
  operation_id?: string;
  protocol: string;
  artifact_path: string;
  artifact_id?: string;
  job_id?: string;
  kb_entry_ids?: string[];
  source_doc_ids?: string[];
  target: DebugTarget;
  replay?: DebugReplayConfig;
  prep_steps?: DebugPrepStep[];
  run_mode?: "sync" | "async";
  analysis_mode?: "locate_only" | "full";
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

export interface DebugSourceExcerptLine {
  line: number;
  text: string;
  highlight?: boolean;
}

export interface DebugSourceExcerpt {
  start_line: number;
  highlight_line: number;
  end_line: number;
  lines: DebugSourceExcerptLine[];
}

export interface DebugLocationResult {
  primary_file_path?: string;
  primary_function?: string;
  primary_line?: number;
  frame_index?: number;
  thread_id?: string;
  source_workspace_ref?: string | null;
  source_available?: boolean;
  source_excerpt?: DebugSourceExcerpt | null;
  related_library_file?: string;
  confidence?: number;
  [key: string]: unknown;
}

export interface DebugFocus {
  frame_index?: number;
  thread_id?: string;
  function?: string;
  file_path?: string;
  line?: number;
  signal?: string;
  related_library_file?: string;
  [key: string]: unknown;
}

export interface DebugAgentProgressItem {
  at?: string;
  kind?: string;
  title?: string;
  message?: string;
  evidence?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface DebugEvidenceSummary {
  signal?: string;
  stack_summary?: string;
  crash_signature?: string;
  current_hypothesis?: string;
  focus_function?: string;
  focus_file?: string;
  related_library_file?: string;
  [key: string]: unknown;
}

export interface DebugFrame {
  index?: number;
  addr?: string;
  function?: string;
  file_path?: string;
  line?: number | null;
  library?: string;
  is_focus?: boolean;
  [key: string]: unknown;
}

export interface DebugRegister {
  name?: string;
  value?: string;
  display?: string;
  [key: string]: unknown;
}

export interface DebugLocal {
  name?: string;
  value?: string;
  raw?: string;
  [key: string]: unknown;
}

export interface DebugSharedLibrary {
  name?: string;
  path?: string;
  from_addr?: string;
  to_addr?: string;
  enabled?: boolean;
  [key: string]: unknown;
}

export interface DebugOutputStreams {
  can_separate_target_output?: boolean;
  target_stdout?: string;
  target_stderr?: string;
  gdb_transcript?: string;
  mixed_output?: string;
  stream_boundary?: string;
  [key: string]: unknown;
}

export interface DebugAgentCommandEntry {
  label?: string;
  command?: string;
  output_tail?: string;
  output_preview?: string;
  [key: string]: unknown;
}

export interface DebugReport {
  schema_version?: string;
  analysis_mode?: "locate_only" | "full" | string;
  session_id?: string;
  operation_id?: string;
  history_record_id?: string;
  protocol?: string;
  job_id?: string;
  artifact?: Record<string, unknown>;
  target?: DebugTarget;
  vulnerability_location?: VulnerabilityLocation;
  location_result?: DebugLocationResult;
  current_focus?: DebugFocus;
  agent_progress?: DebugAgentProgressItem[];
  latest_evidence_summary?: DebugEvidenceSummary;
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

export interface DebugSessionState {
  status?: string;
  at?: string;
  data?: unknown;
}

export interface DebugSession {
  session_id: string;
  protocol?: string;
  status?: string;
  operation_id?: string;
  created_at?: string;
  updated_at?: string;
  states?: DebugSessionState[];
  current_focus?: DebugFocus;
  agent_progress?: DebugAgentProgressItem[];
  latest_evidence_summary?: DebugEvidenceSummary;
  gdb_context?: {
    frames?: DebugFrame[];
    focus_frame?: DebugFrame | null;
    registers_map?: DebugRegister[];
    locals_map?: DebugLocal[];
    shared_libraries?: DebugSharedLibrary[];
    related_library_file?: string | null;
    backtrace?: string;
    frame_locals?: string;
    registers?: string;
    stdout_stderr_tail?: string;
    target_argv?: string[];
    source_location?: Record<string, unknown>;
    output_streams?: DebugOutputStreams;
    analysis_mode?: string;
    analysis_strategy?: string;
    evidence_mode?: string;
    gdb_used?: boolean;
    gdb_reason?: string;
    replay_result?: Record<string, unknown>;
    baseline_observation?: Record<string, unknown>;
    gdb_agent_commands?: DebugAgentCommandEntry[];
    [key: string]: unknown;
  };
  classification?: Record<string, unknown>;
  debug_report?: DebugReport;
  debug_report_path?: string;
  report_path?: string;
  history_record_id?: string;
  request?: DebugSessionRequest;
  [key: string]: unknown;
}

export interface DebugLiveSession {
  session_id: string;
  protocol?: string;
  status?: string;
  operation_id?: string;
  created_at?: string;
  updated_at?: string;
  states?: DebugSessionState[];
  current_focus?: DebugFocus;
  agent_progress?: DebugAgentProgressItem[];
  latest_evidence_summary?: DebugEvidenceSummary;
  location_result?: DebugLocationResult;
  history_record_id?: string;
  debug_report_path?: string;
  report_path?: string;
  frames?: DebugFrame[];
  focus_frame?: DebugFrame | null;
  registers_map?: DebugRegister[];
  locals_map?: DebugLocal[];
  shared_libraries?: DebugSharedLibrary[];
  related_library_file?: string;
  output_streams?: DebugOutputStreams;
  analysis_mode?: string;
  analysis_strategy?: string;
  evidence_mode?: string;
  gdb_used?: boolean;
  gdb_reason?: string;
  replay_result?: Record<string, unknown>;
  baseline_observation?: Record<string, unknown>;
  gdb_agent_commands?: DebugAgentCommandEntry[];
  [key: string]: unknown;
}

export interface DebugSummary {
  protocol: string;
  total: number;
  by_status: Record<string, number>;
  by_coarse_type: Record<string, number>;
  recent_sessions: DebugSession[];
}

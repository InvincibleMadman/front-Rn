export interface CorsConfig {
  enabled?: boolean;
  allow_origins?: string[];
  allow_origin_regex?: string | null;
  allow_credentials?: boolean;
  allow_methods?: string[];
  allow_headers?: string[];
  expose_headers?: string[];
  max_age?: number;
}

export interface WorkspaceConfig {
  root?: string;
  default_protocol?: string;
}

export interface ServerConfig {
  host?: string;
  port?: number;
  cors?: CorsConfig;
  http?: { host?: string; port?: number };
  uds?: { enabled?: boolean; path?: string };
}

export interface ModelConfig {
  protocol_extract?: string;
  risk_analysis?: string;
  seed_generation?: string;
  debug_reasoning?: string;
}

export interface LlmConfig {
  provider?: string;
  model?: string;
  base_url?: string;
  api_key?: string;
  api_key_env?: string;
  timeout_sec?: number;
  models?: ModelConfig;
}

export interface PathsConfig {
  afl_fuzz?: string;
  afl_showmap?: string;
  afl_cc?: string;
  afl_clang_fast?: string;
  cmake?: string;
  make?: string;
  ninja?: string;
  git?: string;
  preeny_desock?: string;
  workspace?: string;
  uploads_dir?: string;
  protocol_dir?: string;
  seed_dir?: string;
  risk_dir?: string;
  jobs_dir?: string;
  logs_dir?: string;
  temp_dir?: string;
  protocol_scan_dir?: string;
  risk_scan_dir?: string;
}

export interface DebuggerConfig {
  gdb_path?: string;
  timeout_sec?: number;
  allow_network_replay?: boolean;
}

export interface RuntimeInfo {
  resolved_afl_tools?: Record<string, string | null>;
}

export interface AppConfigResponse {
  workspace?: WorkspaceConfig;
  server?: ServerConfig;
  llm?: LlmConfig;
  paths?: PathsConfig;
  debugger?: DebuggerConfig;
  runtime_info?: RuntimeInfo;
  [key: string]: unknown;
}

export type ConfigPatchRequest = Partial<AppConfigResponse>;

export interface SystemInfoResponse {
  version?: string;
  system?: string;
  jobs_running?: number;
  jobs_total?: number;
  uds_path?: string;
  http?: { host?: string; port?: number };
  server?: { host?: string; port?: number };
  afl?: { configured_binary?: string; search_paths?: string[]; resolved_tools?: Record<string, string | null> };
  [key: string]: unknown;
}

export interface SystemCapabilitiesResponse {
  offline?: string[];
  jobs?: string[];
  config?: string[];
  debug?: string[];
  protocol_scoped_storage?: boolean;
  vuldoc_upload?: boolean;
  document_distillation?: boolean;
  knowledge_base?: boolean;
  kb_visualization?: string[];
  debugger?: string[];
  legacy_compat?: boolean;
  [key: string]: unknown;
}

export interface HealthResponse {
  ok?: boolean;
  message?: string;
  data?: unknown;
  [key: string]: unknown;
}

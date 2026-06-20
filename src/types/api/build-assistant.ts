export interface BuildFileInsight {
  kind: string;
  filename: string;
  path_ref: string;
}

export interface RuntimeToolDefinition {
  tool_id: string;
  label: string;
  binary_path: string;
  category: string;
  runner_compatible: boolean;
  requires_target: boolean;
  input_kind: string;
  output_kind: string;
  default_args: string[];
  notes: string[];
}

export interface CompilerDefinition {
  compiler_id: string;
  c_wrapper: string;
  cxx_wrapper: string;
  sanitizer_modes: string[];
  notes: string[];
}

export interface SanitizerModeDefinition {
  mode: string;
  label: string;
  env: Record<string, string>;
  description: string;
}

export interface BuildSuggestion {
  suggestion_id: string;
  label: string;
  build_system: string;
  phase: string;
  argv: string[];
  cwd_ref: string;
  env: Record<string, string>;
  confidence: number;
  reason: string;
  runnable: boolean;
}

export interface BuildProbe {
  protocol: string;
  source_ref: string;
  build_root_ref?: string;
  has_cmake: boolean;
  has_makefile: boolean;
  has_meson: boolean;
  has_configure: boolean;
  has_compile_commands: boolean;
  allowed_compilers: string[];
  allowed_tools: string[];
  build_files?: BuildFileInsight[];
  preferred_build_system?: string | null;
  runtime_tools?: RuntimeToolDefinition[];
  compiler_catalog?: CompilerDefinition[];
  sanitizer_modes?: SanitizerModeDefinition[];
  build_suggestions?: BuildSuggestion[];
  supported_runner_tools?: string[];
}

export interface BuildStep {
  name: string;
  cwd_ref: string;
  argv: string[];
  env: Record<string, string>;
}

export interface BuildPlan {
  plan_id: string;
  plan_hash: string;
  protocol: string;
  source_ref: string;
  compiler: string;
  instrumentation_mode: string;
  sanitizer_mode?: string;
  build_system?: string;
  use_llm: boolean;
  server_generated: true;
  created_by: string;
  created_at: string;
  steps: BuildStep[];
  warnings: string[];
  build_suggestions?: BuildSuggestion[];
  selected_suggestion_id?: string | null;
  build_root_ref?: string;
}

export interface TargetCandidate {
  target_id: string;
  name: string;
  binary_ref: string;
  cwd_ref: string;
  detected_io: "file_or_stdin" | "network_or_server" | "unknown";
  confidence: number;
}

export interface BuildRun {
  build_id: string;
  plan_id: string;
  protocol: string;
  status: "created" | "running" | "success" | "failed" | string;
  log_ref?: string | null;
  targets: TargetCandidate[];
  dicts: string[];
  compile_database_ref?: string | null;
  created_at?: string;
}

export interface LaunchProfile {
  profile_id: string;
  profile_hash: string;
  protocol: string;
  build_id?: string;
  target_id?: string;
  binary_ref: string;
  cwd_ref?: string;
  input_ref?: string;
  output_ref?: string;
  dict_ref?: string | null;
  input_mode: "stdin" | "file_argv" | "fixed_file" | "network_desock" | "unknown" | string;
  afl_tool_id: string;
  afl_args: string[];
  target_cmd: string[];
  env: Record<string, string>;
  server_generated: true;
  created_by: string;
  created_at: string;
  warnings: string[];
  explanation: string[];
  runner_compatible?: boolean;
  command_preview?: string[];
  parameter_hints?: {
    input_kind?: string;
    output_kind?: string;
    requires_target?: boolean;
  };
  sanitizer_mode?: string;
}

export interface BuildProbe {
  protocol: string;
  source_ref: string;
  has_cmake: boolean;
  has_makefile: boolean;
  has_meson: boolean;
  has_configure: boolean;
  has_compile_commands: boolean;
  allowed_compilers: string[];
  allowed_tools: string[];
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
  use_llm: boolean;
  server_generated: true;
  created_by: string;
  created_at: string;
  steps: BuildStep[];
  warnings: string[];
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
  input_mode: "stdin" | "file_argv" | "fixed_file" | "network_desock" | "unknown";
  afl_tool_id: string;
  afl_args: string[];
  target_cmd: string[];
  env: Record<string, string>;
  server_generated: true;
  created_by: string;
  created_at: string;
  warnings: string[];
  explanation: string[];
}

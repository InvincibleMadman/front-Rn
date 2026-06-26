export interface WithOperationId {
  operation_id?: string;
  [key: string]: unknown;
}

export interface ProtocolAnalyzeRequest extends WithOperationId {
  protocol: string;
  source_path?: string | null;
  source_ref?: string | null;
  output_path?: string | null;
  output_ref?: string | null;
  spec_path?: string | null;
  name?: string;
  content?: string;
  spec?: string;
  use_llm?: boolean;
}

export interface ProtocolSpecField {
  name?: string;
  role?: string;
  [key: string]: unknown;
}
export interface ProtocolMessage {
  name?: string;
  fields?: ProtocolSpecField[];
  [key: string]: unknown;
}
export interface SeedTemplate {
  name?: string;
  format?: string[];
  [key: string]: unknown;
}
export interface ProtocolSpec {
  schema_version?: string;
  generated_at?: string;
  source_path?: string;
  protocol?: string;
  protocol_name?: string;
  messages?: ProtocolMessage[];
  seed_templates?: SeedTemplate[];
  [key: string]: unknown;
}
export interface ProtocolAnalyzeResponse {
  protocol?: string | ProtocolSpec;
  protocol_name?: string;
  spec_id?: string;
  path?: string;
  output_path?: string;
  spec_path?: string;
  copied_to?: string | null;
  operation_id?: string;
  [key: string]: unknown;
}

export interface SeedGenerateRequest extends WithOperationId {
  protocol: string;
  spec_path?: string | null;
  spec_ref?: string | null;
  spec_dir?: string | null;
  keyword?: string | null;
  count?: number;
  output_dir?: string | null;
  output_ref?: string | null;
  allow_fallback?: boolean;
  use_kb_assist?: boolean;
  issue_doc_dir?: string | null;
  use_uploaded_vuldocs?: boolean;
}

export interface SeedGenerateResponse {
  protocol?: string;
  generation_mode?: "spec_only" | "spec_plus_kb" | "kb_only_fallback" | "raw_doc_fallback" | "degraded_no_spec" | string;
  seeds?: unknown[];
  used_spec_id?: string;
  used_vuldoc_ids?: string[];
  used_kb_entry_ids?: string[];
  confidence?: number;
  warnings?: string[];
  output_dir?: string;
  created_at?: string;
  operation_id?: string;
  mode?: string;
  spec_path?: string | null;
  text_output_dir?: string;
  bin_output_dir?: string | null;
  text_files?: string[];
  bin_files?: string[];
  [key: string]: unknown;
}

export type RiskChunkStrategy = "function" | "file" | "hybrid" | string;

export interface RiskAnalyzeRequest extends WithOperationId {
  protocol: string;
  source_path?: string | null;
  source_ref?: string | null;
  output_path?: string | null;
  output_ref?: string | null;
  max_workers?: number;
  llm_concurrency?: number;
  chunk_strategy?: RiskChunkStrategy;
  use_llm?: boolean;
  use_static_prefilter?: boolean;
  timeout_sec?: number;
}

export interface RiskRecommendedProbe {
  kind?: string;
  [key: string]: unknown;
}

export interface RiskFinding {
  id?: string;
  file_path?: string;
  file?: string;
  function_name?: string;
  line_start?: number;
  line_end?: number;
  line?: number;
  severity?: string;
  severity_level?: number;
  confidence?: number;
  confidence_score?: number;
  risk_type?: string;
  pattern?: string;
  code?: string;
  reason?: string;
  recommended_probe?: RiskRecommendedProbe;
  [key: string]: unknown;
}

export interface RiskFailedChunk {
  chunk_id?: string;
  file_path?: string;
  function_name?: string;
  reason?: string;
  error?: string;
  [key: string]: unknown;
}

export interface RiskSummary {
  total_files?: number;
  selected_files?: number;
  total_functions?: number;
  total_chunks?: number;
  completed_chunks?: number;
  failed_chunks?: number;
  total_findings?: number;
  cache_hits?: number;
  duration_ms?: number;
  [key: string]: unknown;
}

export interface RiskAnalysis {
  summary?: RiskSummary;
  total_findings?: number;
  findings?: RiskFinding[];
  failed_chunks?: RiskFailedChunk[];
  warnings?: string[];
  [key: string]: unknown;
}

export interface RiskAnalyzeResponse {
  schema_version?: string;
  protocol?: string;
  operation_id?: string;
  source_path?: string;
  status?: "finished" | "partial" | "failed" | string;
  path?: string;
  output_path?: string;
  result_path?: string;
  copied_to?: string | null;
  summary?: RiskSummary;
  findings?: RiskFinding[];
  failed_chunks?: RiskFailedChunk[];
  warnings?: string[];
  analysis?: RiskAnalysis;
  items?: RiskFinding[];
  [key: string]: unknown;
}

export interface RiskPreviewRequest extends WithOperationId {
  protocol: string;
  analysis_path?: string | null;
  analysis_ref?: string | null;
}
export interface RiskPreviewResponse {
  status?: string;
  preview?: string;
  size?: number;
  analysis_path?: string;
  operation_id?: string;
  findings?: RiskFinding[];
  items?: RiskFinding[];
  [key: string]: unknown;
}

export interface RiskUploadResponse {
  saved_path?: string;
  mirrored_to?: string;
  path?: string;
  filename?: string;
  size?: number;
  operation_id?: string;
  [key: string]: unknown;
}

export interface InstrumentRequest extends WithOperationId {
  protocol: string;
  source_path?: string | null;
  source_ref?: string | null;
  analysis_path?: string | null;
  analysis_ref?: string | null;
  output_path?: string | null;
  output_ref?: string | null;
  in_place?: boolean;
  compile_check?: boolean;
  strict_ast_validation?: boolean;
}

export interface InstrumentInsertion {
  file_path?: string;
  function_name?: string;
  line?: number;
  line_start?: number;
  line_end?: number;
  marker?: string;
  reason?: string;
  severity?: string;
  risk_type?: string;
  [key: string]: unknown;
}

export interface CompileCheckResult {
  enabled?: boolean;
  passed?: boolean;
  checked_files?: string[];
  failures?: Array<{ file_path?: string; command?: string; stderr?: string; reason?: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

export interface InstrumentResponse {
  protocol?: string;
  output_path?: string | null;
  analysis_path?: string;
  instrumented_files?: string[];
  changed_files?: string[];
  inserted_markers?: number;
  generated_at?: string;
  in_place?: boolean;
  copied_source_tree?: boolean;
  applied_insertions?: InstrumentInsertion[];
  rejected_insertions?: InstrumentInsertion[];
  validation_warnings?: string[];
  compile_check?: CompileCheckResult;
  plan_path?: string;
  report_path?: string;
  operation_id?: string;
  [key: string]: unknown;
}

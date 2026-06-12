export interface VulDocRecord {
  doc_id: string;
  protocol?: string;
  filename?: string;
  raw_path?: string;
  sha256?: string;
  size?: number;
  source?: string;
  created_at?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface VulDocUploadResponse {
  protocol: string;
  operation_id?: string;
  documents: VulDocRecord[];
  [key: string]: unknown;
}

export interface KbEntry {
  entry_id?: string;
  vuln_id?: string;
  protocol?: string;
  doc_id?: string;
  title?: string;
  summary?: string;
  source_type?: string;
  source_ref?: string;
  affected_versions?: string[];
  vuln_type?: string;
  coarse_type?: string;
  cwe?: string;
  trigger_condition?: string;
  input_shape?: string;
  message_fields?: unknown[];
  sink_function?: string;
  file_path?: string;
  function_name?: string;
  evidence?: unknown[];
  poc_hint?: string;
  fix_hint?: string;
  confidence?: number;
  tags?: string[];
  [key: string]: unknown;
}

export interface VulDocDistillResponse {
  protocol: string;
  operation_id?: string;
  entries: KbEntry[];
  [key: string]: unknown;
}

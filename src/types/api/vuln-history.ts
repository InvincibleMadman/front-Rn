export type CoarseVulnType =
  | "memory-corruption"
  | "bounds-check"
  | "null-deref"
  | "use-after-free"
  | "integer-issue"
  | "parser-state"
  | "auth-logic"
  | "resource-exhaustion"
  | "protocol-state-machine"
  | "unknown";

export interface VulnHistoryRecord {
  record_id?: string;
  id?: string;
  title?: string;
  protocol?: string;
  coarse_type?: string;
  vuln_type?: string;
  cwe?: string;
  file?: string;
  file_path?: string;
  function?: string;
  function_name?: string;
  line?: number;
  confidence?: number;
  created_at?: string;
  crash_signature?: string;
  root_cause?: string;
  direct_cause?: string;
  stack_summary?: string;
  repro_steps?: unknown[];
  poc_concept?: string;
  fix_suggestion?: string;
  source_doc_ids?: string[];
  kb_entry_ids?: string[];
  debug_session_id?: string;
  artifact_id?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface VulnHistoryListResponse {
  items?: VulnHistoryRecord[];
  records?: VulnHistoryRecord[];
  total?: number;
  limit?: number;
  offset?: number;
  [key: string]: unknown;
}

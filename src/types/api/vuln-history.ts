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
  updated_at?: string;
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
  mode?: "global" | "protocol" | string;
  protocol?: string | null;
  [key: string]: unknown;
}

export interface VulnSummary {
  mode: "global" | "protocol" | string;
  protocol?: string | null;
  total: number;
  open_findings: number;
  high_confidence: number;
  linked_debug: number;
  linked_crash: number;
  archived: number;
  unlinked_records: number;
  latest_updated_at?: string | null;
  by_coarse_type: Record<string, number>;
  by_cwe: Record<string, number>;
  closure_status: Record<string, number>;
  recent_records: VulnHistoryRecord[];
}

export interface VulnTrendPoint {
  bucket: string;
  total: number;
  high_confidence: number;
  memory_related: number;
}

export interface VulnTrendResponse {
  mode: "global" | "protocol" | string;
  protocol?: string | null;
  items: VulnTrendPoint[];
  closure_status: Record<string, number>;
}

export interface VulnQuery {
  protocol?: string;
  keyword?: string;
  coarse_type?: string;
  cwe?: string;
  confidence?: "high" | "medium" | "low";
  linked_debug?: boolean;
  linked_crash?: boolean;
  limit?: number;
  offset?: number;
  sort?: string;
  order?: "asc" | "desc";
}

export interface ReportSummary {
  protocol: string;
  reports_count: number;
  latest_reports: ReportRecord[];
  vulnerability_count: number;
  debug_session_count: number;
  build_run_count: number;
  launch_profile_count: number;
  source_ready: boolean;
  source_ref?: string;
  coverage?: {
    percent: number;
    label: string;
    ready_sections: number;
    partial_sections: number;
    missing_sections: number;
    total_sections: number;
  };
  asset_counts?: Record<string, number>;
  readiness_tree?: ReportReadinessNode;
  missing_highlights?: ReportMissingHighlight[];
  latest_generated_at?: string | null;
}

export interface ReportRecord {
  report_id: string;
  protocol: string;
  title: string;
  created_at?: string;
  pdf_ref: string;
  size?: number;
  summary?: Record<string, unknown>;
  coverage_percent?: number;
  ready_sections?: number;
  total_sections?: number;
  missing_sections?: number;
}

export interface ReportReadinessNode {
  id: string;
  title: string;
  status: string;
  available?: boolean;
  count?: number | null;
  summary?: string | null;
  detail?: string | null;
  workspace_ref?: string | null;
  route_hint?: string | null;
  children?: ReportReadinessNode[];
}

export interface ReportMissingHighlight {
  id: string;
  title: string;
  status: string;
  reason: string;
  action_label?: string | null;
  route_hint?: string | null;
}

export interface ReportPreview {
  protocol: string;
  coverage: {
    percent: number;
    label: string;
    ready_sections: number;
    partial_sections: number;
    missing_sections: number;
    total_sections: number;
  };
  asset_counts: Record<string, number>;
  readiness_tree: ReportReadinessNode;
  missing_highlights: ReportMissingHighlight[];
  latest_generated_at?: string | null;
  generation_summary: {
    protocol: string;
    output_ref?: string | null;
    will_generate_sections: number;
    auto_explanation_sections: number;
    still_missing_sections: number;
  };
  asset_preview: {
    workspace_refs: Record<string, string | null | undefined>;
    asset_counts: Record<string, number>;
    vulnerability_records: Array<Record<string, unknown>>;
    debug_sessions: Array<Record<string, unknown>>;
    build_runs: Array<Record<string, unknown>>;
    launch_profiles: Array<Record<string, unknown>>;
    historical_reports: ReportRecord[];
  };
  missing_explanation_preview: Array<{
    id: string;
    title: string;
    status: string;
    reason: string;
    sample_text: string;
    route_hint?: string | null;
    action_label?: string | null;
  }>;
}


export interface ReportSectionPreview {
  id: string;
  title: string;
  status?: string;
}

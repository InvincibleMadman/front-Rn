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
}

export interface ReportRecord {
  report_id: string;
  protocol: string;
  title: string;
  created_at?: string;
  pdf_ref: string;
  size?: number;
  summary?: Record<string, unknown>;
}

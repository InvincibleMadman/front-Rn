export interface DashboardNodeSummary {
  node_id: string;
  name: string;
  status: "online" | "offline" | string;
  protocol_count: number;
  running_jobs: number;
  crash_count: number;
  vulnerability_count: number;
  debug_session_count: number;
  report_count: number;
  last_seen_at?: string | null;
  error?: string;
}

export interface DashboardRecentJob {
  job_id?: string;
  status?: string;
  protocol?: string;
  target?: string;
  updated_at?: string | number | null;
}

export interface DashboardRecentFinding {
  job_id?: string;
  artifact_id?: string;
  name?: string;
  kind: "crash" | "hang";
  protocol?: string;
  size?: number;
  mtime?: number | string | null;
}

export interface DashboardTrendPoint {
  time: string;
  value: number;
}

export interface DashboardCrashTrendPoint {
  time: string;
  crashes: number;
  hangs: number;
}

export interface DashboardMetricOverview {
  nodeStatus: {
    total: number;
    online: number;
    offline: number;
    checking: number;
    onlineRate: number;
    onlinePercent: number;
  };
  protocolAssets: {
    total: number;
    byScope: Record<string, number>;
    byKind: Record<string, number>;
    protocolCount: number;
  };
  runningJobs: {
    running: number;
    total: number;
    byStatus: Record<string, number>;
    recentJobs: DashboardRecentJob[];
    trend: DashboardTrendPoint[];
  };
  crashFindings: {
    crashes: number;
    hangs: number;
    totalFindings: number;
    byKind: {
      crash: number;
      hang: number;
    };
    recentFindings: DashboardRecentFinding[];
    trend: DashboardCrashTrendPoint[];
  };
  vulnerabilities: {
    total: number;
    highConfidence: number;
    byCoarseType: Record<string, number>;
    byCwe: Record<string, number>;
    recentRecords: Array<Record<string, unknown>>;
  };
  debugSessions: {
    total: number;
    byStatus: Record<string, number>;
    byCoarseType: Record<string, number>;
  };
  reports: {
    total: number;
    byKind: Record<string, number>;
    recentReports: Array<Record<string, unknown>>;
  };
}

export interface DashboardRecentEvent {
  type: string;
  node_id: string;
  node_name: string;
  status: string;
  label: string;
  updated_at?: string | null;
}

export interface DashboardOverviewApiResponse {
  global: {
    node_count: number;
    online_nodes: number;
    protocol_count: number;
    running_jobs: number;
    crash_count: number;
    vulnerability_count: number;
    debug_session_count: number;
    report_count: number;
  };
  nodes: DashboardNodeSummary[];
  current_node: {
    node_id: string | null;
    protocol_graph: {
      nodes: Array<{ id: string; name: string; category?: string }>;
      edges: Array<{ source: string; target: string }>;
    };
    job_trend: Array<{ status: string; value: number }>;
    vulnerability_distribution: Array<{ name: string; value: number }>;
    recent_events: DashboardRecentEvent[];
  };
  cross_node: {
    task_distribution: Array<{ name: string; value: number }>;
    vulnerability_distribution: Array<{ name: string; value: number }>;
    crash_distribution: Array<{ name: string; value: number }>;
    recent_events: DashboardRecentEvent[];
  };
  nodeStatus?: DashboardMetricOverview["nodeStatus"];
  protocolAssets?: DashboardMetricOverview["protocolAssets"];
  runningJobs?: DashboardMetricOverview["runningJobs"];
  crashFindings?: DashboardMetricOverview["crashFindings"];
  vulnerabilities?: DashboardMetricOverview["vulnerabilities"];
  debugSessions?: DashboardMetricOverview["debugSessions"];
  reports?: DashboardMetricOverview["reports"];
}

export interface DashboardOverviewResponse extends DashboardOverviewApiResponse {
  metrics: DashboardMetricOverview;
}

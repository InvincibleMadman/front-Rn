import { apiClient } from "@/lib/api/client";
import type { DashboardMetricOverview, DashboardOverviewApiResponse, DashboardOverviewResponse } from "@/types/api/dashboard";

function toSafeNumber(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toRecordOfNumbers(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries: Array<[string, number]> = [];
  for (const [key, item] of Object.entries(value)) {
    const number = toSafeNumber(item, 0);
    if (number >= 0) entries.push([key, number]);
  }
  return Object.fromEntries(entries);
}

function toRecentObjects(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)).map((item) => ({ ...item }))
    : [];
}

function normalizeDashboardOverview(data: DashboardOverviewApiResponse): DashboardMetricOverview {
  const global = data.global ?? {
    node_count: 0,
    online_nodes: 0,
    protocol_count: 0,
    running_jobs: 0,
    crash_count: 0,
    vulnerability_count: 0,
    debug_session_count: 0,
    report_count: 0,
  };

  const nodeStatus = data.nodeStatus ?? {
    total: toSafeNumber(global.node_count, 0),
    online: toSafeNumber(global.online_nodes, 0),
    offline: Math.max(toSafeNumber(global.node_count, 0) - toSafeNumber(global.online_nodes, 0), 0),
    checking: 0,
    onlineRate: toSafeNumber(global.node_count, 0) > 0 ? toSafeNumber(global.online_nodes, 0) / toSafeNumber(global.node_count, 0) : 0,
    onlinePercent: toSafeNumber(global.node_count, 0) > 0 ? Math.round((toSafeNumber(global.online_nodes, 0) / toSafeNumber(global.node_count, 0)) * 100) : 0,
  };

  const protocolAssets = data.protocolAssets ?? {
    total: toSafeNumber(global.protocol_count, 0),
    byScope: {},
    byKind: {},
    protocolCount: toSafeNumber(global.protocol_count, 0),
  };

  const runningJobs = data.runningJobs ?? {
    running: toSafeNumber(global.running_jobs, 0),
    total: toSafeNumber(global.running_jobs, 0),
    byStatus: {},
    recentJobs: [],
    trend: [],
  };

  const crashFindings = data.crashFindings ?? {
    crashes: toSafeNumber(global.crash_count, 0),
    hangs: 0,
    totalFindings: toSafeNumber(global.crash_count, 0),
    byKind: { crash: toSafeNumber(global.crash_count, 0), hang: 0 },
    recentFindings: [],
    trend: [],
  };

  const vulnerabilities = data.vulnerabilities ?? {
    total: toSafeNumber(global.vulnerability_count, 0),
    highConfidence: 0,
    byCoarseType: {},
    byCwe: {},
    recentRecords: [],
  };

  const debugSessions = data.debugSessions ?? {
    total: toSafeNumber(global.debug_session_count, 0),
    byStatus: {},
    byCoarseType: {},
  };

  const reports = data.reports ?? {
    total: toSafeNumber(global.report_count, 0),
    byKind: {},
    recentReports: [],
  };

  const normalizedNodeStatus = {
    total: toSafeNumber(nodeStatus.total, 0),
    online: toSafeNumber(nodeStatus.online, 0),
    offline: toSafeNumber(nodeStatus.offline, 0),
    checking: toSafeNumber(nodeStatus.checking, 0),
    onlineRate: toSafeNumber(nodeStatus.total, 0) > 0 ? toSafeNumber(nodeStatus.online, 0) / toSafeNumber(nodeStatus.total, 0) : 0,
    onlinePercent: toSafeNumber(nodeStatus.total, 0) > 0 ? Math.round((toSafeNumber(nodeStatus.online, 0) / toSafeNumber(nodeStatus.total, 0)) * 100) : 0,
  };

  return {
    nodeStatus: normalizedNodeStatus,
    protocolAssets: {
      total: Math.max(toSafeNumber(protocolAssets.total, 0), 0),
      byScope: toRecordOfNumbers(protocolAssets.byScope),
      byKind: toRecordOfNumbers(protocolAssets.byKind),
      protocolCount: Math.max(toSafeNumber(protocolAssets.protocolCount, 0), 0),
    },
    runningJobs: {
      running: Math.max(toSafeNumber(runningJobs.running, 0), 0),
      total: Math.max(toSafeNumber(runningJobs.total, 0), 0),
      byStatus: toRecordOfNumbers(runningJobs.byStatus),
      recentJobs: Array.isArray(runningJobs.recentJobs) ? runningJobs.recentJobs : [],
      trend: Array.isArray(runningJobs.trend)
        ? runningJobs.trend.map((item) => ({ time: String(item?.time ?? ""), value: Math.max(toSafeNumber(item?.value, 0), 0) })).filter((item) => item.time)
        : [],
    },
    crashFindings: {
      crashes: Math.max(toSafeNumber(crashFindings.crashes, 0), 0),
      hangs: Math.max(toSafeNumber(crashFindings.hangs, 0), 0),
      totalFindings: Math.max(toSafeNumber(crashFindings.totalFindings, toSafeNumber(crashFindings.crashes, 0) + toSafeNumber(crashFindings.hangs, 0)), 0),
      byKind: {
        crash: Math.max(toSafeNumber(crashFindings.byKind?.crash, toSafeNumber(crashFindings.crashes, 0)), 0),
        hang: Math.max(toSafeNumber(crashFindings.byKind?.hang, toSafeNumber(crashFindings.hangs, 0)), 0),
      },
      recentFindings: Array.isArray(crashFindings.recentFindings) ? crashFindings.recentFindings : [],
      trend: Array.isArray(crashFindings.trend)
        ? crashFindings.trend
          .map((item) => ({
            time: String(item?.time ?? ""),
            crashes: Math.max(toSafeNumber(item?.crashes, 0), 0),
            hangs: Math.max(toSafeNumber(item?.hangs, 0), 0),
          }))
          .filter((item) => item.time)
        : [],
    },
    vulnerabilities: {
      total: Math.max(toSafeNumber(vulnerabilities.total, 0), 0),
      highConfidence: Math.max(toSafeNumber(vulnerabilities.highConfidence, 0), 0),
      byCoarseType: toRecordOfNumbers(vulnerabilities.byCoarseType),
      byCwe: toRecordOfNumbers(vulnerabilities.byCwe),
      recentRecords: toRecentObjects(vulnerabilities.recentRecords),
    },
    debugSessions: {
      total: Math.max(toSafeNumber(debugSessions.total, 0), 0),
      byStatus: toRecordOfNumbers(debugSessions.byStatus),
      byCoarseType: toRecordOfNumbers(debugSessions.byCoarseType),
    },
    reports: {
      total: Math.max(toSafeNumber(reports.total, 0), 0),
      byKind: toRecordOfNumbers(reports.byKind),
      recentReports: toRecentObjects(reports.recentReports),
    },
  };
}

export const dashboardApi = {
  async getOverview(): Promise<DashboardOverviewResponse> {
    const response = await apiClient.requestEnvelope<DashboardOverviewApiResponse>("/web-api/dashboard/overview", {
      credentials: "include",
    });
    return {
      ...response.data,
      metrics: normalizeDashboardOverview(response.data),
    };
  },
};

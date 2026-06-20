import type { Job } from "@/types/api/jobs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function jobRequest(job?: Job | null): Record<string, unknown> {
  return job && isRecord(job.request) ? job.request : {};
}

export function jobMetadata(job?: Job | null): Record<string, unknown> {
  return job && isRecord(job.metadata) ? job.metadata : {};
}

export function jobString(job: Job | null | undefined, key: string): string | undefined {
  const request = jobRequest(job);
  const value = request[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function jobBoolean(job: Job | null | undefined, key: string): boolean | undefined {
  const request = jobRequest(job);
  const value = request[key];
  return typeof value === "boolean" ? value : undefined;
}

export function jobName(job?: Job | null): string {
  return job?.name ?? jobString(job, "name") ?? job?.job_id ?? "未命名任务";
}

export function jobProtocol(job?: Job | null): string {
  return job?.protocol ?? jobString(job, "protocol") ?? "legacy-default";
}

export function jobNode(job?: Job | null): string {
  const metadata = jobMetadata(job);
  const metaNode = typeof metadata.node_name === "string" ? metadata.node_name : undefined;
  return jobString(job, "node_name") ?? metaNode ?? "未指定";
}

export function jobScheduler(job?: Job | null): string {
  const metadata = jobMetadata(job);
  const metaScheduler = typeof metadata.scheduler === "string" ? metadata.scheduler : undefined;
  return jobString(job, "scheduler") ?? metaScheduler ?? "auto";
}

export function jobRiskEnabled(job?: Job | null): boolean {
  const metadata = jobMetadata(job);
  const metaRisk = typeof metadata.risk_enabled === "boolean" ? metadata.risk_enabled : undefined;
  return jobBoolean(job, "risk_enabled") ?? metaRisk ?? false;
}

export function jobTargetBinary(job?: Job | null): string {
  const request = jobRequest(job);
  const requestCmd = Array.isArray(request.target_cmd) ? request.target_cmd.map(String) : undefined;
  return job?.target_cmd?.[0] ?? requestCmd?.[0] ?? job?.afl?.target_binary ?? "—";
}

export function jobTarget(job?: Job | null): string {
  const request = jobRequest(job);
  const requestCmd = Array.isArray(request.target_cmd) ? request.target_cmd.map(String) : undefined;
  if (job?.target_cmd?.length) return job.target_cmd.join(" ");
  if (requestCmd?.length) return requestCmd.join(" ");
  return job?.afl?.target_binary ?? "—";
}

export function jobAflBinary(job?: Job | null): string {
  return job?.afl_path ?? jobString(job, "afl_path") ?? job?.afl?.afl_binary ?? "afl-fuzz";
}

export function jobWorkers(job?: Job | null): number {
  const request = jobRequest(job);
  const requested = typeof request.workers === "number" ? request.workers : undefined;
  return job?.afl?.workers ?? requested ?? 1;
}

export function jobExecs(job?: Job | null): number {
  return Number(job?.last_metrics?.execs_done ?? job?.metrics?.execs_done ?? 0);
}

export function jobCoverage(job?: Job | null): number {
  return Number(job?.last_metrics?.paths_total ?? job?.metrics?.paths_total ?? job?.last_metrics?.bitmap_cvg ?? 0);
}

export function jobCrashes(job?: Job | null): number {
  return Number(job?.last_metrics?.unique_crashes ?? job?.metrics?.unique_crashes ?? 0);
}

export function jobHangs(job?: Job | null): number {
  return Number(job?.last_metrics?.unique_hangs ?? job?.metrics?.unique_hangs ?? 0);
}

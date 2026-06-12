import { Link } from "react-router-dom";
import { StatusBadge } from "@/components/common/status-badge";
import type { Job } from "@/types/api/jobs";

const UTC8_OFFSET_MS = 8 * 60 * 60 * 1000;

function parseTime(value?: string | null): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function formatUtc8(ms?: number | null): string {
  if (!ms || !Number.isFinite(ms)) return "—";
  const date = new Date(ms + UTC8_OFFSET_MS);
  const pad = (input: number): string => String(input).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC+8`;
}

function jobName(job: Job): string {
  return job.name ?? job.job_id;
}

interface TimelineItem {
  job: Job;
  start: number;
  end: number;
}

function toTimelineItem(job: Job, now: number): TimelineItem {
  const start = parseTime(job.created_at) ?? parseTime(job.updated_at) ?? now;
  const end =
    parseTime(String(job.finished_at ?? "")) ??
    parseTime(String(job.stopped_at ?? "")) ??
    parseTime(job.updated_at) ??
    now;
  return { job, start: Math.min(start, end), end: Math.max(start, end) };
}

export function TaskTimelineChart({ jobs }: { jobs: Job[] }): JSX.Element {
  const now = Date.now();
  const items = jobs
    .slice()
    .sort((a, b) => (parseTime(b.updated_at) ?? parseTime(b.created_at) ?? 0) - (parseTime(a.updated_at) ?? parseTime(a.created_at) ?? 0))
    .slice(0, 4)
    .map((job) => toTimelineItem(job, now));

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">暂无任务时间线。</p>;
  }

  const minStart = Math.min(...items.map((item) => item.start));
  const maxEnd = Math.max(...items.map((item) => item.end), minStart + 60_000);
  const span = Math.max(maxEnd - minStart, 60_000);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{formatUtc8(minStart)}</span>
        <span>{formatUtc8(maxEnd)}</span>
      </div>
      <div className="space-y-3">
        {items.map(({ job, start, end }) => {
          const left = Math.max(0, ((start - minStart) / span) * 100);
          const width = Math.max(4, ((end - start) / span) * 100);
          return (
            <Link key={job.job_id} to={`/jobs/${job.job_id}`} className="block rounded-xl border border-border/60 bg-background/50 p-3 transition-colors hover:bg-muted/30">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{jobName(job)}</p>
                  <p className="text-xs text-muted-foreground">{formatUtc8(start)} → {formatUtc8(end)}</p>
                </div>
                <StatusBadge status={job.status} />
              </div>
              <div className="relative h-3 overflow-hidden rounded-full bg-muted/70">
                <div
                  className="absolute top-0 h-full rounded-full bg-primary/70"
                  style={{ left: `${Math.min(left, 96)}%`, width: `${Math.min(width, 100 - Math.min(left, 96))}%` }}
                />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

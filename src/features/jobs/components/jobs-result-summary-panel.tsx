import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Job, JobsSummary } from "@/types/api/jobs";
import { formatDateTime } from "@/lib/utils/format";

export function JobsResultSummaryPanel({ jobs, summary }: { jobs: Job[]; summary?: JobsSummary }): JSX.Element {
  const latest = [...jobs].sort((a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? ""))).slice(0, 5);
  const byProtocol = Object.entries(summary?.by_protocol ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return (
    <Card className="card-surface h-full">
      <CardHeader className="pb-3"><CardTitle className="text-base">筛选结果摘要</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-1">
          <div className="rounded-[var(--radius-lg)] border border-border/60 bg-background/55 px-3 py-3">
            <p className="text-xs text-muted-foreground">结果数量</p>
            <p className="mt-1 text-2xl font-semibold">{jobs.length}</p>
          </div>
          <div className="rounded-[var(--radius-lg)] border border-border/60 bg-background/55 px-3 py-3">
            <p className="text-xs text-muted-foreground">运行中占比</p>
            <p className="mt-1 text-2xl font-semibold">{summary?.total ? Math.round((summary.running / summary.total) * 100) : 0}%</p>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">协议分布 Top N</p>
          {byProtocol.map(([name, value]) => (
            <div key={name} className="flex items-center justify-between rounded-[var(--radius-lg)] border border-border/60 bg-background/55 px-3 py-2">
              <span>{name}</span><span className="font-semibold">{value}</span>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">最近更新任务</p>
          {latest.map((job) => (
            <div key={job.job_id} className="rounded-[var(--radius-lg)] border border-border/60 bg-background/55 px-3 py-2">
              <p className="font-medium">{job.name ?? job.job_id}</p>
              <p className="mt-1 text-xs text-muted-foreground">{job.protocol} · {formatDateTime(job.updated_at)}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

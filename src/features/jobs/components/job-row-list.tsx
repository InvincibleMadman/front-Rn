import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { formatDateTime, formatNumber } from "@/lib/utils/format";
import type { Job } from "@/types/api/jobs";

function req(job: Job, key: string): unknown {
  return typeof job.request === "object" && job.request ? job.request[key] : undefined;
}

function command(job: Job): string {
  return job.command?.join(" ") ?? (Array.isArray(req(job, "target_cmd")) ? (req(job, "target_cmd") as string[]).join(" ") : "—");
}

export function JobRowList({ jobs }: { jobs: Job[] }): JSX.Element {
  if (!jobs.length) return <EmptyState title="暂无匹配任务" description="调整筛选条件或先创建新的 Fuzz 任务。" />;
  return (
    <div className="space-y-3">
      {jobs.map((job) => {
        const metrics = job.last_metrics ?? {};
        const riskEnabled = Boolean(req(job, "risk_enabled"));
        return (
          <Card key={job.job_id} className="card-surface p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={job.status} />
                  <p className="font-semibold">{job.name ?? job.job_id}</p>
                  <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-xs text-muted-foreground">{job.protocol ?? "legacy-default"}</span>
                  {riskEnabled ? <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs text-primary"><ShieldCheck className="size-3.5" />Risk</span> : null}
                </div>
                <div className="grid gap-2 text-sm text-muted-foreground xl:grid-cols-[1.1fr_0.9fr_0.9fr]">
                  <p className="truncate">{command(job)}</p>
                  <p className="truncate">AFL：{String(req(job, "afl_path") ?? job.afl_path ?? "afl-fuzz")}</p>
                  <p className="truncate">workers {String(req(job, "workers") ?? 1)} · scheduler {String(req(job, "scheduler") ?? "未指定")}</p>
                </div>
                <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-5">
                  <p>execs {formatNumber(Number(metrics.execs_done ?? 0))}</p>
                  <p>coverage {formatNumber(Number(metrics.bitmap_cvg ?? 0))}%</p>
                  <p>crash {formatNumber(Number(metrics.unique_crashes ?? 0))}</p>
                  <p>hang {formatNumber(Number(metrics.unique_hangs ?? 0))}</p>
                  <p>更新于 {formatDateTime(job.updated_at)}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 self-start">
                <Link to={`/jobs/${job.job_id}`}>
                  <Button variant="secondary" size="sm">
                    查看详情 <ArrowRight className="size-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

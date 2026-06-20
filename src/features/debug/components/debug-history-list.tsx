import { RefreshCcw, Search, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/common/status-badge";
import { formatDateTime } from "@/lib/utils/format";
import type { DebugHistoryListItem } from "@/features/debug/debug-types";

export function DebugHistoryList({
  items,
  keyword,
  coarseType,
  onKeywordChange,
  onCoarseTypeChange,
  onSelect,
  onRefill,
}: {
  items: DebugHistoryListItem[];
  keyword: string;
  coarseType: string;
  onKeywordChange: (value: string) => void;
  onCoarseTypeChange: (value: string) => void;
  onSelect: (sessionId: string) => void;
  onRefill: (sessionId: string) => void;
}): JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">记录页</p>
          <p className="mt-1 text-sm text-foreground">历史会话优先服务于复看、切监控、回填重跑。</p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row">
          <div className="relative min-w-[16rem]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={keyword} onChange={(e) => onKeywordChange(e.target.value)} className="pl-9" placeholder="搜索 session / 函数 / 文件 / coarse type" />
          </div>
          <Input value={coarseType} onChange={(e) => onCoarseTypeChange(e.target.value)} placeholder="coarse type 过滤" className="md:w-[13rem]" />
        </div>
      </div>

      <div className="space-y-3">
        {items.length ? items.map(({ session }) => {
          const report = session.debug_report;
          const location = report?.location_result;
          return (
            <div key={session.session_id} className="rounded-lg border border-border bg-background px-4 py-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={session.status || "created"} />
                    <Badge variant="outline" className="rounded-md">{report?.coarse_type || report?.vuln_type || "unknown"}</Badge>
                    {report?.cwe ? <Badge variant="outline" className="rounded-md">{report.cwe}</Badge> : null}
                  </div>
                  <p className="mt-3 text-base font-semibold text-foreground">
                    {location?.primary_function || report?.root_cause || "未命名调试结论"}
                  </p>
                  <p className="mt-1 break-all text-sm text-muted-foreground">
                    {location?.primary_file_path || report?.vulnerability_location?.file_path || "未定位文件"}
                    {typeof location?.primary_line === "number" ? `:${location.primary_line}` : ""}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    {report?.stack_summary || report?.direct_cause || session.latest_evidence_summary?.stack_summary || "暂无摘要"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => onSelect(session.session_id)} className="rounded-lg">
                    <Zap className="h-3.5 w-3.5" />
                    打开监控
                  </Button>
                  <Button type="button" size="sm" onClick={() => onRefill(session.session_id)} className="rounded-lg">
                    <RefreshCcw className="h-3.5 w-3.5" />
                    回填重跑
                  </Button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span>session: {session.session_id}</span>
                <span>artifact: {session.request?.artifact_id || "—"}</span>
                <span>updated: {formatDateTime(session.updated_at || session.created_at)}</span>
              </div>
            </div>
          );
        }) : (
          <div className="rounded-xl border border-dashed border-border bg-background px-4 py-10 text-sm text-muted-foreground">
            当前没有匹配的历史会话。
          </div>
        )}
      </div>
    </div>
  );
}

import { ArchiveRestore, Search, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/utils/format";
import type { DebugArchiveListItem } from "@/features/debug/debug-types";

export function DebugArchiveList({
  items,
  keyword,
  coarseType,
  onKeywordChange,
  onCoarseTypeChange,
  onOpenSession,
  onRefill,
}: {
  items: DebugArchiveListItem[];
  keyword: string;
  coarseType: string;
  onKeywordChange: (value: string) => void;
  onCoarseTypeChange: (value: string) => void;
  onOpenSession: (sessionId: string) => void;
  onRefill: (recordId: string) => void;
}): JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">归档记录</p>
          <p className="mt-1 text-sm text-foreground">与历史调试会话关联的归档问题记录。</p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row">
          <div className="relative min-w-[16rem]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={keyword} onChange={(e) => onKeywordChange(e.target.value)} className="pl-9" placeholder="搜索记录 / CWE / 原因" />
          </div>
          <Input value={coarseType} onChange={(e) => onCoarseTypeChange(e.target.value)} placeholder="粗粒度类型过滤" className="md:w-[13rem]" />
        </div>
      </div>

      <div className="space-y-3">
        {items.length ? items.map(({ record, linkedSession }) => (
          <div key={record.record_id || record.id} className="rounded-lg border border-border bg-background px-4 py-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="default" className="rounded-md">{record.coarse_type || "未知"}</Badge>
                  {record.cwe ? <Badge variant="outline" className="rounded-md">{record.cwe}</Badge> : null}
                  {typeof record.confidence === "number" ? <Badge variant="outline" className="rounded-md">{`置信度 ${(record.confidence * 100).toFixed(0)}%`}</Badge> : null}
                </div>
                <p className="mt-3 text-base font-semibold text-foreground">{record.title || record.root_cause || "归档记录"}</p>
                <p className="mt-1 break-all text-sm text-muted-foreground">
                  {record.file_path || record.file || "暂无"}{typeof record.line === "number" ? `:${record.line}` : ""} · {record.function_name || record.function || "未知函数"}
                </p>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                  {record.direct_cause || record.stack_summary || "暂无归档摘要"}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {linkedSession?.session_id ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => onOpenSession(linkedSession.session_id)} className="rounded-lg">
                    <ArchiveRestore className="h-3.5 w-3.5" />
                    打开会话
                  </Button>
                ) : null}
                <Button type="button" size="sm" onClick={() => onRefill(record.record_id || record.id || "")} disabled={!record.record_id && !record.id} className="rounded-lg">
                  <Zap className="h-3.5 w-3.5" />
                  回填
                </Button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span>记录: {record.record_id || record.id || "暂无"}</span>
              <span>调试会话: {record.debug_session_id || "暂无"}</span>
              <span>创建: {formatDateTime(record.created_at)}</span>
            </div>
          </div>
        )) : (
          <div className="rounded-xl border border-dashed border-border bg-background px-4 py-10 text-sm text-muted-foreground">
            没有匹配的归档记录。
          </div>
        )}
      </div>
    </div>
  );
}

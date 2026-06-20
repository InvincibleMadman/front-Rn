import { Bug, FileCode2, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/common/empty-state";
import type { VulnHistoryRecord } from "@/types/api/vuln-history";
import { formatDateTime } from "@/lib/utils/format";

export function VulnRecordList({ records, selectedId, onSelect }: { records: VulnHistoryRecord[]; selectedId?: string; onSelect: (record: VulnHistoryRecord) => void }): JSX.Element {
  if (!records.length) return <EmptyState title="暂无漏洞记录" description="切换协议或放宽筛选条件后再查看。" />;
  return (
    <div className="space-y-3">
      {records.map((record) => {
        const id = record.record_id ?? record.id ?? `${record.protocol}-${record.title}`;
        const active = selectedId === id;
        return (
          <button key={id} type="button" onClick={() => onSelect(record)} className="block w-full text-left">
            <Card className={`card-surface p-4 ${active ? 'border-danger/60 shadow-[0_0_0_1px_hsl(var(--danger)/0.12)]' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex size-7 items-center justify-center rounded-full bg-danger/10 text-danger"><Bug className="size-4" /></span>
                    <p className="truncate font-semibold">{record.title ?? id}</p>
                    <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-xs text-muted-foreground">{record.coarse_type ?? 'unknown'}</span>
                    {record.cwe ? <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-xs text-muted-foreground">{record.cwe}</span> : null}
                  </div>
                  <div className="mt-2 grid gap-1 text-sm text-muted-foreground">
                    <p className="truncate">{record.protocol} · {record.function_name ?? record.function ?? '—'} · line {record.line ?? '-'}</p>
                    <p className="truncate">{record.file_path ?? record.file ?? '—'}</p>
                  </div>
                </div>
                <div className="shrink-0 text-right text-xs text-muted-foreground">
                  <p>{formatDateTime(record.updated_at ?? record.created_at)}</p>
                  <div className="mt-2 flex items-center justify-end gap-2">
                    {record.debug_session_id ? <ShieldCheck className="size-4 text-success" /> : <ShieldCheck className="size-4 text-muted-foreground" />}
                    {record.artifact_id || record.crash_signature ? <FileCode2 className="size-4 text-danger" /> : <FileCode2 className="size-4 text-muted-foreground" />}
                  </div>
                </div>
              </div>
            </Card>
          </button>
        );
      })}
    </div>
  );
}

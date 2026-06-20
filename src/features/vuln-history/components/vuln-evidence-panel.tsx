import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JsonViewer } from "@/components/common/json-viewer";
import type { VulnHistoryRecord } from "@/types/api/vuln-history";

export function VulnEvidencePanel({ record }: { record?: VulnHistoryRecord }): JSX.Element {
  const chain = [
    { label: 'artifact', value: record?.artifact_id ?? record?.crash_signature ?? '未关联' },
    { label: 'debug session', value: record?.debug_session_id ?? '未关联' },
    { label: 'archive', value: record?.record_id ?? record?.id ?? '未归档' },
  ];
  return (
    <Card className="card-surface h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">证据详情</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-[var(--radius-lg)] border border-border/60 bg-card p-3 text-sm">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">根因摘要</p>
          <p className="mt-2 whitespace-pre-wrap">{record?.root_cause ?? record?.direct_cause ?? '暂无根因摘要'}</p>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-border/60 bg-card p-3 text-sm">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">定位信息</p>
          <p className="mt-2">{record?.file_path ?? record?.file ?? '—'} : {record?.line ?? '-'} / {record?.function_name ?? record?.function ?? '—'}</p>
          <p className="mt-2 text-muted-foreground">{record?.stack_summary ?? '暂无 stack summary'}</p>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-border/60 bg-card p-3 text-sm">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">PoC / 修复建议</p>
          <p className="mt-2">{record?.poc_concept ?? '暂无 PoC 提示'}</p>
          <p className="mt-2 text-muted-foreground">{record?.fix_suggestion ?? '暂无修复建议'}</p>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-border/60 bg-card p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">证据链路</p>
          <div className="mt-3 space-y-2">
            {chain.map((item) => (
              <div key={item.label} className="rounded-[var(--radius-md)] border border-border/60 bg-background px-3 py-2.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="max-w-[15rem] truncate font-medium">{item.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-border/60 bg-card p-3">
          <p className="mb-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">原始 JSON</p>
          <div className="rounded-[var(--radius-md)] border border-border/60 bg-background p-3">
            <JsonViewer data={record ?? {}} compact />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

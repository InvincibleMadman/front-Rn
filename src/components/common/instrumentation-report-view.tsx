import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { JsonViewer } from "@/components/common/json-viewer";
import { SummaryCard } from "@/components/common/summary-card";
import type { InstrumentInsertion, InstrumentResponse } from "@/types/api/offline";

function value(input: unknown): string {
  if (input === null || input === undefined || input === "") return "—";
  return String(input);
}

function insertionKey(item: InstrumentInsertion, index: number): string {
  return `${item.file_path ?? "file"}:${item.function_name ?? "fn"}:${item.line ?? item.line_start ?? index}`;
}

function InsertionList({ title, items }: { title: string; items?: InstrumentInsertion[] }): JSX.Element {
  const list = items ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{list.length} 条记录</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {list.length === 0 ? <p className="text-sm text-muted-foreground">暂无记录。</p> : list.map((item, index) => (
          <div key={insertionKey(item, index)} className="rounded-xl border border-border/60 bg-background/50 p-3 text-sm">
            <div className="grid gap-2 md:grid-cols-2">
              <div className="break-all"><span className="font-medium">file_path：</span>{value(item.file_path)}</div>
              <div><span className="font-medium">function_name：</span>{value(item.function_name)}</div>
              <div><span className="font-medium">line：</span>{value(item.line ?? item.line_start)} - {value(item.line_end ?? item.line)}</div>
              <div><span className="font-medium">risk_type：</span>{value(item.risk_type)}</div>
              <div className="md:col-span-2"><span className="font-medium">reason：</span>{value(item.reason)}</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function InstrumentationReportView({ data }: { data?: InstrumentResponse | null }): JSX.Element {
  if (!data) return <JsonViewer data={{ status: "idle" }} compact />;
  const instrumentedFiles = data.instrumented_files ?? data.changed_files ?? [];
  const rejected = data.rejected_insertions ?? [];
  const applied = data.applied_insertions ?? [];
  const compileCheck = data.compile_check;
  const compileFailed = compileCheck?.enabled && compileCheck.passed === false;

  return (
    <div className="space-y-4">
      {rejected.length ? (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
          <div className="mb-1 flex items-center gap-2 font-medium"><AlertTriangle className="size-4" />部分插桩点因安全校验被拒绝</div>
          <p className="text-muted-foreground">这不代表接口失败；请查看 rejected_insertions 中的 global_scope / macro_region / function_not_found / anchor_not_found / unsafe_boundary / parse_failed / compile_check_failed 等 reason。</p>
        </div>
      ) : null}

      {compileFailed ? (
        <div className="rounded-xl border border-danger/35 bg-danger/10 p-3 text-sm text-foreground">
          <div className="mb-1 flex items-center gap-2 font-medium text-danger"><XCircle className="size-4" />compile_check.passed=false</div>
          <p>编译校验未通过，插桩可能未全部应用或已被后端回滚，请优先检查 compile_check.failures。</p>
        </div>
      ) : compileCheck?.enabled ? (
        <div className="rounded-xl border border-success/30 bg-success/10 p-3 text-sm text-foreground">
          <div className="flex items-center gap-2 font-medium text-success"><CheckCircle2 className="size-4" />compile_check 已启用：{compileCheck.passed ? "通过" : "未通过"}</div>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="inserted_markers" value={value(data.inserted_markers)} hint="后端报告插入数量" statusColor="primary" />
        <SummaryCard title="instrumented_files" value={String(instrumentedFiles.length)} hint="已修改文件数" statusColor="success" />
        <SummaryCard title="applied_insertions" value={String(applied.length)} hint="安全应用的插桩点" statusColor="success" />
        <SummaryCard title="rejected_insertions" value={String(rejected.length)} hint="安全拒绝的插桩点" statusColor={rejected.length ? "warning" : "primary"} />
      </div>

      <div className="grid gap-3 text-sm md:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-background/50 p-3"><span className="font-medium">output_path：</span><span className="break-all">{value(data.output_path)}</span></div>
        <div className="rounded-xl border border-border/60 bg-background/50 p-3"><span className="font-medium">plan_path：</span><span className="break-all">{value(data.plan_path)}</span></div>
        <div className="rounded-xl border border-border/60 bg-background/50 p-3"><span className="font-medium">report_path：</span><span className="break-all">{value(data.report_path)}</span></div>
        <div className="rounded-xl border border-border/60 bg-background/50 p-3"><span className="font-medium">compile_check：</span>{compileCheck?.enabled ? `enabled / passed=${String(compileCheck.passed)}` : "disabled"}</div>
      </div>

      <Card>
        <CardHeader><CardTitle>instrumented_files</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {instrumentedFiles.length === 0 ? <p className="text-sm text-muted-foreground">暂无文件列表。</p> : instrumentedFiles.map((file) => <p key={file} className="break-all rounded-lg border border-border/60 bg-background/50 p-2 text-xs text-muted-foreground">{file}</p>)}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <InsertionList title="applied_insertions" items={applied} />
        <InsertionList title="rejected_insertions" items={rejected} />
      </div>

      <details className="rounded-xl border border-border/60 bg-background/50 p-3">
        <summary className="cursor-pointer text-sm font-medium">validation_warnings / compile_check.failures / raw JSON</summary>
        <div className="mt-3"><JsonViewer data={{ validation_warnings: data.validation_warnings ?? [], compile_check: data.compile_check, raw: data }} compact /></div>
      </details>
    </div>
  );
}

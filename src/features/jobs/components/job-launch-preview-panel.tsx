import { AlertCircle, CheckCircle2, TerminalSquare, Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JsonViewer } from "@/components/common/json-viewer";
import type { JobCreateRequest } from "@/types/api/jobs";

export function JobLaunchPreviewPanel({
  payload,
  warnings,
  profileSummary,
  commandBlocks = [],
  assistantNotes = [],
}: {
  payload: JobCreateRequest;
  warnings: string[];
  profileSummary: Array<{ label: string; value: string }>;
  commandBlocks?: Array<{ title: string; command: string; env?: string; note?: string }>;
  assistantNotes?: string[];
}): JSX.Element {
  return (
    <div className="sticky top-[calc(var(--topbar-h)+1rem)] space-y-4">
      <Card className="card-surface">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">LaunchProfile / Build 摘要</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {profileSummary.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-border/60 bg-background/55 px-3 py-2 text-sm">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="max-w-[14rem] truncate font-medium">{item.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="card-surface">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">校验与风险提示</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {warnings.length ? warnings.map((item) => (
            <div key={item} className="flex items-start gap-2 rounded-[var(--radius-lg)] border border-warning/25 bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" />
              <span>{item}</span>
            </div>
          )) : (
            <div className="flex items-center gap-2 rounded-[var(--radius-lg)] border border-success/25 bg-success/10 px-3 py-2 text-sm">
              <CheckCircle2 className="size-4 text-success" />
              <span>当前配置满足提交要求。</span>
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="card-surface">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><TerminalSquare className="size-4.5" /> 服务端 / 侧栏命令建议</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {commandBlocks.length ? commandBlocks.map((item) => (
            <div key={`${item.title}-${item.command}`} className="rounded-[var(--radius-lg)] border border-border/60 bg-background/55 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">{item.title}</p>
              {item.env ? <p className="mt-2 break-all">env: {item.env}</p> : null}
              <p className="mt-2 break-all font-mono text-foreground">{item.command}</p>
              {item.note ? <p className="mt-2 break-all">{item.note}</p> : null}
            </div>
          )) : <p className="text-sm text-muted-foreground">当前尚未生成命令建议。</p>}
        </CardContent>
      </Card>
      <Card className="card-surface">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Wrench className="size-4.5" /> 助手说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {assistantNotes.length ? assistantNotes.map((item) => (
            <div key={item} className="rounded-[var(--radius-lg)] border border-border/60 bg-background/55 px-3 py-2 text-sm text-muted-foreground">
              {item}
            </div>
          )) : <p className="text-sm text-muted-foreground">当前无额外助手说明。</p>}
        </CardContent>
      </Card>
      <Card className="card-surface overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">将提交的结构化 payload</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="console-scrollbar max-h-[min(30rem,calc(100vh-var(--topbar-h)-10rem))] overflow-y-auto rounded-[var(--radius-lg)] border border-border/60 bg-background/55 p-3">
            <JsonViewer data={payload} compact />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

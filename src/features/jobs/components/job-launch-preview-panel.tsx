import { AlertCircle, CheckCircle2, TerminalSquare, Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JsonViewer } from "@/components/common/json-viewer";

export interface BuildPreviewDetails {
  mode: "structured" | "direct_commands";
  steps: Array<{ title: string; cwd?: string; command: string }>;
  acceptedCommandLines: string[];
  droppedLines: Array<{ line: string; reason: string }>;
  expectedOutputs: string[];
  targetIoHint?: string;
}

export function JobLaunchPreviewPanel({
  payload,
  warnings,
  profileSummary,
  commandBlocks = [],
  assistantNotes = [],
  buildPreview,
}: {
  payload: unknown;
  warnings: string[];
  profileSummary: Array<{ label: string; value: string }>;
  commandBlocks?: Array<{ title: string; command: string; env?: string; note?: string }>;
  assistantNotes?: string[];
  buildPreview?: BuildPreviewDetails;
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
      {buildPreview ? (
        <Card className="card-surface">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Build 提交预览</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-[var(--radius-lg)] border border-border/60 bg-background/55 px-3 py-2">
              <span className="text-muted-foreground">mode：</span>
              <span className="font-medium">{buildPreview.mode}</span>
              <span className="ml-3 text-muted-foreground">target io：</span>
              <span className="font-medium">{buildPreview.targetIoHint || "unknown"}</span>
            </div>
            {buildPreview.steps.length ? (
              <div className="space-y-2">
                {buildPreview.steps.map((item) => (
                  <div key={`${item.title}-${item.command}`} className="rounded-[var(--radius-lg)] border border-border/60 bg-background/55 p-3 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">{item.title}</p>
                    {item.cwd ? <p className="mt-2 break-all">cwd: {item.cwd}</p> : null}
                    <p className="mt-2 break-all font-mono text-foreground">{item.command}</p>
                  </div>
                ))}
              </div>
            ) : null}
            {buildPreview.acceptedCommandLines.length ? (
              <div className="rounded-[var(--radius-lg)] border border-border/60 bg-background/55 p-3 text-xs">
                <p className="font-medium text-foreground">直接命令模式将发送的 command_lines</p>
                <div className="mt-2 space-y-1 text-muted-foreground">
                  {buildPreview.acceptedCommandLines.map((line) => <div key={line} className="break-all font-mono text-foreground">{line}</div>)}
                </div>
              </div>
            ) : null}
            {buildPreview.droppedLines.length ? (
              <div className="rounded-[var(--radius-lg)] border border-warning/25 bg-warning/10 p-3 text-xs text-warning-foreground">
                <p className="font-medium">被丢弃的非法命令 {buildPreview.droppedLines.length} 条</p>
                <div className="mt-2 space-y-1">
                  {buildPreview.droppedLines.map((item) => <div key={`${item.line}-${item.reason}`} className="break-all">{item.line} · {item.reason}</div>)}
                </div>
              </div>
            ) : null}
            <div className="rounded-[var(--radius-lg)] border border-border/60 bg-background/55 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">expected outputs</p>
              <div className="mt-2 space-y-1">
                {buildPreview.expectedOutputs.length ? buildPreview.expectedOutputs.map((item) => <div key={item} className="break-all">{item}</div>) : <div>当前未填写。</div>}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
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

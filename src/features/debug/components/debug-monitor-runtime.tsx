import { Crosshair } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { MonitorDetailsViewModel } from "@/features/debug/debug-types";

function EmptyState({ label }: { label: string }): JSX.Element {
  return <div className="rounded-lg border border-dashed border-border bg-background px-3 py-5 text-[15px] text-muted-foreground">{label}</div>;
}

export function DebugMonitorRuntime({
  details,
  variant,
}: {
  details: MonitorDetailsViewModel;
  variant: "stack" | "inspect";
}): JSX.Element {
  if (variant === "inspect") {
    return (
      <div className="rounded-md border border-border bg-card p-3">
        <div className="mb-2 flex items-center justify-between gap-3 border-b border-border pb-2">
          <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">运行态检查</p>
          <p className="text-[12px] text-muted-foreground">寄存器 / 局部变量在右侧详情中展示</p>
        </div>
        <div className="rounded-lg border border-dashed border-border bg-background px-3 py-5 text-[15px] text-muted-foreground">
          运行态检查细节已整合到右侧证据面板。
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-3 border-b border-border pb-2">
        <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">调用栈</p>
        <p className="text-[12px] text-muted-foreground">栈帧 / 焦点位置</p>
      </div>

      <div className="mb-3 rounded-lg border border-border bg-background px-3 py-2.5 text-[14px] leading-6 text-foreground">
        <div className="mb-1 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <Crosshair className="h-3.5 w-3.5" />
          焦点摘要
        </div>
        {details.focusSummary || "暂无焦点摘要"}
      </div>

      {details.frames.length ? (
        <div className="overflow-hidden rounded-lg border border-border bg-background">
          <div className="console-scrollbar max-h-[min(32vh,18rem)] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14 text-[13px]">#</TableHead>
                  <TableHead className="text-[13px]">函数</TableHead>
                  <TableHead className="text-[13px]">文件 / 库</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {details.frames.slice(0, 18).map((frame) => (
                  <TableRow key={`${frame.index}-${frame.addr}-${frame.function}`}>
                    <TableCell className="font-mono text-[14px]">{frame.index ?? "-"}</TableCell>
                    <TableCell className="text-[14px] font-medium">{frame.function || "-"}</TableCell>
                    <TableCell className="break-all text-[14px] text-muted-foreground">
                      {frame.file_path || frame.library || "-"}{typeof frame.line === "number" ? `:${frame.line}` : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : <EmptyState label="暂无结构化调用栈。" />}
    </div>
  );
}

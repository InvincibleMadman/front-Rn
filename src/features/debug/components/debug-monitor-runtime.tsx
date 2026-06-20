import { Binary, Boxes, Braces, Crosshair } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { MonitorDetailsViewModel } from "@/features/debug/debug-types";

function EmptyState({ label }: { label: string }): JSX.Element {
  return <div className="rounded border border-dashed border-border bg-background px-3 py-5 text-[14px] text-muted-foreground">{label}</div>;
}

function Block({ title, icon: Icon, children }: { title: string; icon: typeof Binary; children: JSX.Element }): JSX.Element {
  return (
    <div className="overflow-hidden rounded border border-border bg-background">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5 text-[12px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

export function DebugMonitorRuntime({
  details,
  variant,
}: {
  details: MonitorDetailsViewModel;
  variant: "stack" | "inspect";
}): JSX.Element {
  if (variant === "stack") {
    return (
      <div className="rounded-md border border-border bg-card p-3">
        <div className="mb-2 flex items-center justify-between gap-3 border-b border-border pb-2">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">调用栈</p>
          <p className="text-[11px] text-muted-foreground">Call Stack / Focus Frame</p>
        </div>

        <div className="mb-3 rounded border border-border bg-background px-3 py-2.5 text-[13px] leading-6 text-foreground">
          <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <Crosshair className="h-3.5 w-3.5" />
            Focus Summary
          </div>
          {details.focusSummary}
        </div>

        {details.frames.length ? (
          <div className="overflow-hidden rounded border border-border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14 text-[12px]">#</TableHead>
                  <TableHead className="text-[12px]">函数</TableHead>
                  <TableHead className="text-[12px]">文件 / 库</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {details.frames.slice(0, 18).map((frame) => (
                  <TableRow key={`${frame.index}-${frame.addr}-${frame.function}`}>
                    <TableCell className="font-mono text-[13px]">{frame.index ?? "-"}</TableCell>
                    <TableCell className="text-[13px] font-medium">{frame.function || "-"}</TableCell>
                    <TableCell className="break-all text-[13px] text-muted-foreground">
                      {frame.file_path || frame.library || "-"}{typeof frame.line === "number" ? `:${frame.line}` : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : <EmptyState label="暂无结构化调用栈。" />}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-3 border-b border-border pb-2">
        <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">运行时检查器</p>
        <p className="text-[11px] text-muted-foreground">Registers / Locals</p>
      </div>

      <div className="grid gap-3">
        <Block title="关键寄存器" icon={Binary}>
          {details.keyRegisters.length ? (
            <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(7.5rem,1fr))]">
              {details.keyRegisters.map((register, index) => (
                <div key={`${register.name}-${index}`} className="rounded border border-border bg-card px-2.5 py-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{register.name || "-"}</div>
                  <div className="mt-1 break-all font-mono text-[13px] text-foreground">{register.display || register.value || "-"}</div>
                </div>
              ))}
            </div>
          ) : <EmptyState label="暂无关键寄存器。" />}
        </Block>

        <div className="grid gap-3 xl:grid-cols-2">
          <Block title="局部变量" icon={Braces}>
            {details.locals.length ? (
              <div className="overflow-hidden rounded border border-border bg-card">
                <Table>
                <TableHeader>
                  <TableRow>
                      <TableHead className="text-[12px]">名称</TableHead>
                      <TableHead className="text-[12px]">值</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {details.locals.slice(0, 10).map((local, index) => (
                      <TableRow key={`${local.name}-${index}`}>
                        <TableCell className="text-[13px] font-medium">{local.name || "-"}</TableCell>
                        <TableCell className="break-all font-mono text-[13px] text-muted-foreground">{local.value || local.raw || "-"}</TableCell>
                      </TableRow>
                  ))}
                </TableBody>
                </Table>
              </div>
            ) : <EmptyState label="暂无局部变量。" />}
          </Block>

          <Block title="完整寄存器" icon={Boxes}>
            {details.registers.length ? (
              <div className="overflow-hidden rounded border border-border bg-card">
                <Table>
                <TableHeader>
                  <TableRow>
                      <TableHead className="text-[12px]">寄存器</TableHead>
                      <TableHead className="text-[12px]">值</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {details.registers.slice(0, 12).map((register, index) => (
                      <TableRow key={`${register.name}-${index}`}>
                        <TableCell className="text-[13px] font-medium">{register.name || "-"}</TableCell>
                        <TableCell className="break-all font-mono text-[13px] text-muted-foreground">{register.display || register.value || "-"}</TableCell>
                      </TableRow>
                  ))}
                </TableBody>
                </Table>
              </div>
            ) : <EmptyState label="暂无完整寄存器。" />}
          </Block>
        </div>
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import { LibraryBig, Radar, ScrollText, TerminalSquare } from "lucide-react";
import { JsonViewer } from "@/components/common/json-viewer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { MonitorDetailsViewModel } from "@/features/debug/debug-types";

function EmptyState({ label }: { label: string }): JSX.Element {
  return <div className="rounded-lg border border-dashed border-border bg-background px-3 py-5 text-[14px] text-muted-foreground">{label}</div>;
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof LibraryBig; children: ReactNode }): JSX.Element {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-2 border-b border-border pb-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      {children}
    </div>
  );
}

export function DebugMonitorDetails({ details }: { details: MonitorDetailsViewModel }): JSX.Element {
  return (
    <div className="grid gap-3 [grid-template-rows:auto_auto_auto_auto]">
      <Panel title="分析结论" icon={ScrollText}>
        <div className="mb-3 rounded-lg border border-border bg-background px-3 py-3 text-[14px] leading-7 text-foreground">
          {details.stackText}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {details.evidenceSummary.map((item) => (
            <div key={item.label} className="rounded-lg border border-border bg-background px-3 py-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{item.label}</div>
              <div className="mt-1 text-[13px] text-foreground">{item.value}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-lg border border-border bg-background p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">结构化摘要</div>
          <div className="[&_*]:text-[13px] [&_*]:leading-6">
            <JsonViewer data={details.structured} />
          </div>
        </div>
      </Panel>

      <Panel title="运行时证据" icon={Radar}>
        <div className="grid gap-3 xl:grid-cols-2">
          <div className="overflow-hidden rounded-lg border border-border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[12px]">寄存器</TableHead>
                  <TableHead className="text-[12px]">值</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {details.keyRegisters.length ? details.keyRegisters.map((register, index) => (
                  <TableRow key={`${register.name}-${index}`}>
                    <TableCell className="text-[13px] font-medium">{register.name || "-"}</TableCell>
                    <TableCell className="break-all font-mono text-[13px] text-muted-foreground">{register.display || register.value || "-"}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={2} className="text-[13px] text-muted-foreground">暂无寄存器快照。</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="overflow-hidden rounded-lg border border-border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[12px]">局部变量</TableHead>
                  <TableHead className="text-[12px]">值</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {details.locals.length ? details.locals.slice(0, 10).map((local, index) => (
                  <TableRow key={`${local.name}-${index}`}>
                    <TableCell className="text-[13px] font-medium">{local.name || "-"}</TableCell>
                    <TableCell className="break-all font-mono text-[13px] text-muted-foreground">{local.value || local.raw || "-"}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={2} className="text-[13px] text-muted-foreground">暂无局部变量快照。</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </Panel>

      <Panel title="GDB 命令" icon={TerminalSquare}>
        {details.gdbAgentCommands.length ? (
          <div className="overflow-hidden rounded-lg border border-border bg-background">
            {details.gdbAgentCommands.map((item, index) => (
              <div key={`${item.label}-${index}`} className="border-b border-border px-3 py-2.5 last:border-b-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{item.label || `步骤 ${index + 1}`}</div>
                <div className="mt-1 font-mono text-[13px] text-foreground">{item.command || "-"}</div>
                {item.preview ? <div className="mt-1 line-clamp-2 text-[12px] leading-6 text-muted-foreground">{item.preview}</div> : null}
              </div>
            ))}
          </div>
        ) : <EmptyState label="暂无自动化 GDB 命令记录。" />}
      </Panel>

      <Panel title="共享库" icon={LibraryBig}>
        {details.sharedLibraries.length ? (
          <div className="overflow-hidden rounded-lg border border-border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[12px]">库名</TableHead>
                  <TableHead className="text-[12px]">路径 / 地址</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {details.sharedLibraries.slice(0, 10).map((lib, index) => (
                  <TableRow key={`${lib.name}-${index}`}>
                    <TableCell className="text-[13px] font-medium">{lib.name || "-"}</TableCell>
                    <TableCell className="break-all font-mono text-[13px] text-muted-foreground">
                      {lib.path || "-"}{(lib.from_addr || lib.to_addr) ? ` ${lib.from_addr || ""} ${lib.to_addr || ""}` : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : <EmptyState label="暂无共享库数据。" />}
      </Panel>
    </div>
  );
}

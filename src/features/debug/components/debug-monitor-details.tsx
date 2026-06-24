import type { ReactNode } from "react";
import { LibraryBig, ScrollText } from "lucide-react";
import { JsonViewer } from "@/components/common/json-viewer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { MonitorDetailsViewModel } from "@/features/debug/debug-types";

function EmptyState({ label }: { label: string }): JSX.Element {
  return <div className="rounded border border-dashed border-border bg-background px-3 py-5 text-[14px] text-muted-foreground">{label}</div>;
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
    <div className="grid gap-3 [grid-template-rows:auto_auto]">
      <Panel title="分析结论" icon={ScrollText}>
        <div>
          <div className="mb-3 rounded border border-border bg-background px-3 py-3 text-[14px] leading-7 text-foreground">
            {details.stackText}
          </div>
          <div className="[&_*]:text-[13px] [&_*]:leading-6">
            <JsonViewer data={details.structured} />
          </div>
        </div>
      </Panel>

      <Panel title="共享库" icon={LibraryBig}>
        {details.sharedLibraries.length ? (
          <div className="overflow-hidden rounded border border-border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[12px]">库</TableHead>
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
        ) : <EmptyState label="暂无共享库信息。" />}
      </Panel>
    </div>
  );
}

import { memo, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight, Copy, FileSearch, Files } from "lucide-react";
import { dockLog } from "@/components/layout/dock";
import { reportGlobalError } from "@/components/common/global-error-center";
import { Button } from "@/components/ui/button";
import type { ProtocolAssetSummary, WorkspaceTreeItem } from "@/types/api/assets";
import {
  buildWorkspaceRef,
  formatBytes,
  formatUpdatedAt,
  getAssetScopeIcon,
  getAssetScopeLabel,
  isWorkspaceRef,
  normalizeProtocol,
  safeCopyWorkspaceRef,
} from "@/features/assets/asset-utils";

interface AssetReferencePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  protocol: string;
  scope: string;
  selectedItem: WorkspaceTreeItem | null;
  summary?: ProtocolAssetSummary | null;
}

export const AssetReferencePanel = memo(function AssetReferencePanel({
  open,
  onOpenChange,
  protocol,
  scope,
  selectedItem,
  summary,
}: AssetReferencePanelProps): JSX.Element {
  const normalizedProtocol = useMemo(() => normalizeProtocol(protocol), [protocol]);
  const ScopeIcon = useMemo(() => getAssetScopeIcon(scope), [scope]);
  const scopeLabel = useMemo(() => getAssetScopeLabel(scope), [scope]);

  const scopeWorkspaceRef = useMemo(
    () => buildWorkspaceRef(normalizedProtocol, scope),
    [normalizedProtocol, scope],
  );

  const summaryWorkspaceRef = useMemo(() => {
    if (summary?.source_ref && isWorkspaceRef(summary.source_ref)) {
      return summary.source_ref;
    }
    return buildWorkspaceRef(normalizedProtocol, "source");
  }, [normalizedProtocol, summary?.source_ref]);

  const selectedWorkspaceRef = useMemo(() => {
    if (!selectedItem) return null;
    if (selectedItem.workspace_ref && isWorkspaceRef(selectedItem.workspace_ref)) {
      return selectedItem.workspace_ref;
    }
    return buildWorkspaceRef(normalizedProtocol, scope, selectedItem.virtual_path);
  }, [normalizedProtocol, scope, selectedItem]);

  const handleCopy = useCallback(async (reference: string, label: string) => {
    try {
      await safeCopyWorkspaceRef(reference);
      dockLog("success", "assets", `${label} copied`);
    } catch (error) {
      reportGlobalError(error, "工作区引用复制失败", "assets");
      dockLog("error", "assets", "Workspace reference copy failed");
    }
  }, []);

  return (
    <aside className="h-full min-h-[24rem] overflow-hidden rounded-[var(--radius-xl)] border border-border bg-card">
      <div className="flex h-full min-h-[24rem] overflow-hidden rounded-[inherit] bg-transparent">
        <div className="flex w-11 shrink-0 flex-col items-center overflow-hidden rounded-l-[inherit] border-r border-border bg-background/70 py-3">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-9 text-muted-foreground"
            onClick={() => onOpenChange(!open)}
            aria-label={open ? "收起引用栏" : "展开引用栏"}
          >
            {open ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </Button>
          <span className="mt-3 text-[10px] uppercase tracking-[0.28em] text-muted-foreground [writing-mode:vertical-rl]">
            Refs
          </span>
        </div>

        {open ? (
          <div className="min-w-0 flex-1 overflow-hidden rounded-r-[inherit] bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Reference</p>
                <div className="mt-2 flex items-center gap-2 text-sm font-medium text-foreground">
                  <ScopeIcon className="size-4 text-[hsl(var(--accent-blue))]" />
                  <span>{scopeLabel}</span>
                </div>
              </div>
              <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">
                {summary?.ready ? "源码就绪" : "等待导入"}
              </span>
            </div>

            <div className="mt-5 space-y-4">
              <section className="rounded-[var(--radius-lg)] border border-border/60 bg-background/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">当前 Scope</p>
                  <Button size="sm" variant="outline" onClick={() => void handleCopy(scopeWorkspaceRef, "Scope workspace ref")}>
                    <Copy className="size-3.5" />
                    复制
                  </Button>
                </div>
                <p className="mt-2 break-all font-mono text-xs text-foreground">{scopeWorkspaceRef}</p>
              </section>

              <section className="rounded-[var(--radius-lg)] border border-border/60 bg-background/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">源码摘要</p>
                  <Button size="sm" variant="outline" onClick={() => void handleCopy(summaryWorkspaceRef, "Source workspace ref")}>
                    <Copy className="size-3.5" />
                    复制
                  </Button>
                </div>
                <div className="mt-2 space-y-2 text-sm text-foreground">
                  <p className="break-all font-mono text-xs">{summaryWorkspaceRef}</p>
                  <p>文件数：{summary?.files_count ?? 0}</p>
                </div>
              </section>

              <section className="rounded-[var(--radius-lg)] border border-border/60 bg-background/60 p-3">
                <div className="flex items-center gap-2">
                  <Files className="size-4 text-[hsl(var(--accent-orange))]" />
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">当前选择</p>
                </div>

                {selectedItem ? (
                  <div className="mt-3 space-y-2 text-sm text-foreground">
                    <p className="font-medium">{selectedItem.name}</p>
                    <p className="break-all font-mono text-xs text-muted-foreground">{selectedItem.virtual_path}</p>
                    <p>类型：{selectedItem.type}</p>
                    <p>大小：{formatBytes(selectedItem.size)}</p>
                    <p>更新：{formatUpdatedAt(selectedItem.updated_at)}</p>
                    {selectedWorkspaceRef ? (
                      <>
                        <p className="break-all font-mono text-xs">{selectedWorkspaceRef}</p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleCopy(selectedWorkspaceRef, "Selected workspace ref")}
                        >
                          <Copy className="size-3.5" />
                          复制引用
                        </Button>
                      </>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-3 rounded-[var(--radius-md)] border border-dashed border-border/70 bg-background/70 px-3 py-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <FileSearch className="size-4" />
                      <span>尚未选择文件或目录。</span>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
});

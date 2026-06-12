import { useMemo, useState } from "react";
import { ChevronRight, Copy, Download, FolderTree, RefreshCcw } from "lucide-react";
import { dockLog } from "@/components/layout/dock";
import { reportGlobalError } from "@/components/common/global-error-center";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { WorkspaceTreeItem } from "@/types/api/assets";
import {
  ASSET_SCOPES,
  buildWorkspaceRef,
  formatBytes,
  formatUpdatedAt,
  getAssetScopeLabel,
  getParentVirtualPath,
  getVirtualPathSegments,
  getWorkspaceItemIcon,
  getWorkspaceItemRef,
  normalizeProtocol,
  normalizeVirtualPathOrRoot,
  safeCopyWorkspaceRef,
  type AssetScope,
} from "@/features/assets/asset-utils";

interface AssetDirectoryTableProps {
  protocol: string;
  scope: AssetScope;
  path: string;
  items: WorkspaceTreeItem[];
  selectedItem: WorkspaceTreeItem | null;
  loading?: boolean;
  onScopeChange: (scope: AssetScope) => void;
  onPathChange: (path: string) => void;
  onRefresh: () => void | Promise<void>;
  onSelectedItemChange: (item: WorkspaceTreeItem | null) => void;
  downloadUrlForPath: (path: string) => string;
}

export function AssetDirectoryTable({
  protocol,
  scope,
  path,
  items,
  selectedItem,
  loading = false,
  onScopeChange,
  onPathChange,
  onRefresh,
  onSelectedItemChange,
  downloadUrlForPath,
}: AssetDirectoryTableProps): JSX.Element {
  const normalizedProtocol = normalizeProtocol(protocol);
  const normalizedPath = normalizeVirtualPathOrRoot(path);
  const [treeOpen, setTreeOpen] = useState(false);

  const breadcrumbs = useMemo(() => getVirtualPathSegments(normalizedPath), [normalizedPath]);

  const handleCopyRef = async (item?: WorkspaceTreeItem | null): Promise<void> => {
    try {
      const reference = item
        ? getWorkspaceItemRef(normalizedProtocol, scope, item)
        : buildWorkspaceRef(normalizedProtocol, scope, normalizedPath);
      await safeCopyWorkspaceRef(reference);
      dockLog("success", "assets", "Workspace reference copied");
    } catch (error) {
      reportGlobalError(error, "工作区引用复制失败", "assets");
      dockLog("error", "assets", "Workspace reference copy failed");
    }
  };

  return (
    <>
      <div className="min-h-0 min-w-0 overflow-hidden rounded-[var(--radius-xl)] border border-border bg-card shadow-console">
        <div className="border-b border-border/70 px-4 py-3">
          <div className="min-h-0 min-w-0 overflow-x-auto">
            <div className="flex min-w-max items-center gap-1 text-sm text-muted-foreground">
              <span className="rounded-md bg-background px-2 py-1 font-medium text-foreground">{getAssetScopeLabel(scope)}</span>
              {breadcrumbs.map((segment, index) => (
                <div key={segment.path} className="flex items-center gap-1">
                  {index > 0 ? <ChevronRight className="size-3.5" /> : null}
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 transition-colors hover:bg-background hover:text-foreground"
                    onClick={() => {
                      onPathChange(segment.path);
                      onSelectedItemChange(null);
                    }}
                  >
                    {segment.label}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-b border-border/70 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1 overflow-x-auto">
              <div className="flex min-w-max items-center gap-1.5">
                {ASSET_SCOPES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                      item === scope
                        ? "border-[hsl(var(--accent-blue)/0.22)] bg-[hsl(var(--accent-blue)/0.10)] text-foreground"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => {
                      onScopeChange(item);
                      onPathChange("/");
                      onSelectedItemChange(null);
                    }}
                  >
                    {getAssetScopeLabel(item)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onPathChange(getParentVirtualPath(normalizedPath));
                  onSelectedItemChange(null);
                }}
                disabled={normalizedPath === "/"}
              >
                上级目录
              </Button>
              <Button size="sm" variant="outline" onClick={() => void onRefresh()} disabled={loading}>
                <RefreshCcw className="size-3.5" />
                刷新
              </Button>
              <Button size="sm" variant="outline" onClick={() => setTreeOpen(true)}>
                <FolderTree className="size-3.5" />
                Tree
              </Button>
              <Button size="sm" variant="outline" onClick={() => void handleCopyRef()}>
                <Copy className="size-3.5" />
                复制引用
              </Button>
            </div>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">当前目录暂无文件。</div>
        ) : (
          <div className="min-h-0 min-w-0 divide-y divide-border/60">
            {items.map((item) => {
              const ItemIcon = getWorkspaceItemIcon(item);
              const selected = selectedItem?.virtual_path === item.virtual_path && selectedItem?.type === item.type;

              return (
                <div
                  key={`${item.virtual_path}-${item.type}`}
                  className={`flex min-h-0 min-w-0 items-start gap-3 px-4 py-3 transition-colors ${
                    selected ? "bg-[hsl(var(--accent-blue)/0.08)]" : "hover:bg-background/80"
                  }`}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectedItemChange(item)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectedItemChange(item);
                    }
                  }}
                >
                  <div className="mt-0.5 shrink-0 text-muted-foreground">
                    <ItemIcon className="size-4" />
                  </div>

                  <div className="min-h-0 min-w-0 flex-1">
                    <div className="flex min-h-0 min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="truncate text-sm font-medium text-foreground">{item.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {item.type === "directory" ? "目录" : item.extension || "文件"}
                      </span>
                    </div>
                    <div className="mt-1 flex min-h-0 min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="truncate">{item.virtual_path}</span>
                      <span>{formatBytes(item.size)}</span>
                      <span>{formatUpdatedAt(item.updated_at)}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    {item.type === "directory" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectedItemChange(item);
                          onPathChange(item.virtual_path);
                          dockLog("info", "assets", "Workspace directory opened");
                        }}
                      >
                        进入
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectedItemChange(item);
                          dockLog("info", "assets", "Workspace file preview loaded");
                        }}
                      >
                        预览
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleCopyRef(item);
                      }}
                    >
                      <Copy className="size-3.5" />
                      复制
                    </Button>

                    {item.type === "file" ? (
                      <a
                        href={downloadUrlForPath(item.virtual_path)}
                        className="inline-flex"
                        onClick={(event) => {
                          event.stopPropagation();
                          dockLog("info", "assets", "Workspace file download requested");
                        }}
                      >
                        <Button size="sm" variant="secondary">
                          <Download className="size-3.5" />
                          下载
                        </Button>
                      </a>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={treeOpen} onOpenChange={setTreeOpen}>
        {treeOpen ? (
          <DialogContent className="w-[min(92vw,38rem)] max-h-[80vh] overflow-hidden p-0">
            <div className="border-b border-border/70 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Directory Tree</p>
              <p className="mt-2 break-all font-mono text-xs text-foreground">{buildWorkspaceRef(normalizedProtocol, scope, normalizedPath)}</p>
            </div>
            <div className="console-scrollbar max-h-[calc(80vh-5rem)] overflow-y-auto px-4 py-4">
              <div className="space-y-1">
                {items.map((item) => {
                  const ItemIcon = getWorkspaceItemIcon(item);
                  return (
                    <button
                      key={`tree-${item.virtual_path}-${item.type}`}
                      type="button"
                      className="flex w-full items-center gap-3 rounded-[var(--radius-lg)] px-3 py-2 text-left transition-colors hover:bg-background"
                      onClick={() => {
                        onSelectedItemChange(item);
                        if (item.type === "directory") {
                          onPathChange(item.virtual_path);
                        }
                        setTreeOpen(false);
                      }}
                    >
                      <ItemIcon className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{item.virtual_path}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}

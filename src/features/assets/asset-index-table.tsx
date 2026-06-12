import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Copy, Download, Filter, Loader2, SortAsc } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { AssetEmptyState } from "@/features/assets/asset-empty-state";
import { AssetQueryInput } from "@/features/assets/asset-query-input";
import { dockLog } from "@/components/layout/dock";
import { reportGlobalError } from "@/components/common/global-error-center";
import { assetsApi } from "@/lib/api/services/assets";
import { filterIndexItems, safeCopyWorkspaceRef } from "@/features/assets/asset-utils";
import {
  buildAssetIndexFilters,
  buildIndexFilterSummary,
  collectAssetPathSuggestions,
  formatBytes,
  formatUpdatedAt,
  normalizeProtocol,
  normalizeVirtualPathOrRoot,
  sortIndexItems,
  workspaceItemFromIndexItem,
  type AssetIndexSort,
  type AssetScope,
} from "@/features/assets/asset-utils";
import type { WorkspaceIndexItem, WorkspaceTreeItem } from "@/types/api/assets";

interface AssetIndexTableProps {
  protocol: string;
  scope: AssetScope;
  path: string;
  selectedItem: WorkspaceTreeItem | null;
  onSelectedItemChange: (item: WorkspaceTreeItem | null) => void;
}

function useQueryErrorToast(error: unknown, title: string, source: string, message: string): void {
  useEffect(() => {
    if (!error) return;
    reportGlobalError(error, title, source);
    dockLog("error", source, message);
  }, [error, message, source, title]);
}

function IndexRow({
  item,
  selected,
  onSelect,
  onCopy,
  onDownload,
}: {
  item: WorkspaceIndexItem;
  selected: boolean;
  onSelect: () => void;
  onCopy: () => void;
  onDownload: () => void;
}): JSX.Element {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={[
        "grid w-full grid-cols-[minmax(0,1.7fr)_8rem_2fr_7rem_9rem_auto] items-center gap-3 rounded-[var(--radius-lg)] border px-4 py-3 text-left transition-colors",
        selected ? "border-primary bg-primary/8" : "border-border/70 bg-background/60 hover:bg-muted/60",
      ].join(" ")}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
        <p className="truncate font-mono text-[11px] text-muted-foreground">{item.virtual_path}</p>
      </div>
      <div className="text-sm text-muted-foreground">{item.scope ?? "source"}</div>
      <div className="truncate text-sm text-muted-foreground">{normalizeVirtualPathOrRoot(item.virtual_path)}</div>
      <div className="text-sm text-muted-foreground">{formatBytes(item.size)}</div>
      <div className="text-sm text-muted-foreground">{formatUpdatedAt(item.updated_at)}</div>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); onSelect(); }}>
          <ArrowRight className="size-3.5" />
        </Button>
        <Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); onCopy(); }}>
          <Copy className="size-3.5" />
        </Button>
        <Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); onDownload(); }}>
          <Download className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function AssetIndexTable({
  protocol,
  scope,
  path,
  selectedItem,
  onSelectedItemChange,
}: AssetIndexTableProps): JSX.Element {
  const normalizedProtocol = normalizeProtocol(protocol);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<AssetIndexSort>("updated");
  const [showMoreCursor, setShowMoreCursor] = useState<string | null>(null);
  const [items, setItems] = useState<WorkspaceIndexItem[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filterState = useMemo(
    () => buildAssetIndexFilters(query, scope),
    [query, scope],
  );

  const pathSuggestions = useMemo(() => collectAssetPathSuggestions(items, 8), [items]);

  const indexQuery = useQuery({
    queryKey: [
      "workspace-index",
      normalizedProtocol,
      filterState.scopes.join(","),
    ],
    queryFn: () => assetsApi.getWorkspaceIndex(normalizedProtocol, {
      scopes: filterState.scopes,
      limit: 200,
      include_dirs: true,
      include_counts: true,
    }),
    retry: 0,
  });

  useEffect(() => {
    if (!indexQuery.error) return;
    reportGlobalError(indexQuery.error, "资产索引加载失败", "assets");
    dockLog("error", "assets", "Workspace index failed");
  }, [indexQuery.error]);

  useEffect(() => {
    if (!indexQuery.data) return;
    setItems(indexQuery.data.items);
    setShowMoreCursor(indexQuery.data.next_cursor);
  }, [indexQuery.data, sort]);

  const selectedWorkspaceRef = selectedItem?.workspace_ref ?? "";

  const displayedItems = useMemo(
    () => sortIndexItems(filterIndexItems(items, filterState), sort),
    [filterState, items, sort],
  );

  const handleSelect = (item: WorkspaceIndexItem): void => {
    onSelectedItemChange(workspaceItemFromIndexItem(item));
    dockLog("info", "assets", `Index row selected: ${item.name}`);
  };

  useEffect(() => {
    setItems([]);
    setShowMoreCursor(null);
  }, [normalizedProtocol, filterState.scopes.join(",")]);

  void path;

  return (
    <div className="min-h-0 min-w-0 space-y-4">
      <section className="rounded-[var(--radius-xl)] border border-border bg-card p-4 shadow-console">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
          <AssetQueryInput
            value={query}
            onChange={setQuery}
            onSubmit={(nextValue) => setQuery(nextValue)}
            pathSuggestions={pathSuggestions}
            placeholder="scope:source ext:c path:src"
          />
          <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="outline">
                <Filter className="size-4" />
                Filters
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[min(88vw,36rem)]">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Filter fields</p>
                  <p className="mt-1 text-xs text-muted-foreground">支持 scope / ext / type / path。</p>
                </div>
                <div className="grid gap-3">
                  <div className="rounded-[var(--radius-lg)] border border-border/60 bg-background/60 p-3 text-sm text-muted-foreground">
                    当前筛选：{buildIndexFilterSummary({ ...filterState, sort })}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button type="button" variant="outline" onClick={() => setSort((current) => (current === "updated" ? "name" : current === "name" ? "scope" : "updated"))}>
            <SortAsc className="size-4" />
            {sort}
          </Button>
          {indexQuery.isFetching ? <Loader2 className="ml-auto size-4 animate-spin text-muted-foreground" /> : null}
        </div>

        <div className="mt-3 text-xs text-muted-foreground">
          <span>{buildIndexFilterSummary({ ...filterState, sort })}</span>
        </div>
      </section>

      <section className="min-h-0 min-w-0 rounded-[var(--radius-xl)] border border-border bg-card p-4 shadow-console">
        {displayedItems.length > 0 ? (
          <div className="space-y-3">
            <div className="grid grid-cols-[minmax(0,1.7fr)_8rem_2fr_7rem_9rem_auto] gap-3 border-b border-border/60 px-4 pb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <span>Name</span>
              <span>Scope</span>
              <span>Path</span>
              <span>Size</span>
              <span>Updated</span>
              <span className="text-right">Actions</span>
            </div>
            {displayedItems.map((item) => (
              <IndexRow
                key={item.workspace_ref ?? `${item.scope}-${item.virtual_path}`}
                item={item}
                selected={selectedWorkspaceRef === (item.workspace_ref ?? "")}
                onSelect={() => handleSelect(item)}
                onCopy={async () => {
                  try {
                    await safeCopyWorkspaceRef(item.workspace_ref ?? "");
                    dockLog("success", "assets", "Index reference copied");
                  } catch (error) {
                    reportGlobalError(error, "复制引用失败", "assets");
                    dockLog("error", "assets", "Index reference copy failed");
                  }
                }}
                onDownload={() => {
                  const url = assetsApi.getWorkspaceDownloadUrl(normalizedProtocol, String(item.scope ?? scope), normalizeVirtualPathOrRoot(item.virtual_path));
                  window.open(url, "_blank", "noopener,noreferrer");
                }}
              />
            ))}
            {showMoreCursor ? (
              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    const nextPage = await assetsApi.getWorkspaceIndex(normalizedProtocol, {
                      scopes: filterState.scopes,
                      limit: 200,
                      cursor: showMoreCursor,
                      include_dirs: true,
                      include_counts: true,
                    });
                    setItems((current) => [...current, ...nextPage.items]);
                    setShowMoreCursor(nextPage.next_cursor);
                  }}
                >
                  显示更多
                </Button>
              </div>
            ) : null}
          </div>
        ) : indexQuery.isFetching ? (
          <div className="rounded-[var(--radius-lg)] border border-dashed border-border/60 bg-background/60 px-4 py-10 text-center text-sm text-muted-foreground">
            正在加载索引…
          </div>
        ) : (
          <AssetEmptyState title="索引为空" description="请先导入源码或扩大 scope / path 过滤条件。" />
        )}
      </section>
    </div>
  );
}

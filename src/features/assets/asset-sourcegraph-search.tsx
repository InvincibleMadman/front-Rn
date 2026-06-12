import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Copy, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssetEmptyState } from "@/features/assets/asset-empty-state";
import { AssetQueryInput } from "@/features/assets/asset-query-input";
import {
  ASSET_QUERY_EXAMPLES,
  buildAssetSearchRequest,
  collectAssetPathSuggestions,
  formatBytes,
  formatUpdatedAt,
  getWorkspaceItemIcon,
  normalizeProtocol,
  normalizeVirtualPathOrRoot,
  shortenWorkspaceRef,
  workspaceItemFromSearchMatch,
  type AssetScope,
} from "@/features/assets/asset-utils";
import { assetsApi } from "@/lib/api/services/assets";
import { reportGlobalError } from "@/components/common/global-error-center";
import { dockLog } from "@/components/layout/dock";
import { safeCopyWorkspaceRef } from "@/features/assets/asset-utils";
import type { WorkspaceTreeItem, WorkspaceSearchMatch } from "@/types/api/assets";

interface AssetSourcegraphSearchProps {
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

function SearchResultRow({
  match,
  selected,
  onOpen,
  onCopy,
  onDownload,
}: {
  match: WorkspaceSearchMatch;
  selected: boolean;
  onOpen: () => void;
  onCopy: () => void;
  onDownload: () => void;
}): JSX.Element {
  const item = match.item;
  const Icon = getWorkspaceItemIcon(item);

  return (
    <div
      role="button"
      tabIndex={0}
      className={[
        "w-full rounded-[var(--radius-lg)] border px-4 py-3 text-left transition-colors",
        selected ? "border-primary bg-primary/8" : "border-border/70 bg-background/60 hover:bg-muted/60",
      ].join(" ")}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full border border-border/70 bg-card p-2 text-[hsl(var(--accent-blue))]">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
            <span className="shrink-0 text-xs text-muted-foreground">{item.scope ?? "source"}</span>
          </div>
          <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
            {shortenWorkspaceRef(item.workspace_ref ?? "", 72)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{match.reason}</p>
          {match.snippets?.length ? (
            <div className="mt-3 space-y-1">
              {match.snippets.map((snippet) => (
                <pre key={`${snippet.line}-${snippet.text}`} className="overflow-hidden rounded-[var(--radius-md)] border border-border/60 bg-card/70 px-3 py-2 font-mono text-[12px] leading-5 text-foreground">
                  <span className="mr-3 text-[11px] text-muted-foreground">{String(snippet.line).padStart(3, "0")}</span>
                  {snippet.text}
                </pre>
              ))}
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{formatBytes(item.size)}</span>
            <span>·</span>
            <span>{formatUpdatedAt(item.updated_at)}</span>
            <span>·</span>
            <span>{selected ? "已选中" : "点击以查看"}</span>
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); onOpen(); }}>
            打开
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
    </div>
  );
}

export function AssetSourcegraphSearch({
  protocol,
  scope,
  path,
  selectedItem,
  onSelectedItemChange,
}: AssetSourcegraphSearchProps): JSX.Element {
  const normalizedProtocol = normalizeProtocol(protocol);
  const [query, setQuery] = useState("");
  const [contentEnabled, setContentEnabled] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [requestGenerationId, setRequestGenerationId] = useState(0);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedQuery(query);
      setRequestGenerationId((value) => value + 1);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [query]);

  const requestState = useMemo(
    () => buildAssetSearchRequest(debouncedQuery, contentEnabled, 100),
    [contentEnabled, debouncedQuery],
  );

  const searchQuery = useQuery({
    queryKey: [
      "workspace-search",
      normalizedProtocol,
      requestState.q ?? "",
      requestState.scopes?.join(",") ?? "",
      requestState.ext ?? "",
      requestState.type ?? "",
      requestState.path ?? "",
      requestState.content,
      requestState.limit,
      requestGenerationId,
    ],
    queryFn: () => assetsApi.searchWorkspace(normalizedProtocol, {
      q: requestState.q,
      scopes: requestState.scopes,
      ext: requestState.ext,
      type: requestState.type,
      path: requestState.path,
      content: requestState.content,
      limit: requestState.limit,
    }),
    enabled: Boolean(debouncedQuery.trim() || contentEnabled),
    retry: 0,
  });

  useQueryErrorToast(searchQuery.error, "资产搜索加载失败", "assets", "Workspace search failed");

  const results = searchQuery.data?.items ?? [];
  const pathSuggestions = useMemo(
    () => collectAssetPathSuggestions([...results.map((match) => match.item), ...(selectedItem ? [selectedItem] : [])], 8),
    [results, selectedItem],
  );
  const hasResults = results.length > 0;
  void path;

  const openItem = (match: WorkspaceSearchMatch): void => {
    const item = workspaceItemFromSearchMatch(match);
    onSelectedItemChange(item);
    dockLog("info", "assets", `Search result selected: ${item.name}`);
  };

  const selectedWorkspaceRef = selectedItem?.workspace_ref ?? "";

  return (
    <div className="min-h-0 min-w-0 space-y-4">
      <section className="rounded-[var(--radius-xl)] border border-border bg-card p-4 shadow-console">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
          <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-xs text-muted-foreground">
            后端搜索
          </span>
          <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-xs text-muted-foreground">
            limit 100
          </span>
          <label className="ml-auto inline-flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={contentEnabled}
              onChange={(event) => setContentEnabled(event.target.checked)}
            />
            内容搜索
          </label>
        </div>

        <div className="mt-4">
          <AssetQueryInput
            value={query}
            onChange={setQuery}
            onSubmit={(nextValue) => setQuery(nextValue)}
            pathSuggestions={pathSuggestions}
            showContentHint
            placeholder="server.c, *.dict, scope:risk crash, type:json"
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>{query.trim() ? `查询：${query.trim()}` : `示例：${ASSET_QUERY_EXAMPLES[0]} / ${ASSET_QUERY_EXAMPLES[2]}`}</p>
          <p>{requestState.content ? "content=true" : "content=false"}</p>
        </div>
      </section>

      <section className="min-h-0 min-w-0 rounded-[var(--radius-xl)] border border-border bg-card p-4 shadow-console">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div>
            <p className="text-sm font-medium text-foreground">搜索结果</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {hasResults ? `${results.length} 条结果` : searchQuery.isFetching ? "搜索中" : "暂无结果"}
            </p>
          </div>
          {searchQuery.isFetching ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
        </div>

        {!query.trim() && !hasResults ? (
          <div className="mt-4">
            <AssetEmptyState
              title="使用 key:value 查询资产"
              description="支持 scope、ext、type、path、content、job 等过滤。"
            />
          </div>
        ) : null}

        {hasResults ? (
          <div className="mt-4 space-y-3">
            {results.map((match) => (
              <SearchResultRow
                key={match.item.workspace_ref ?? `${match.item.virtual_path}-${match.item.name}`}
                match={match}
                selected={selectedWorkspaceRef === (match.item.workspace_ref ?? "")}
                onOpen={() => openItem(match)}
                onCopy={async () => {
                  try {
                    await safeCopyWorkspaceRef(match.item.workspace_ref ?? "");
                    dockLog("success", "assets", "Search reference copied");
                  } catch (error) {
                    reportGlobalError(error, "复制引用失败", "assets");
                    dockLog("error", "assets", "Search reference copy failed");
                  }
                }}
                onDownload={() => {
                  const url = assetsApi.getWorkspaceDownloadUrl(normalizedProtocol, String(match.item.scope ?? scope), normalizeVirtualPathOrRoot(match.item.virtual_path));
                  window.open(url, "_blank", "noopener,noreferrer");
                }}
              />
            ))}
          </div>
        ) : searchQuery.isFetching ? (
          <div className="mt-6 rounded-[var(--radius-lg)] border border-dashed border-border/60 bg-background/60 px-4 py-10 text-center text-sm text-muted-foreground">
            正在查询后端搜索结果…
          </div>
        ) : (
          <div className="mt-4">
            <AssetEmptyState
              title="没有匹配结果"
              description="尝试修改 scope、ext、type、path 或 content 关键字。"
            />
          </div>
        )}
      </section>
    </div>
  );
}

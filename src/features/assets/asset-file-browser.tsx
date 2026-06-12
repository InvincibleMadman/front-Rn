import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { dockLog } from "@/components/layout/dock";
import { reportGlobalError } from "@/components/common/global-error-center";
import { assetsApi } from "@/lib/api/services/assets";
import type { WorkspaceTreeItem } from "@/types/api/assets";
import { AssetEmptyState } from "@/features/assets/asset-empty-state";
import { AssetDirectoryTable } from "@/features/assets/asset-directory-table";
import { AssetFilePreview } from "@/features/assets/asset-file-preview";
import {
  normalizeProtocol,
  normalizeVirtualPath,
  normalizeVirtualPathOrRoot,
  sortWorkspaceItems,
  type AssetScope,
} from "@/features/assets/asset-utils";

interface AssetFileBrowserProps {
  protocol: string;
  scope: AssetScope;
  path: string;
  selectedItem: WorkspaceTreeItem | null;
  onScopeChange: (scope: AssetScope) => void;
  onPathChange: (path: string) => void;
  onSelectedItemChange: (item: WorkspaceTreeItem | null) => void;
}

function useQueryErrorToast(error: unknown, title: string, source: string, message: string): void {
  useEffect(() => {
    if (!error) return;
    reportGlobalError(error, title, source);
    dockLog("error", source, message);
  }, [error, message, source, title]);
}

export function AssetFileBrowser({
  protocol,
  scope,
  path,
  selectedItem,
  onScopeChange,
  onPathChange,
  onSelectedItemChange,
}: AssetFileBrowserProps): JSX.Element {
  const normalizedProtocol = normalizeProtocol(protocol);
  const normalizedPath = normalizeVirtualPathOrRoot(path);

  const treeQuery = useQuery({
    queryKey: ["workspace-tree", normalizedProtocol, scope, normalizedPath],
    queryFn: () => assetsApi.getWorkspaceTree(normalizedProtocol, scope, normalizedPath),
  });

  const previewQuery = useQuery({
    queryKey: ["workspace-preview", normalizedProtocol, scope, selectedItem?.virtual_path],
    queryFn: () => assetsApi.getWorkspacePreview(normalizedProtocol, scope, normalizeVirtualPath(selectedItem?.virtual_path)),
    enabled: Boolean(selectedItem && selectedItem.type === "file"),
  });

  useQueryErrorToast(treeQuery.error, "工作区文件树加载失败", "assets", "Workspace tree failed");
  useQueryErrorToast(previewQuery.error, "工作区文件预览失败", "assets", "Workspace preview failed");

  const treeItems = useMemo(
    () => sortWorkspaceItems(treeQuery.data?.items ?? []),
    [treeQuery.data?.items],
  );

  const preview = previewQuery.data;
  const selectedFile = selectedItem?.type === "file" ? selectedItem : null;

  return (
    <div className="min-h-0 min-w-0 space-y-4">
      <AssetDirectoryTable
        protocol={normalizedProtocol}
        scope={scope}
        path={normalizedPath}
        items={treeItems}
        selectedItem={selectedItem}
        loading={treeQuery.isFetching}
        onScopeChange={onScopeChange}
        onPathChange={onPathChange}
        onRefresh={async () => {
          await treeQuery.refetch();
        }}
        onSelectedItemChange={(item) => {
          onSelectedItemChange(item);
          if (item?.type === "file") {
            dockLog("info", "assets", "Workspace file preview loaded");
          }
        }}
        downloadUrlForPath={(itemPath) => assetsApi.getWorkspaceDownloadUrl(normalizedProtocol, scope, itemPath)}
      />

      <AssetFilePreview
        protocol={normalizedProtocol}
        scope={scope}
        selectedItem={selectedFile}
        preview={preview}
      />
    </div>
  );
}

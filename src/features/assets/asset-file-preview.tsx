import { useMemo } from "react";
import { Copy, Download, FileCode2, FileJson } from "lucide-react";
import { dockLog } from "@/components/layout/dock";
import { reportGlobalError } from "@/components/common/global-error-center";
import { Button } from "@/components/ui/button";
import type { WorkspacePreviewResponse, WorkspaceTreeItem } from "@/types/api/assets";
import {
  buildWorkspaceRef,
  normalizeProtocol,
  shortenWorkspaceRef,
  safeCopyWorkspaceRef,
  type AssetScope,
} from "@/features/assets/asset-utils";
import { assetsApi } from "@/lib/api/services/assets";

function tryFormatJson(content?: string): string {
  if (!content) return "";

  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    return content;
  }
}

function CodeLines({ content }: { content: string }): JSX.Element {
  const lines = useMemo(() => {
    const normalized = content.replace(/\r\n/g, "\n");
    return normalized.length > 0 ? normalized.split("\n") : [""];
  }, [content]);

  return (
    <div className="min-h-0 min-w-0 overflow-auto">
      <div className="min-w-full font-mono text-xs leading-6 text-foreground">
        {lines.map((line, index) => (
          <div key={`${index}-${line.length}`} className="grid grid-cols-[3.5rem_minmax(0,1fr)] border-b border-border/30 last:border-b-0">
            <div className="select-none border-r border-border/40 bg-background/70 px-3 py-1 text-right text-muted-foreground">
              {index + 1}
            </div>
            <pre className="overflow-visible whitespace-pre-wrap break-words px-4 py-1">{line || " "}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}

interface AssetFilePreviewProps {
  protocol: string;
  scope: AssetScope;
  selectedItem: WorkspaceTreeItem | null;
  preview?: WorkspacePreviewResponse | null;
}

export function AssetFilePreview({
  protocol,
  scope,
  selectedItem,
  preview,
}: AssetFilePreviewProps): JSX.Element | null {
  const normalizedProtocol = normalizeProtocol(protocol);

  if (!selectedItem || selectedItem.type !== "file") {
    return null;
  }

  const workspaceRef = buildWorkspaceRef(normalizedProtocol, scope, selectedItem.virtual_path);
  const shortWorkspaceRef = shortenWorkspaceRef(workspaceRef, 64);
  const formattedJson = preview?.preview_type === "json" ? tryFormatJson(preview.content) : "";

  const handleCopy = async (): Promise<void> => {
    try {
      await safeCopyWorkspaceRef(workspaceRef);
      dockLog("success", "assets", "Workspace reference copied");
    } catch (error) {
      reportGlobalError(error, "工作区引用复制失败", "assets");
      dockLog("error", "assets", "Workspace reference copy failed");
    }
  };

  return (
    <div className="min-h-0 min-w-0 rounded-[var(--radius-xl)] border border-border bg-card shadow-console">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {preview?.preview_type === "json" ? (
              <FileJson className="size-4 text-[hsl(var(--accent-blue))]" />
            ) : (
              <FileCode2 className="size-4 text-[hsl(var(--accent-blue))]" />
            )}
            <p className="truncate text-sm font-medium text-foreground">{selectedItem.name}</p>
          </div>
          <p className="mt-1 truncate font-mono text-xs text-muted-foreground" title={workspaceRef}>
            {shortWorkspaceRef}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => void handleCopy()}>
            <Copy className="size-3.5" />
            复制
          </Button>
          <a
            href={assetsApi.getWorkspaceDownloadUrl(normalizedProtocol, scope, selectedItem.virtual_path)}
            className="inline-flex"
            onClick={() => dockLog("info", "assets", "Workspace file download requested")}
          >
            <Button size="sm" variant="secondary">
              <Download className="size-3.5" />
              下载
            </Button>
          </a>
        </div>
      </div>

      <div className="min-h-0 min-w-0 p-4">
        {!preview ? (
          <div className="rounded-[var(--radius-lg)] border border-border/60 bg-background/60 px-4 py-10 text-center text-sm text-muted-foreground">
            正在加载文件预览...
          </div>
        ) : preview.preview_type === "hex" ? (
          <div className="min-h-0 min-w-0 overflow-hidden rounded-[var(--radius-lg)] border border-border/60 bg-background/80">
            <div className="grid grid-cols-2 border-b border-border/50 bg-background/90 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              <div className="border-r border-border/50 px-4 py-3">Hex</div>
              <div className="px-4 py-3">Ascii</div>
            </div>
            <div className="grid max-h-[32rem] min-h-0 min-w-0 grid-cols-2 overflow-hidden">
              <pre className="console-scrollbar overflow-auto border-r border-border/50 px-4 py-4 font-mono text-xs leading-6 text-foreground">
                {preview.hex}
              </pre>
              <pre className="console-scrollbar overflow-auto px-4 py-4 font-mono text-xs leading-6 text-foreground">
                {preview.ascii}
              </pre>
            </div>
          </div>
        ) : (
          <div className="min-h-0 min-w-0 overflow-hidden rounded-[var(--radius-lg)] border border-border/60 bg-background/80">
            <div className="border-b border-border/50 bg-background/90 px-4 py-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {preview.preview_type === "json" ? "Json Viewer" : "Code Viewer"}
            </div>
            <div className="max-h-[32rem] min-h-0 min-w-0 overflow-hidden">
              <CodeLines content={preview.preview_type === "json" ? formattedJson : preview.content ?? ""} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

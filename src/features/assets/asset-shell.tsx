import type { ReactNode } from "react";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils/cn";
import type { ProtocolAssetSummary } from "@/types/api/assets";
import type { AssetPrimaryTab } from "@/features/assets/asset-utils";

const VIEW_LABELS: Record<AssetPrimaryTab, string> = {
  overview: "总览",
  files: "文件",
  search: "搜索",
  lineage: "关系",
  index: "索引",
};

interface AssetShellProps {
  protocol: string;
  protocols?: string[];
  summary?: ProtocolAssetSummary | null;
  view: AssetPrimaryTab;
  onViewChange: (view: AssetPrimaryTab) => void;
  onProtocolChange: (protocol: string) => void;
  onRefresh: () => void | Promise<void>;
  refreshPending?: boolean;
  actions?: ReactNode;
}

export function AssetShell({
  protocol,
  protocols = [],
  summary,
  view,
  onViewChange,
  onProtocolChange,
  onRefresh,
  refreshPending = false,
  actions,
}: AssetShellProps): JSX.Element {
  const protocolOptions = Array.from(new Set([protocol, ...protocols].filter(Boolean)));

  return (
    <section className="rounded-[var(--radius-xl)] border border-border bg-card px-3 py-3 shadow-console">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex shrink-0 items-center gap-3 rounded-[var(--radius-lg)] border border-border bg-background/80 px-3 py-2">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Asset Center</p>
            <p className="truncate text-sm font-semibold text-foreground">{protocol}</p>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs",
              summary?.ready
                ? "border-[hsl(var(--accent-blue)/0.25)] bg-[hsl(var(--accent-blue)/0.10)] text-foreground"
                : "border-[hsl(var(--accent-orange)/0.28)] bg-[hsl(var(--accent-orange)/0.10)] text-foreground",
            )}
          >
            <span
              className={cn(
                "inline-block size-2 rounded-full",
                summary?.ready ? "bg-[hsl(var(--accent-blue))]" : "bg-[hsl(var(--accent-orange))]",
              )}
            />
            {summary?.ready ? "源码就绪" : "等待导入"}
          </span>
        </div>

        <Tabs value={view} onValueChange={(nextValue) => onViewChange(nextValue as AssetPrimaryTab)} className="min-w-0 flex-1">
          <TabsList className="h-auto flex-wrap gap-1 rounded-[var(--radius-lg)] border border-border bg-background/80 p-1">
            {(Object.keys(VIEW_LABELS) as AssetPrimaryTab[]).map((tab) => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="rounded-[var(--radius-md)] px-3 py-2 text-sm data-[state=active]:bg-card"
              >
                {VIEW_LABELS[tab]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {actions}
          <Button variant="outline" size="sm" onClick={() => void onRefresh()} disabled={refreshPending}>
            <RefreshCcw className="size-4" />
            刷新
          </Button>
          <Select value={protocol} onValueChange={onProtocolChange}>
            <SelectTrigger className="h-9 w-[14rem] bg-background">
              <SelectValue placeholder="选择协议" />
            </SelectTrigger>
            <SelectContent>
              {protocolOptions.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>
  );
}

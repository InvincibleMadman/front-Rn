import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CircleDot, MoonStar, SunMedium } from "lucide-react";
import { NodeSwitcherDropdown } from "@/components/common/node-switcher-dropdown";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import { systemApi } from "@/lib/api/services/system";
import { useUiStore } from "@/stores/ui-store";

export function Topbar(): JSX.Element {
  const theme = useUiStore((state) => state.theme);
  const toggleTheme = useUiStore((state) => state.toggleTheme);
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const selectedNodeId = useUiStore((state) => state.selectedApiNodeId);

  const backendHealthQuery = useQuery({
    queryKey: ["backend-health", selectedNodeId ?? "local"],
    queryFn: systemApi.getSystemInfo,
    retry: 0,
    refetchInterval: 15_000,
  });

  const statusLabel = backendHealthQuery.data
    ? "节点在线"
    : backendHealthQuery.isError
      ? "节点离线"
      : "节点检测中";

  return (
    <header
      className="shell-topbar fixed right-0 top-0 z-[70] border-b border-border/50"
      style={{
        left: sidebarCollapsed ? "var(--sidebar-w-collapsed)" : "var(--sidebar-w)",
        height: "var(--topbar-h)",
        transition: "left 220ms ease",
      }}
    >
      <div className="flex h-full items-center gap-4 px-5">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] uppercase tracking-[0.22em] text-muted-foreground">
            Protocol Fuzz Console
          </p>
          <div className="flex min-w-0 items-center gap-3">
            <h2 className="truncate text-[26px] font-semibold tracking-tight">
              ICS 协议模糊测试系统
            </h2>
            <span className="hidden rounded-full border border-border/70 bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground lg:inline-flex">
              POWERED BY ICPilot-AFL
            </span>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-3">
          <div className="w-[min(30rem,38vw)] min-w-[15rem] max-w-full">
            <NodeSwitcherDropdown />
          </div>

          <div className="flex shrink-0 items-center rounded-full border border-border/70 bg-background px-3 py-2 shadow-sm">
            {backendHealthQuery.data ? (
              <CircleDot className="size-3.5 text-success" />
            ) : backendHealthQuery.isError ? (
              <AlertCircle className="size-3.5 text-danger" />
            ) : (
              <CircleDot className="size-3.5 animate-pulse text-warning" />
            )}
            <span className="ml-2 whitespace-nowrap text-[13px] font-medium text-foreground">
              {statusLabel}
            </span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0 rounded-full border-border/70 bg-background shadow-console"
            onClick={toggleTheme}
            aria-label="切换主题"
          >
            {theme === "dark" ? (
              <SunMedium className="size-[1.125rem]" />
            ) : (
              <MoonStar className="size-[1.125rem]" />
            )}
          </Button>

          <UserMenu />
        </div>
      </div>
    </header>
  );
}

import { useEffect, useRef, useState } from "react";
import {
  ActivitySquare,
  Binary,
  Blocks,
  Bug,
  ChevronDown,
  ChevronRight,
  FileText,
  FolderTree,
  Gauge,
  History,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  Sparkles,
} from "lucide-react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils/cn";
import { useUiStore } from "@/stores/ui-store";

const SIDEBAR_TRANSITION_MS = 220;

const navigation = [
  { to: "/dashboard", label: "仪表盘", icon: Gauge },
  { to: "/assets", label: "资产中心", icon: FolderTree },
  { to: "/jobs", label: "Fuzz 任务", icon: ActivitySquare },
  { to: "/vulns/history", label: "漏洞中心", icon: History },
  { to: "/debug", label: "智能调试", icon: Bug },
  { to: "/artifacts", label: "产物中心", icon: Binary },
  { to: "/reports", label: "报告中心", icon: FileText },
  { to: "/nodes", label: "节点管理", icon: Network },
  { to: "/settings", label: "系统设置", icon: Settings2 },
];

const offlineChildren = [
  { label: "协议提取", tab: "protocol" },
  { label: "漏洞知识库", tab: "vuldocs-kb" },
  { label: "初始种子", tab: "seeds" },
  { label: "风险分析", tab: "risk-analyze" },
  { label: "结果预览", tab: "risk-preview" },
  { label: "风险上传", tab: "risk-upload" },
  { label: "插桩处理", tab: "instrument" },
] as const;

const SIDEBAR_PRIMARY_NAV_BUTTON_CLASS =
  "flex w-full items-center gap-7 rounded-[var(--radius-xl)] px-3 py-3 text-[18px] font-medium transition-all";

export function Sidebar(): JSX.Element {
  const location = useLocation();
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleCollapsed = useUiStore((state) => state.toggleSidebarCollapsed);
  const offlineNavExpanded = useUiStore((state) => state.offlineNavExpanded);
  const setOfflineNavExpanded = useUiStore((state) => state.setOfflineNavExpanded);
  const toggleOfflineNavExpanded = useUiStore((state) => state.toggleOfflineNavExpanded);

  const isOfflineRoute = location.pathname.startsWith("/offline");
  const activeOfflineTab = new URLSearchParams(location.search).get("tab") ?? "protocol";
  const showOfflineChildren = isOfflineRoute || offlineNavExpanded;
  const [showExpandedContent, setShowExpandedContent] = useState(!collapsed);
  const previousCollapsedRef = useRef(collapsed);
  const expandedContentTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const wasCollapsed = previousCollapsedRef.current;
    previousCollapsedRef.current = collapsed;

    if (expandedContentTimerRef.current !== null) {
      window.clearTimeout(expandedContentTimerRef.current);
      expandedContentTimerRef.current = null;
    }

    if (collapsed) {
      setShowExpandedContent(false);
      return;
    }

    if (wasCollapsed) {
      expandedContentTimerRef.current = window.setTimeout(() => {
        setShowExpandedContent(true);
        expandedContentTimerRef.current = null;
      }, SIDEBAR_TRANSITION_MS);
      return;
    }

    setShowExpandedContent(true);

    return () => {
      if (expandedContentTimerRef.current !== null) {
        window.clearTimeout(expandedContentTimerRef.current);
        expandedContentTimerRef.current = null;
      }
    };
  }, [collapsed]);

  useEffect(() => {
    return () => {
      if (expandedContentTimerRef.current !== null) {
        window.clearTimeout(expandedContentTimerRef.current);
        expandedContentTimerRef.current = null;
      }
    };
  }, []);

  return (
    <aside
      className="shell-sidebar fixed inset-y-0 left-0 z-[72] flex shrink-0 flex-col overflow-hidden"
      style={{
        width: collapsed ? "var(--sidebar-w-collapsed)" : "var(--sidebar-w)",
        transition: `width ${SIDEBAR_TRANSITION_MS}ms ease`,
      }}
    >
      <div className="flex min-h-[var(--topbar-h)] items-center gap-3 border-b border-white/8 px-4">
        <Link
          to="/"
          className={cn(
            "group flex min-w-0 items-center gap-4 rounded-[var(--radius-xl)] px-2 py-2.5 transition-colors hover:bg-white/6",
            !showExpandedContent && "justify-center",
          )}
        >
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[hsl(var(--accent-blue))] via-[hsl(var(--accent-pink))] to-[hsl(var(--accent-orange))] text-white shadow-lg shadow-black/20 dark:bg-[linear-gradient(145deg,#fff7ff_0%,#f2b2ff_34%,#9a7cff_68%,#6ea8ff_100%)]">
            <Blocks className="size-6" />
          </div>
          {showExpandedContent ? (
            <div className="min-w-0">
              <p className="truncate text-[20px] font-semibold tracking-tight text-[hsl(var(--sidebar-text))]">
                ICP Fuzz
              </p>
              <p className="truncate text-[13px] uppercase tracking-[0.18em] text-[hsl(var(--sidebar-text-subtle))]">
                Console
              </p>
            </div>
          ) : null}
        </Link>
      </div>

      <nav className="sidebar-scrollbar flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1.5">
          {navigation.slice(0, 1).map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    SIDEBAR_PRIMARY_NAV_BUTTON_CLASS,
                    !showExpandedContent && "justify-center",
                    isActive
                      ? "bg-white/12 text-[hsl(var(--sidebar-text))] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                      : "text-[hsl(var(--sidebar-text-muted))] hover:bg-white/8 hover:text-[hsl(var(--sidebar-text))]",
                  )
                }
              >
                <span className="flex size-7 shrink-0 items-center justify-center">
                  <Icon className="size-6 shrink-0" />
                </span>
                {showExpandedContent ? <span>{item.label}</span> : null}
              </NavLink>
            );
          })}

          <div
            className={cn(
              "rounded-[var(--radius-xl)] transition-colors",
              showExpandedContent ? "border p-1.5" : "border border-transparent p-1.5",
              showExpandedContent
                ? isOfflineRoute
                  ? "border-transparent bg-white/6"
                  : "border-transparent bg-transparent"
                : "bg-transparent",
            )}
          >
            <div className="flex items-center gap-1.5">
              <Link
                to="/offline?tab=protocol"
                onClick={() => setOfflineNavExpanded(true)}
                className={cn(
                  SIDEBAR_PRIMARY_NAV_BUTTON_CLASS,
                  "min-w-0 flex-1",
                  showExpandedContent && "min-h-[3.25rem] leading-6",
                  !showExpandedContent && "justify-center",
                  isOfflineRoute
                    ? showExpandedContent
                      ? "text-[hsl(var(--sidebar-text))]"
                      : "bg-white/12 text-[hsl(var(--sidebar-text))] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                    : "text-[hsl(var(--sidebar-text-muted))] hover:bg-white/8 hover:text-[hsl(var(--sidebar-text))]",
                )}
              >
                <span className="flex size-7 shrink-0 items-center justify-center">
                  <Sparkles className="size-6 shrink-0" />
                </span>
                {showExpandedContent ? <span className="truncate">协议准备工作台</span> : null}
              </Link>
              {showExpandedContent ? (
                <button
                  type="button"
                  onClick={toggleOfflineNavExpanded}
                  aria-label={showOfflineChildren ? "收起离线导航" : "展开离线导航"}
                  className={cn(
                    "flex w-12 shrink-0 items-center justify-center rounded-[var(--radius-xl)] text-[hsl(var(--sidebar-text-subtle))] transition-colors hover:bg-white/8 hover:text-[hsl(var(--sidebar-text))]",
                    showExpandedContent && "h-[3.25rem]",
                  )}
                >
                  {showOfflineChildren ? (
                    <ChevronDown className="size-5" />
                  ) : (
                    <ChevronRight className="size-5" />
                  )}
                </button>
              ) : null}
            </div>

            {showExpandedContent && showOfflineChildren ? (
              <div className="mt-1.5 space-y-1 border-t border-white/8 pt-1.5">
                {offlineChildren.map((item) => {
                  const isActive = isOfflineRoute && activeOfflineTab === item.tab;
                  return (
                    <Link
                      key={item.tab}
                      to={`/offline?tab=${item.tab}`}
                      className={cn(
                        "flex items-center rounded-[var(--radius-lg)] py-2.5 pl-12 pr-3.5 text-[16px] font-medium transition-colors",
                        isActive
                          ? "bg-white/10 text-[hsl(var(--sidebar-text))]"
                          : "text-[hsl(var(--sidebar-text-subtle))] hover:bg-white/6 hover:text-[hsl(var(--sidebar-text-muted))]",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="space-y-1.5">
            {navigation.slice(1).map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex w-full items-center gap-7 rounded-[var(--radius-xl)] px-3 py-3 text-[18px] font-medium transition-all",
                      !showExpandedContent && "justify-center",
                      isActive
                        ? "bg-white/12 text-[hsl(var(--sidebar-text))] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                        : "text-[hsl(var(--sidebar-text-muted))] hover:bg-white/8 hover:text-[hsl(var(--sidebar-text))]",
                    )
                  }
                >
                  <span className="flex size-6 shrink-0 items-center justify-center">
                    <Icon className="size-6 shrink-0" />
                  </span>
                  {showExpandedContent ? <span>{item.label}</span> : null}
                </NavLink>
              );
            })}
          </div>
        </div>
      </nav>

      <div className="border-t border-white/8 px-3 py-3">
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "展开导航栏" : "收起导航栏"}
          className={cn(
            "flex w-full items-center gap-9 rounded-[var(--radius-xl)] px-3 py-3 text-[18px] font-medium text-[hsl(var(--sidebar-text-muted))] transition-colors hover:bg-white/8 hover:text-[hsl(var(--sidebar-text))]",
            !showExpandedContent && "justify-center",
          )}
        >
          <span className="flex size-7 shrink-0 items-center justify-center">
            {collapsed ? (
              <PanelLeftOpen className="size-6 shrink-0" />
            ) : (
              <PanelLeftClose className="size-[1.125rem] shrink-0" />
            )}
          </span>
          {showExpandedContent ? <span>收起导航</span> : null}
        </button>
      </div>
    </aside>
  );
}

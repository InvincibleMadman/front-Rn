import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Bug,
  ChevronDown,
  ChevronUp,
  Filter,
  Info,
  ListTree,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  TerminalSquare,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { useFeedbackStore } from "@/stores/feedback-store";
import { useUiStore } from "@/stores/ui-store";

export type LogLevel = "info" | "success" | "warn" | "error" | "debug";

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  source: string;
  message: string;
  detail?: unknown;
}

interface DockStore {
  entries: LogEntry[];
  addEntry: (entry: Omit<LogEntry, "id" | "timestamp">) => void;
  clear: () => void;
  maxEntries: number;
}

const MAX_ENTRIES = 500;
const listeners = new Set<() => void>();

let dockState: DockStore = {
  entries: [],
  maxEntries: MAX_ENTRIES,
  addEntry: (entry) => {
    const nextEntry: LogEntry = {
      ...entry,
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date(),
    };
    dockState = {
      ...dockState,
      entries: [...dockState.entries, nextEntry].slice(-MAX_ENTRIES),
    };
    listeners.forEach((listener) => listener());
  },
  clear: () => {
    dockState = { ...dockState, entries: [] };
    listeners.forEach((listener) => listener());
  },
};

export function useDockStore(): DockStore {
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const listener = () => forceUpdate((value) => value + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return dockState;
}

export function dockLog(level: LogLevel, source: string, message: string, detail?: unknown): void {
  dockState.addEntry({ level, source, message, detail });
}

const levelConfig: Record<LogLevel, { icon: typeof Info; tone: string; label: string }> = {
  info: { icon: Info, tone: "text-[hsl(var(--accent-blue))]", label: "信息" },
  success: { icon: ListTree, tone: "text-[hsl(var(--color-success))]", label: "完成" },
  warn: { icon: AlertTriangle, tone: "text-[hsl(var(--color-warning))]", label: "警告" },
  error: { icon: AlertCircle, tone: "text-[hsl(var(--color-danger))]", label: "错误" },
  debug: { icon: Bug, tone: "text-[hsl(var(--accent-pink))]", label: "调试" },
};

const sourceFilters = ["all", "offline", "job", "debug", "system", "api"] as const;
const sourceFilterLabels: Record<(typeof sourceFilters)[number], string> = {
  all: "全部",
  offline: "离线",
  job: "任务",
  debug: "调试",
  system: "系统",
  api: "接口",
};

export function Dock(): JSX.Element {
  const store = useDockStore();
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const [collapsed, setCollapsed] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const [search, setSearch] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const errorEntries = useFeedbackStore((state) => state.entries);
  const openDetail = useFeedbackStore((state) => state.openDetail);

  const filteredEntries = store.entries.filter((entry) => {
    if (filter !== "all" && !entry.source.startsWith(filter)) return false;
    if (search.trim() && !`${entry.source} ${entry.message}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  useEffect(() => {
    if (!autoScroll || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [autoScroll, filteredEntries.length]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((value) => {
      const next = !value;
      if (next) setMaximized(false);
      return next;
    });
  }, []);

  const toggleMaximized = useCallback(() => {
    setMaximized((value) => !value);
  }, []);

  const dockLeft = sidebarCollapsed ? "var(--sidebar-w-collapsed)" : "var(--sidebar-w)";
  const dockTop = !collapsed && maximized ? "var(--topbar-h)" : undefined;
  const dockHeight = collapsed ? "3rem" : maximized ? "calc(100vh - var(--topbar-h))" : "var(--dock-h)";

  return (
    <section
      className="dock-panel dock-console-grid fixed bottom-0 right-0 z-[74] flex flex-col"
      style={{
        left: dockLeft,
        top: dockTop,
        height: dockHeight,
        transition: "height 220ms ease, left 220ms ease, top 220ms ease",
      }}
    >
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-[hsl(var(--dock-border)/0.9)] px-4">
        <button
          type="button"
          onClick={toggleCollapsed}
          className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-[hsl(var(--dock-foreground))] transition-colors hover:bg-[hsl(var(--dock-surface-alt)/0.65)]"
          aria-label={collapsed ? "展开全局日志栏" : "收起全局日志栏"}
        >
          {collapsed ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          <TerminalSquare className="size-4" />
          <span>全局日志栏</span>
          {errorEntries.length > 0 ? (
            <span className="rounded-full bg-danger px-2 py-0.5 text-[10px] font-semibold text-danger-foreground">
              {errorEntries.length}
            </span>
          ) : null}
        </button>

        {!collapsed ? (
          <>
            <div className="flex items-center gap-1 rounded-full border border-[hsl(var(--dock-border)/0.9)] bg-[hsl(var(--dock-surface-alt)/0.86)] p-1">
              {sourceFilters.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                    filter === item
                      ? "bg-[hsl(var(--dock-surface))] text-[hsl(var(--dock-foreground))]"
                      : "text-[hsl(var(--dock-muted))] hover:text-[hsl(var(--dock-foreground))]",
                  )}
                >
                  {sourceFilterLabels[item]}
                </button>
              ))}
            </div>

            <div className="relative ml-auto flex w-[min(16rem,20vw)] min-w-[10rem] items-center">
              <Filter className="absolute left-3 size-3.5 text-[hsl(var(--dock-muted))]" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索日志内容..."
                className="h-9 w-full rounded-full border border-[hsl(var(--dock-border)/0.9)] bg-[hsl(var(--dock-surface)/0.86)] pl-9 pr-3 text-xs text-[hsl(var(--dock-foreground))] placeholder:text-[hsl(var(--dock-muted))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent-pink))]"
              />
            </div>

            <Button
              size="icon"
              variant="ghost"
              className="size-8 text-[hsl(var(--dock-muted))] hover:bg-[hsl(var(--dock-surface-alt)/0.65)] hover:text-[hsl(var(--dock-foreground))]"
              aria-label={maximized ? "还原日志栏" : "放大日志栏"}
              onClick={toggleMaximized}
            >
              {maximized ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-8 text-[hsl(var(--dock-muted))] hover:bg-[hsl(var(--dock-surface-alt)/0.65)] hover:text-[hsl(var(--dock-foreground))]"
              aria-label={autoScroll ? "暂停自动滚动" : "开启自动滚动"}
              onClick={() => setAutoScroll((value) => !value)}
            >
              {autoScroll ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-8 text-[hsl(var(--dock-muted))] hover:bg-[hsl(var(--dock-surface-alt)/0.65)] hover:text-[hsl(var(--dock-foreground))]"
              aria-label="清空日志"
              onClick={store.clear}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </>
        ) : null}
      </div>

      {!collapsed ? (
        <div
          className={cn(
            "grid min-h-0 flex-1 overflow-hidden",
            maximized ? "grid-cols-[minmax(0,1fr)_24rem]" : "grid-cols-[minmax(0,1fr)_21rem]",
          )}
        >
          <div ref={scrollRef} className="dock-scrollbar min-h-0 overflow-y-auto px-4 py-3">
            {filteredEntries.length === 0 ? (
              <p className="py-8 text-center text-xs text-[hsl(var(--dock-muted))]">暂无日志</p>
            ) : (
              <div className="space-y-1.5">
                {filteredEntries.map((entry) => {
                  const config = levelConfig[entry.level];
                  const Icon = config.icon;
                  return (
                    <div
                      key={entry.id}
                      className="rounded-[var(--radius-lg)] border border-[hsl(var(--dock-border)/0.7)] bg-[hsl(var(--dock-surface)/0.86)] px-3 py-2 hover:bg-[hsl(var(--dock-surface-alt)/0.9)]"
                    >
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 text-[11px] text-[hsl(var(--dock-muted))]">
                          {entry.timestamp.toLocaleTimeString("zh-CN", { hour12: false })}
                        </span>
                        <Icon className={cn("mt-0.5 size-3.5 shrink-0", config.tone)} />
                        <span className={cn("shrink-0 text-[10px] font-semibold uppercase", config.tone)}>{config.label}</span>
                        <span className="shrink-0 rounded-full bg-[hsl(var(--dock-surface-alt)/0.85)] px-2 py-0.5 text-[10px] text-[hsl(var(--dock-muted))]">
                          {entry.source}
                        </span>
                        <span className="min-w-0 flex-1 break-all text-[12px] text-[hsl(var(--dock-foreground))]">{entry.message}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-l border-[hsl(var(--dock-border)/0.9)] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[hsl(var(--dock-muted))]">错误详情</p>
            <div className="mt-3 space-y-2">
              {errorEntries.length === 0 ? (
                <div className="rounded-[var(--radius-lg)] border border-[hsl(var(--dock-border)/0.7)] bg-[hsl(var(--dock-surface)/0.86)] px-3 py-4 text-xs text-[hsl(var(--dock-muted))]">
                  暂无错误详情。
                </div>
              ) : (
                errorEntries.slice(-6).reverse().map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className="w-full rounded-[var(--radius-lg)] border border-danger/18 bg-danger/8 px-3 py-3 text-left transition-colors hover:bg-danger/12"
                    onClick={() => openDetail(entry.id)}
                  >
                    <p className="text-sm font-medium text-[hsl(var(--dock-foreground))]">{entry.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-[hsl(var(--dock-muted))]">{entry.error.message}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

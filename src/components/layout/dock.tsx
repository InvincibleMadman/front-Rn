import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
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
import { JsonViewer } from "@/components/common/json-viewer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
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
const DEFAULT_DETAIL_WIDTH = 360;
const MIN_LIST_WIDTH = 260;
const MIN_DETAIL_WIDTH = 260;
const SPLITTER_WIDTH = 12;
const listeners = new Set<() => void>();

function clampDetailWidth(width: number, containerWidth: number): number {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) {
    return Math.max(width, MIN_DETAIL_WIDTH);
  }

  const maxWidth = Math.max(180, containerWidth - MIN_LIST_WIDTH - SPLITTER_WIDTH);
  const minWidth = Math.min(MIN_DETAIL_WIDTH, maxWidth);

  return Math.min(Math.max(width, minWidth), maxWidth);
}

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

type SourceFilter =
  | "all"
  | "offline"
  | "job"
  | "debug"
  | "assets"
  | "system"
  | "api";

const sourceFilters: SourceFilter[] = ["all", "offline", "job", "debug", "assets", "system", "api"];
const sourceFilterLabels: Record<SourceFilter, string> = {
  all: "全部",
  offline: "离线",
  job: "任务",
  debug: "调试",
  assets: "资产域",
  system: "系统",
  api: "接口",
};

function normalizeLogDetail(detail: unknown): unknown {
  if (detail instanceof Error) {
    return {
      name: detail.name,
      message: detail.message,
      stack: detail.stack,
    };
  }

  return detail;
}

function resolveSourceFilter(source: string): SourceFilter {
  const normalized = source.trim().toLowerCase();

  if (normalized.startsWith("offline")) return "offline";
  if (normalized.startsWith("job")) return "job";
  if (normalized.startsWith("debug")) return "debug";
  if (normalized.startsWith("asset") || normalized.startsWith("artifact")) return "assets";
  if (normalized.startsWith("report") || normalized.startsWith("vuln")) return "assets";
  if (
    normalized.startsWith("setting")
    || normalized.startsWith("auth")
    || normalized.startsWith("operation")
    || normalized.startsWith("system")
    || normalized.startsWith("dashboard")
    || normalized.startsWith("home")
  ) {
    return "system";
  }
  if (normalized.startsWith("node")) return "api";
  if (normalized.startsWith("api")) return "api";

  return "api";
}

export function Dock(): JSX.Element {
  const store = useDockStore();
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const errorEntries = useFeedbackStore((state) => state.entries);
  const [collapsed, setCollapsed] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [filter, setFilter] = useState<SourceFilter>("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [detailWidth, setDetailWidth] = useState(DEFAULT_DETAIL_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dockBodyRef = useRef<HTMLDivElement | null>(null);

  const filteredEntries = store.entries.filter((entry) => {
    if (filter !== "all" && resolveSourceFilter(entry.source) !== filter) return false;
    if (search.trim() && !`${entry.source} ${entry.message}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const selectedEntry = filteredEntries.find((entry) => entry.id === selectedEntryId) ?? null;

  useEffect(() => {
    if (!autoScroll || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [autoScroll, filteredEntries.length]);

  useEffect(() => {
    if (filteredEntries.length === 0) {
      setSelectedEntryId(null);
      return;
    }

    setSelectedEntryId((current) => {
      if (current && filteredEntries.some((entry) => entry.id === current)) {
        return current;
      }

      return filteredEntries[filteredEntries.length - 1]?.id ?? null;
    });
  }, [filteredEntries]);

  useEffect(() => {
    if (collapsed) return;

    const syncDetailWidth = () => {
      const containerWidth = dockBodyRef.current?.clientWidth ?? 0;
      setDetailWidth((current) => clampDetailWidth(current, containerWidth));
    };

    const frame = window.requestAnimationFrame(syncDetailWidth);
    window.addEventListener("resize", syncDetailWidth);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", syncDetailWidth);
    };
  }, [collapsed, maximized, sidebarCollapsed]);

  useEffect(() => {
    if (!isResizing) return;

    const handlePointerMove = (event: PointerEvent) => {
      const rect = dockBodyRef.current?.getBoundingClientRect();
      if (!rect) return;
      const nextWidth = rect.right - event.clientX;
      setDetailWidth(clampDetailWidth(nextWidth, rect.width));
    };

    const handlePointerUp = () => {
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [isResizing]);

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

  const startResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = dockBodyRef.current?.getBoundingClientRect();
    if (rect) {
      const nextWidth = rect.right - event.clientX;
      setDetailWidth(clampDetailWidth(nextWidth, rect.width));
    }
    setIsResizing(true);
  }, []);

  const resetDetailWidth = useCallback(() => {
    const containerWidth = dockBodyRef.current?.clientWidth ?? 0;
    setDetailWidth(clampDetailWidth(DEFAULT_DETAIL_WIDTH, containerWidth));
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
                className="h-9 w-full rounded-full border border-[hsl(var(--dock-border)/0.9)] bg-[hsl(var(--dock-surface)/0.86)] pl-9 pr-3 text-xs text-[hsl(var(--dock-foreground))] shadow-sm transition-colors placeholder:text-[hsl(var(--dock-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:focus-visible:ring-[hsl(var(--accent-pink))]"
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
              onClick={() => {
                store.clear();
                setSelectedEntryId(null);
              }}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </>
        ) : null}
      </div>

      {!collapsed ? (
        <div ref={dockBodyRef} className="flex min-h-0 flex-1 overflow-hidden">
          <div className="min-w-0 flex-1 overflow-hidden">
            <div ref={scrollRef} className="dock-scrollbar h-full overflow-y-auto px-4 py-3">
              {filteredEntries.length === 0 ? (
                <p className="py-8 text-center text-xs text-[hsl(var(--dock-muted))]">暂无日志</p>
              ) : (
                <div className="space-y-1.5">
                  {filteredEntries.map((entry) => {
                    const config = levelConfig[entry.level];
                    const Icon = config.icon;
                    const isSelected = selectedEntry?.id === entry.id;

                    return (
                      <button
                        key={entry.id}
                        type="button"
                      onClick={() => setSelectedEntryId(entry.id)}
                      className={cn(
                        "w-full rounded-[var(--radius-lg)] border px-3 py-2 text-left transition-colors",
                        isSelected
                          ? "border-[hsl(var(--accent-blue)/0.5)] bg-[hsl(var(--dock-surface-alt)/0.98)] shadow-[0_18px_34px_hsl(var(--shadow)/0.12),0_0_0_3px_hsl(var(--accent-blue)/0.18)] ring-1 ring-[hsl(var(--accent-blue)/0.3)] dark:border-[hsl(var(--accent-pink)/0.45)] dark:bg-[hsl(var(--dock-surface-alt)/0.96)] dark:ring-1 dark:ring-[hsl(var(--accent-pink)/0.18)] dark:shadow-[0_16px_30px_rgba(0,0,0,0.24)]"
                          : "border-[hsl(var(--dock-border)/0.7)] bg-[hsl(var(--dock-surface)/0.86)] hover:border-[hsl(var(--accent-blue)/0.26)] hover:bg-[hsl(var(--dock-surface-alt)/0.94)] hover:shadow-[0_0_0_1px_hsl(var(--accent-blue)/0.08)] dark:hover:border-[hsl(var(--accent-pink)/0.2)] dark:hover:shadow-[0_0_0_1px_hsl(var(--accent-pink)/0.08)]",
                      )}
                    >
                        <div className="flex items-start gap-2">
                          <span className="shrink-0 text-[11px] text-[hsl(var(--dock-muted))]">
                            {entry.timestamp.toLocaleTimeString("zh-CN", { hour12: false })}
                          </span>
                          <Icon className={cn("mt-0.5 size-3.5 shrink-0", config.tone)} />
                          <span className={cn("shrink-0 text-[10px] font-semibold uppercase", config.tone)}>
                            {config.label}
                          </span>
                          <span className="shrink-0 rounded-full bg-[hsl(var(--dock-surface-alt)/0.85)] px-2 py-0.5 text-[10px] text-[hsl(var(--dock-muted))]">
                            {entry.source}
                          </span>
                          <span className="min-w-0 flex-1 break-all text-[12px] text-[hsl(var(--dock-foreground))]">
                            {entry.message}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="调整日志详情宽度"
            onPointerDown={startResize}
            onDoubleClick={resetDetailWidth}
            className={cn(
              "group relative shrink-0 cursor-col-resize touch-none",
              isResizing ? "bg-[hsl(var(--accent-blue)/0.1)] dark:bg-[hsl(var(--accent-pink)/0.08)]" : "bg-transparent",
            )}
            style={{ width: `${SPLITTER_WIDTH}px` }}
          >
            <div
              className={cn(
                "absolute inset-y-2 left-1/2 w-px -translate-x-1/2 rounded-full transition-colors",
                isResizing
                  ? "bg-[hsl(var(--accent-blue)/0.86)] dark:bg-[hsl(var(--accent-pink)/0.82)]"
                  : "bg-[hsl(var(--dock-border)/0.96)] group-hover:bg-[hsl(var(--accent-blue)/0.52)] dark:group-hover:bg-[hsl(var(--accent-pink)/0.56)]",
              )}
            />
            <div
              className={cn(
                "absolute inset-y-3 left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-[hsl(var(--accent-blue)/0.36)] transition-opacity dark:bg-[hsl(var(--accent-pink)/0.32)]",
                isResizing ? "opacity-100" : "opacity-0 group-hover:opacity-100",
              )}
            />
          </div>

          <div className="flex min-h-0 shrink-0 flex-col overflow-hidden" style={{ width: `${detailWidth}px` }}>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.24em] text-[hsl(var(--dock-muted))]">日志详情</p>
              {errorEntries.length > 0 ? (
                <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-semibold text-danger">
                  {errorEntries.length} errors
                </span>
              ) : null}
            </div>

            {selectedEntry ? (
              <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-3">
                <div className="rounded-[var(--radius-lg)] border border-[hsl(var(--dock-border)/0.7)] bg-[hsl(var(--dock-surface)/0.86)] px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("text-[10px] font-semibold uppercase", levelConfig[selectedEntry.level].tone)}>
                      {levelConfig[selectedEntry.level].label}
                    </span>
                    <span className="rounded-full bg-[hsl(var(--dock-surface-alt)/0.85)] px-2 py-0.5 text-[10px] text-[hsl(var(--dock-muted))]">
                      {selectedEntry.source}
                    </span>
                    <span className="text-[11px] text-[hsl(var(--dock-muted))]">
                      {selectedEntry.timestamp.toLocaleString("zh-CN", { hour12: false })}
                    </span>
                  </div>
                  <p className="mt-3 break-all text-sm text-[hsl(var(--dock-foreground))]">
                    {selectedEntry.message}
                  </p>
                </div>

                <div className="min-h-0 flex-1 overflow-hidden rounded-[var(--radius-lg)] border border-[hsl(var(--dock-border)/0.7)] bg-[hsl(var(--dock-surface)/0.86)]">
                  <div className="dock-scrollbar h-full overflow-y-auto px-3 py-3 pr-2">
                    {selectedEntry.detail !== undefined ? (
                      <JsonViewer data={normalizeLogDetail(selectedEntry.detail)} compact />
                    ) : (
                      <div className="rounded-[var(--radius-lg)] border border-dashed border-[hsl(var(--dock-border)/0.7)] px-3 py-4 text-xs text-[hsl(var(--dock-muted))]">
                        该日志没有附带结构化详情。
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-4 pb-3">
                <div className="rounded-[var(--radius-lg)] border border-[hsl(var(--dock-border)/0.7)] bg-[hsl(var(--dock-surface)/0.86)] px-3 py-4 text-xs text-[hsl(var(--dock-muted))]">
                  选择左侧一条日志后，可在这里查看详细信息。
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, RefreshCw, X } from "lucide-react";
import { nodesApi } from "@/lib/api/services/nodes";
import { useUiStore } from "@/stores/ui-store";
import type { ApiNode, NodePingResult } from "@/types/api/nodes";
import { Button } from "@/components/ui/button";
import { ApiErrorReporter } from "@/components/common/api-error-alert";
import { cn } from "@/lib/utils/cn";

const PING_FLOATING_CARD_AUTO_CLOSE_MS = 8_000;

export function NodeSwitcherDropdown(): JSX.Element {
  const selectedNodeId = useUiStore((state) => state.selectedApiNodeId);

  const [open, setOpen] = useState(false);
  const [pingResult, setPingResult] = useState<NodePingResult | null>(null);
  const [pingError, setPingError] = useState<unknown>();

  const rootRef = useRef<HTMLDivElement | null>(null);

  const nodesQuery = useQuery({
    queryKey: ["api-nodes"],
    queryFn: nodesApi.loadAllNodes,
    staleTime: 15_000,
  });

  const nodes = nodesQuery.data?.nodes ?? [];

  const selected = useMemo(
    () =>
      nodes.find((node) => node.id === selectedNodeId) ??
      nodes[0],
    [nodes, selectedNodeId],
  );

  const clearPingFloatingCard = (): void => {
    setPingResult(null);
    setPingError(undefined);
  };

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (target instanceof Node && rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!pingResult && !pingError) return;

    const timer = window.setTimeout(() => {
      clearPingFloatingCard();
    }, PING_FLOATING_CARD_AUTO_CLOSE_MS);

    return () => window.clearTimeout(timer);
  }, [pingError, pingResult]);

  const pingMutation = useMutation({
    mutationFn: async (node: ApiNode) => nodesApi.pingNode(node),
    onSuccess: (result) => {
      setOpen(false);
      setPingResult(result);
      setPingError(undefined);
    },
    onError: (error) => {
      setOpen(false);
      setPingError(error);
      setPingResult(null);
    },
  });

  const switchNode = (node: ApiNode): void => {
    nodesApi.selectNode(node);
    clearPingFloatingCard();
    setOpen(false);
  };

  const handleTriggerClick = (): void => {
    if (open) {
      setOpen(false);
      return;
    }

    if (pingError || pingResult) {
      clearPingFloatingCard();

      window.requestAnimationFrame(() => {
        setOpen(true);
      });

      return;
    }

    setOpen(true);
  };

  return (
    <div ref={rootRef} className="relative flex w-full min-w-0 items-center gap-3">
      <ApiErrorReporter error={nodesQuery.error} title="加载节点列表失败" source="node-switcher" />
      <ApiErrorReporter error={pingError} title="节点 Ping 失败" source="node-switcher" />
      <button
        type="button"
        onClick={handleTriggerClick}
        className={cn(
          "flex h-11 min-w-0 flex-1 items-center justify-between gap-3 rounded-[var(--radius-xl)] border border-input bg-background px-3 py-2 text-left text-sm text-foreground transition-colors shadow-console",
          "hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="切换后端节点"
      >
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{selected?.name ?? "选择后端节点"}</div>
          <div className="truncate text-xs text-muted-foreground">{selected?.baseUrl ?? "通过 Web BFF 代理访问"}</div>
        </div>
        <ChevronDown className={cn("size-4 shrink-0 opacity-70 transition-transform", open && "rotate-180")} />
      </button>

      <Button
        type="button"
        variant="outline"
        size="icon"
        className="shrink-0 rounded-[var(--radius-lg)] shadow-console"
        onClick={() => {
          clearPingFloatingCard();
          if (selected) pingMutation.mutate(selected);
        }}
        title="Ping 当前节点"
      >
        <RefreshCw className={cn("size-4", pingMutation.isPending && "animate-spin")} />
      </Button>

      {open ? (
        <div
          role="listbox"
          className="console-scrollbar absolute left-0 top-[calc(100%+0.5rem)] z-[90] max-h-[min(22rem,calc(100vh-7rem))] w-full min-w-0 overflow-y-auto rounded-[var(--radius-xl)] border border-border bg-popover p-2 shadow-console"
          style={{ maxWidth: "min(32rem, calc(100vw - 2.5rem))" }}
        >
          {nodesQuery.isLoading ? (
            <div className="rounded-[var(--radius-md)] px-3 py-3 text-sm text-muted-foreground">正在加载节点...</div>
          ) : null}

          {!nodesQuery.isLoading && nodes.length === 0 ? (
            <div className="rounded-[var(--radius-md)] px-3 py-3 text-sm text-muted-foreground">
              {nodesQuery.error
                ? "节点列表暂不可用，详细错误已转入全局弹窗与日志栏。"
                : "暂无节点，请进入“后端节点管理”页面添加。"}
            </div>
          ) : null}

          {nodes.map((node) => {
            const active = node.id === selected?.id;

            return (
              <button
                key={node.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => switchNode(node)}
                className={cn(
                  "flex w-full items-start justify-between gap-3 rounded-[var(--radius-md)] px-3 py-3 text-left transition-colors",
                  active ? "bg-primary/12 text-foreground" : "hover:bg-secondary",
                )}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{node.name}</span>

                    {active ? (
                      <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[11px] text-primary">当前</span>
                    ) : null}

                    {node.readonly ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">默认</span>
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">自定义</span>
                    )}
                  </div>

                  <div className="mt-1 break-all text-xs text-muted-foreground">{node.baseUrl}</div>

                  {node.description ? (
                    <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{node.description}</div>
                  ) : null}
                </div>

                {active ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {pingResult ? (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-[95] w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-success/30 bg-card p-3 pr-10 text-xs shadow-console">
          <button
            type="button"
            onClick={clearPingFloatingCard}
            className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            title="关闭"
          >
            <X className="size-3.5" />
          </button>

          <div className="flex items-center gap-2 text-success">
            <CheckCircle2 className="size-4" />
            Ping 成功 · {pingResult.latencyMs} ms · {pingResult.endpoint}
          </div>

          <div className="mt-1 truncate text-muted-foreground">
            {String(
              (pingResult.data as { version?: unknown } | undefined)?.version ??
                (pingResult.data as { system?: unknown } | undefined)?.system ??
                "fuzz-server",
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

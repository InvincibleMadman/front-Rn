import { useEffect } from "react";
import { AlertTriangle, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { normalizeApiError } from "@/lib/api/errors";
import { useFeedbackStore } from "@/stores/feedback-store";
import { dockLog } from "@/components/layout/dock";

export function reportGlobalError(error: unknown, title = "请求失败", source = "api"): void {
  const payload = normalizeApiError(error, title);
  useFeedbackStore.getState().pushError({
    title,
    error: payload,
    source,
  });
  dockLog("error", source, `${title}: ${payload.message}`, payload);
}

export function GlobalErrorCenter(): JSX.Element | null {
  const entries = useFeedbackStore((state) => state.entries);
  const activeId = useFeedbackStore((state) => state.activeId);
  const dismiss = useFeedbackStore((state) => state.dismiss);
  const clear = useFeedbackStore((state) => state.clear);
  const openDetail = useFeedbackStore((state) => state.openDetail);
  const closeDetail = useFeedbackStore((state) => state.closeDetail);

  const active = entries.find((entry) => entry.id === activeId);

  useEffect(() => {
    if (!entries.length) return;
    const timer = window.setTimeout(() => {
      dismiss(entries[0].id);
    }, 6500);
    return () => window.clearTimeout(timer);
  }, [dismiss, entries]);

  if (!entries.length) return null;

  return (
    <>
      <div className="pointer-events-none fixed right-4 top-[calc(var(--topbar-h)+1rem)] z-[110] flex w-[min(28rem,calc(100vw-2rem))] flex-col gap-3">
        {entries.slice(-3).reverse().map((entry) => (
          <div
            key={entry.id}
            className="pointer-events-auto overflow-hidden rounded-[var(--radius-xl)] border border-danger/30 bg-[hsl(var(--bg-dialog)/0.96)] shadow-2xl shadow-[hsl(var(--danger)/0.16)] backdrop-blur-xl"
          >
            <div className="flex items-start gap-3 border-b border-danger/20 px-4 py-3">
              <div className="mt-0.5 rounded-full bg-danger/12 p-2 text-danger">
                <AlertTriangle className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{entry.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{entry.error.message}</p>
              </div>
              <button
                type="button"
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => dismiss(entry.id)}
                aria-label="关闭错误提示"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <span className="truncate text-xs text-muted-foreground">
                {entry.source ?? "api"} · {new Date(entry.createdAt).toLocaleTimeString("zh-CN", { hour12: false })}
              </span>
              <Button size="sm" variant="outline" onClick={() => openDetail(entry.id)}>
                查看详情
                <ExternalLink className="size-3.5" />
              </Button>
            </div>
          </div>
        ))}
        {entries.length > 1 ? (
          <div className="pointer-events-auto flex justify-end">
            <Button size="sm" variant="ghost" onClick={clear}>
              清空错误
            </Button>
          </div>
        ) : null}
      </div>

      <Dialog open={Boolean(active)} onOpenChange={(open) => (open ? undefined : closeDetail())}>
        {active ? (
          <DialogContent className="w-[min(92vw,56rem)] max-h-[min(80vh,54rem)] overflow-hidden bg-[hsl(var(--bg-dialog)/0.98)] p-0">
            <div className="border-b border-border/60 px-6 py-5">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Error Detail</p>
              <h2 className="mt-2 text-xl font-semibold">{active.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {active.source ?? "api"} · {new Date(active.createdAt).toLocaleString("zh-CN", { hour12: false })}
              </p>
            </div>
            <div className="console-scrollbar max-h-[calc(min(80vh,54rem)-7rem)] overflow-y-auto px-6 py-5">
              <ApiErrorAlert error={active.error} title={active.title} reportToGlobal={false} />
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}

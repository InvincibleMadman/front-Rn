import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Activity, RefreshCw, TerminalSquare } from "lucide-react";
import { operationsApi } from "@/lib/api/services/operations";
import type { OperationLogItem } from "@/types/api/operations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/status-badge";
import { ApiErrorReporter } from "@/components/common/api-error-alert";
import { formatDateTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function tokenClassName(token: string): string {
  if (/^(error|fatal|failed|exception|traceback)$/i.test(token)) return "text-danger font-semibold";
  if (/^(warn|warning|degraded|retry)$/i.test(token)) return "text-warning font-semibold";
  if (/^(info|start|done|finished|success|ok)$/i.test(token)) return "text-success font-semibold";
  if (/^(debug|scan|stage|running)$/i.test(token)) return "text-primary font-semibold";
  if (/^CWE-\d+$/i.test(token)) return "text-accent font-semibold";
  if (/^SIG[A-Z0-9]+$/.test(token)) return "text-danger font-semibold";
  if (/^["'`].*["'`]$/.test(token)) return "text-success";
  if (/^\/?[\w.-]+(?:\/[\w.+-]+)+$/.test(token)) return "text-accent";
  if (/^\d+(?:\.\d+)?$/.test(token)) return "text-warning";
  if (/^[{}\[\]():,]$/.test(token)) return "text-muted-foreground";
  return "text-foreground";
}

function renderHighlightedText(text: string, keyPrefix: string): ReactNode {
  const tokens = text.split(
    /(\b(?:ERROR|FATAL|FAILED|EXCEPTION|TRACEBACK|WARN|WARNING|DEGRADED|RETRY|INFO|START|DONE|FINISHED|SUCCESS|OK|DEBUG|SCAN|STAGE|RUNNING)\b|\bCWE-\d+\b|\bSIG[A-Z0-9]+\b|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|`(?:\\.|[^`])*`|\/?[\w.-]+(?:\/[\w.+-]+)+|\b\d+(?:\.\d+)?\b|[{}\[\]():,])/gi,
  );

  return tokens.map((token, index) => {
    if (!token) return null;
    return (
      <span key={`${keyPrefix}-${index}`} className={tokenClassName(token)}>
        {token}
      </span>
    );
  });
}

function levelTone(level?: string): string {
  if (level === "error" || level === "fatal") return "border-danger/30 bg-danger/8";
  if (level === "warning" || level === "warn") return "border-warning/30 bg-warning/8";
  if (level === "debug") return "border-primary/20 bg-primary/6";
  return "border-border/55 bg-card/58";
}

export function OperationLogPanel({
  operationId,
  running = false,
  title = "输出日志",
  maxLines = 300,
  pollIntervalMs = 1_000,
  clearAfterItems = 800,
  variant = "card",
  eagerStart = true,
  note,
  className,
  logClassName,
}: {
  operationId?: string;
  running?: boolean;
  title?: string;
  maxLines?: number;
  pollIntervalMs?: number;
  clearAfterItems?: number;
  variant?: "card" | "compact";
  eagerStart?: boolean;
  note?: string;
  className?: string;
  logClassName?: string;
}): JSX.Element {
  const [items, setItems] = useState<OperationLogItem[]>([]);
  const [nextSeq, setNextSeq] = useState(0);
  const [status, setStatus] = useState<string>(operationId ? "running" : "idle");
  const [error, setError] = useState<unknown>();
  const [failures, setFailures] = useState(0);
  const [clearCycles, setClearCycles] = useState(0);
  const fetchingRef = useRef(false);
  const capturedSinceClearRef = useRef(0);
  const logBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setItems([]);
    setNextSeq(0);
    setStatus(operationId ? (eagerStart ? "running" : "idle") : "idle");
    setError(undefined);
    setFailures(0);
    setClearCycles(0);
    capturedSinceClearRef.current = 0;
  }, [eagerStart, operationId]);

  useEffect(() => {
    if (operationId && running && status === "idle") {
      setStatus("running");
    }
  }, [operationId, running, status]);

  const canPoll = Boolean(operationId) && failures <= 5 && (running || status === "running" || status === "unknown");

  const fetchLogs = useCallback(async () => {
    if (!operationId || fetchingRef.current) return;

    fetchingRef.current = true;
    try {
      const tail = await operationsApi.tailLogs(operationId, nextSeq, 200);
      const incoming = tail.items ?? [];

      setStatus(tail.status ?? "unknown");
      setNextSeq(tail.next_seq ?? nextSeq);

      if (incoming.length > 0) {
        const shouldClear = capturedSinceClearRef.current + incoming.length >= clearAfterItems;
        capturedSinceClearRef.current = shouldClear ? incoming.length : capturedSinceClearRef.current + incoming.length;

        if (shouldClear) {
          setClearCycles((value) => value + 1);
        }

        setItems((current) => {
          const merged = shouldClear ? incoming : [...current, ...incoming];
          return merged.slice(-maxLines);
        });
      }

      setError(undefined);
      setFailures(0);
    } catch (err) {
      setError(err);
      setFailures((value) => value + 1);
    } finally {
      fetchingRef.current = false;
    }
  }, [clearAfterItems, maxLines, nextSeq, operationId]);

  useEffect(() => {
    if (!canPoll) return;

    const delay = failures > 0 ? Math.min(5_000, 3_000 + failures * 400) : pollIntervalMs;
    const timer = window.setInterval(() => void fetchLogs(), delay);
    void fetchLogs();

    return () => window.clearInterval(timer);
  }, [canPoll, failures, fetchLogs, pollIntervalMs]);

  useEffect(() => {
    const box = logBoxRef.current;
    if (!box) return;

    window.requestAnimationFrame(() => {
      box.scrollTop = box.scrollHeight;
    });
  }, [items.length, clearCycles]);

  const helperText = useMemo(() => {
    if (!operationId) return "尚未开始。启动任务后这里会显示后端阶段输出。";
    if (failures > 5) return "日志轮询连续失败超过 5 次，已停止自动重试。";
    if (clearCycles > 0) return `已自动清屏 ${clearCycles} 次`;
    return null;
  }, [clearCycles, failures, operationId]);

  const operationText = `operation_id: ${operationId ?? "-"}`;

  const reconnectButton = failures > 5 ? (
    <Button
      size="sm"
      variant="outline"
      onClick={() => {
        setFailures(0);
        void fetchLogs();
      }}
    >
      <RefreshCw className="size-3.5" />
      重新连接
    </Button>
  ) : null;

  const logContent = (
    <>
      <ApiErrorReporter error={error} title="日志读取失败" source="operations" />

      <div
        ref={logBoxRef}
        className={cn(
          "console-scrollbar min-h-0 flex-1 overflow-y-auto rounded-xl border border-border/60 bg-background/72 p-3 font-mono text-xs",
          logClassName,
        )}
      >
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{operationId ? "暂无日志。" : "尚未开始。"}</p>
        ) : (
          <div className="space-y-2">
            {items.map((item, index) => {
              const message = item.message ?? "";
              const dataText = item.data && Object.keys(item.data).length > 0 ? safeStringify(item.data) : "";

              return (
                <div
                  key={`${item.seq}-${index}`}
                  className={cn("rounded-lg border p-2", levelTone(item.level))}
                >
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="text-primary">#{item.seq}</span>
                    <span>{formatDateTime(item.at)}</span>
                    <StatusBadge status={item.level ?? "info"} />
                    {item.stage ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                        {item.stage}
                      </span>
                    ) : null}
                  </div>

                  <pre className="mt-1 whitespace-pre-wrap break-words leading-relaxed">
                    {renderHighlightedText(message, `msg-${item.seq}-${index}`)}
                  </pre>

                  {dataText ? (
                    <pre className="mt-2 whitespace-pre-wrap break-words rounded-md border border-border/45 bg-background/62 p-2 leading-relaxed text-muted-foreground">
                      {renderHighlightedText(dataText, `data-${item.seq}-${index}`)}
                    </pre>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );

  if (variant === "compact") {
    return (
      <div className={cn("flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-background/45 px-4 py-3", className)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Activity className={cn("size-4", running ? "text-primary" : "text-muted-foreground")} />
              {title}
            </div>
            {note ? <p className="mt-2 text-xs text-muted-foreground">{note}</p> : null}
            <p className="mt-2 break-all text-xs text-muted-foreground">{operationText}</p>
            {helperText ? <p className="mt-2 text-xs text-muted-foreground">{helperText}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusBadge status={status} />
            {reconnectButton}
          </div>
        </div>

        <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
          {logContent}
        </div>
      </div>
    );
  }

  const description = [helperText, operationText].filter(Boolean).join(" · ");

  return (
    <Card className={cn("flex h-full min-h-0 flex-col overflow-hidden", className)}>
      <CardHeader className="shrink-0 flex-row items-start justify-between gap-3 pb-3">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2">
            <TerminalSquare className="size-4 text-primary" />
            {title}
          </CardTitle>
          <CardDescription className="break-all">{description}</CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={status} />
          {reconnectButton}
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-5 pb-5 pt-0">
        {logContent}
      </CardContent>
    </Card>
  );
}

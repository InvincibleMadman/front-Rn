import { useEffect, useMemo, useRef } from "react";
import { AlertTriangle, Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JsonViewer } from "@/components/common/json-viewer";
import { StatusBadge } from "@/components/common/status-badge";
import { normalizeApiError, formatApiError, type ApiErrorPayload } from "@/lib/api/errors";
import { cn } from "@/lib/utils/cn";
import { reportGlobalError } from "@/components/common/global-error-report";

function buildReportKey(payload: ApiErrorPayload, title: string, source?: string): string {
  return JSON.stringify({
    title,
    source,
    kind: payload.kind,
    status: payload.status,
    statusText: payload.statusText,
    method: payload.method,
    url: payload.url,
    operationId: payload.operationId,
    requestId: payload.requestId,
    message: payload.message,
  });
}

export function ApiErrorAlert({
  error,
  title = "请求失败",
  compact = false,
  onRetry,
  reportToGlobal,
}: {
  error?: ApiErrorPayload | unknown;
  title?: string;
  compact?: boolean;
  onRetry?: () => void;
  reportToGlobal?: boolean;
}): JSX.Element | null {
  const payload = useMemo(() => (error ? normalizeApiError(error, title) : null), [error, title]);
  const reportedKeyRef = useRef<string | null>(null);
  const shouldReportToGlobal = reportToGlobal ?? !compact;
  const reportKey = useMemo(() => (payload ? buildReportKey(payload, title) : null), [payload, title]);

  useEffect(() => {
    if (!payload) {
      reportedKeyRef.current = null;
      return;
    }

    if (!shouldReportToGlobal || !reportKey || reportedKeyRef.current === reportKey) return;

    reportedKeyRef.current = reportKey;
    reportGlobalError(payload, title);
  }, [payload, reportKey, shouldReportToGlobal, title]);

  if (!payload) return null;

  const detailText = JSON.stringify({
    detail: payload.detail,
    responseBody: payload.responseBody,
    message: payload.message,
  }).toLowerCase();

  const contextualHint = payload.status === 404 && /seed file not found|artifact_path|seed_path|crash seed/.test(detailText)
    ? "artifact_path 必须指向后端主机上的单个崩溃样本文件，不能是目录。"
    : /binary|executable|exec format|permission denied/.test(detailText)
      ? "binary_path 无效，或在后端主机上不可执行。cwd 应只填写运行目录。"
      : payload.hint;

  const copy = async (): Promise<void> => {
    await navigator.clipboard?.writeText(formatApiError(payload));
  };

  return (
    <Card className={cn("border-danger/35 bg-danger/8", compact && "rounded-[var(--radius-lg)]")}>
      <CardHeader className={cn("flex-row items-start justify-between gap-3", compact && "p-3")}>
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-danger" />
            <CardTitle className={cn("text-danger", compact && "text-sm")}>{title}</CardTitle>
            <StatusBadge status={payload.kind} />
          </div>
          <p className="break-words text-sm text-foreground">{payload.message}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {onRetry ? (
            <Button type="button" size="sm" variant="outline" onClick={onRetry}>
              <RefreshCw className="size-3.5" />
              重试
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="outline" onClick={() => void copy()}>
            <Copy className="size-3.5" />
            复制详情
          </Button>
        </div>
      </CardHeader>
      <CardContent className={cn("space-y-3", compact && "p-3 pt-0")}>
        <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
          <div><span className="font-medium text-foreground">类型: </span>{payload.kind}</div>
          {payload.status ? <div><span className="font-medium text-foreground">HTTP: </span>{payload.status} {payload.statusText ?? ""}</div> : null}
          {payload.method ? <div><span className="font-medium text-foreground">方法: </span>{payload.method}</div> : null}
          {payload.url ? <div className="break-all"><span className="font-medium text-foreground">URL: </span>{payload.url}</div> : null}
          {payload.operationId ? <div className="break-all"><span className="font-medium text-foreground">操作: </span>{payload.operationId}</div> : null}
          {payload.requestId ? <div className="break-all"><span className="font-medium text-foreground">请求: </span>{payload.requestId}</div> : null}
        </div>
        {contextualHint ? <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">{contextualHint}</div> : null}
        {!compact ? (
          <details className="rounded-xl border border-border/60 bg-background/50 p-3">
            <summary className="cursor-pointer text-sm font-medium">查看 detail / responseBody</summary>
            <div className="mt-3">
              <JsonViewer data={payload} compact />
            </div>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ApiErrorReporter({
  error,
  title = "请求失败",
  source = "api",
}: {
  error?: ApiErrorPayload | unknown;
  title?: string;
  source?: string;
}): null {
  const payload = useMemo(() => (error ? normalizeApiError(error, title) : null), [error, title]);
  const reportedKeyRef = useRef<string | null>(null);
  const reportKey = useMemo(() => (payload ? buildReportKey(payload, title, source) : null), [payload, source, title]);

  useEffect(() => {
    if (!payload) {
      reportedKeyRef.current = null;
      return;
    }

    if (!reportKey || reportedKeyRef.current === reportKey) return;

    reportedKeyRef.current = reportKey;
    reportGlobalError(payload, title, source);
  }, [payload, reportKey, source, title]);

  return null;
}

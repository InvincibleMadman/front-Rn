import { AlertTriangle, CircleCheck, Info } from "lucide-react";

export function InlineValidationSummary({
  warnings,
  missing,
}: {
  warnings: string[];
  missing: string[];
}): JSX.Element {
  const hasIssue = warnings.length > 0 || missing.length > 0;
  return (
    <div className={`rounded-[var(--radius-lg)] border p-3 ${hasIssue ? "border-warning/30 bg-warning/10" : "border-success/25 bg-success/10"}`}>
      <div className="flex items-center gap-2 text-sm font-medium">
        {hasIssue ? <AlertTriangle className="size-4 text-warning" /> : <CircleCheck className="size-4 text-success" />}
        {hasIssue ? "校验摘要" : "校验通过"}
      </div>
      <div className="mt-3 space-y-2 text-xs text-muted-foreground">
        {missing.length ? (
          <div>
            <p className="font-medium text-foreground">缺失项</p>
            <ul className="mt-1 space-y-1">
              {missing.map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </div>
        ) : null}
        {warnings.length ? (
          <div>
            <p className="font-medium text-foreground">风险提示</p>
            <ul className="mt-1 space-y-1">
              {warnings.map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </div>
        ) : null}
        {!hasIssue ? (
          <div className="flex items-center gap-2 text-foreground">
            <Info className="size-3.5" />
            当前字段足以生成 dry run 或正式任务请求。
          </div>
        ) : null}
      </div>
    </div>
  );
}

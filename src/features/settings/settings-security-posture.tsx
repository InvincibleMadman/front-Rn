import { AlertTriangle, ShieldCheck } from "lucide-react";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsStatusChip } from "@/features/settings/settings-status-chip";

export interface SettingsSecurityCheck {
  label: string;
  passed: boolean;
}

export function SettingsSecurityPosture({
  score,
  passed,
  total,
  available,
  checks,
  highlightDefaultSecretWarning,
}: {
  score: number;
  passed: number;
  total: number;
  available: boolean;
  checks: SettingsSecurityCheck[];
  highlightDefaultSecretWarning: boolean;
}): JSX.Element {
  const warningChecks = checks.filter((item) => !item.passed);
  const passChecks = checks.filter((item) => item.passed);

  return (
    <div className="settings-hero-panel space-y-4">
      <CardHeader className="space-y-2 p-0">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Security posture</CardTitle>
            <CardDescription>只使用真实 BFF 与节点摘要状态计算当前安全姿态。</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">score</p>
            <p className="text-2xl font-semibold text-foreground">{available ? score : "N/A"}</p>
          </div>
        </div>
      </CardHeader>

      {available ? (
        <div className="space-y-2">
          <div className="settings-hero-meter" aria-hidden="true">
            <div className="settings-hero-meter__fill" style={{ width: `${score}%` }} />
            <div className="settings-hero-meter__segments">
              {checks.map((item) => (
                <span key={item.label} data-passed={item.passed ? "true" : "false"} />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{passed} / {total} checks passed</span>
            <span>{score >= 80 ? "healthy" : score >= 60 ? "attention needed" : "hardening required"}</span>
          </div>
        </div>
      ) : (
        <div className="rounded-[var(--radius-lg)] border border-border/60 bg-background/55 px-3 py-3 text-sm text-muted-foreground">
          当前未拿到完整 BFF 或节点安全摘要。看板仅保留中性 unavailable 状态，详细错误已转入全局弹窗与底部日志栏。
        </div>
      )}

      {available && highlightDefaultSecretWarning ? (
        <div className="settings-hero-warning">
          <AlertTriangle className="size-4 shrink-0" />
          <span>default node secret is still in use</span>
        </div>
      ) : null}

      {available ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Warnings</p>
            <div className="flex flex-wrap gap-2">
              {warningChecks.length ? (
                warningChecks.map((item) => (
                  <SettingsStatusChip key={item.label} label={item.label} tone="warning" />
                ))
              ) : (
                <SettingsStatusChip label="No active warnings" tone="success" />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Passed</p>
            <div className="flex flex-wrap gap-2">
              {passChecks.map((item) => (
                <SettingsStatusChip
                  key={item.label}
                  label={item.label}
                  tone="success"
                  className="before:hidden"
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-[var(--radius-lg)] border border-border/60 bg-background/55 px-3 py-3 text-sm text-muted-foreground">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>系统已无 compat 旁路，只保留 Web BFF + `/api/v1/*` 现代链路。</p>
        </div>
      </div>
    </div>
  );
}

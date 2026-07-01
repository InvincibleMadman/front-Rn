import {
  KeyRound,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
  ShieldEllipsis,
} from "lucide-react";
import { SettingsInfoGroup } from "@/features/settings/components/settings-info-group";
import { SettingsInfoRow } from "@/features/settings/components/settings-info-row";
import { SettingsValueChip } from "@/features/settings/components/settings-value-chip";
import { MissingNodeNotice, SectionUnavailableNotice } from "@/features/settings/settings-section-support";
import {
  enabledDisabled,
  formatSeconds,
  passwordSourceLabel,
  safeText,
  yesNo,
  type NormalizedAuthSecuritySummary,
} from "@/features/settings/settings-shared";
import type {
  ControlPlaneSecuritySummary,
  RuntimeSecurityInfo,
  SystemInfoResponse,
} from "@/types/api/config";

export function SettingsSecuritySection({
  hasSelectedNode,
  securitySummary,
  controlPlane,
  runtimeSecurity,
  hasDefaultSecretRisk,
  systemInfo,
  securitySummaryError,
  systemInfoError,
}: {
  hasSelectedNode: boolean;
  securitySummary?: NormalizedAuthSecuritySummary;
  controlPlane?: ControlPlaneSecuritySummary;
  runtimeSecurity?: RuntimeSecurityInfo;
  hasDefaultSecretRisk: boolean;
  systemInfo?: SystemInfoResponse;
  securitySummaryError?: unknown;
  systemInfoError?: unknown;
}): JSX.Element {
  const hasUnavailableSecuritySummary = Boolean(
    (securitySummaryError && !securitySummary)
      || (systemInfoError && hasSelectedNode && !systemInfo),
  );

  return (
    <div className="space-y-5">
      {hasUnavailableSecuritySummary ? (
        <SectionUnavailableNotice
          title="安全摘要暂不可用"
          description="BFF 或节点安全摘要当前未完整返回。详细错误已转入全局弹窗与底部日志栏。"
        />
      ) : null}
      {!hasSelectedNode ? <MissingNodeNotice /> : null}

      {hasDefaultSecretRisk ? (
        <div className="settings-section-card--compact border-warning/30 bg-warning/8 px-4 py-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">默认 secret 仍在使用</p>
              <p className="mt-1 text-sm text-muted-foreground">
                当前摘要仍显示 `using_default_secret = true`。请尽快更新默认节点或 control plane secret。
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <SettingsInfoGroup title="Session / CSRF" description="HttpOnly session 与 CSRF 约束">
          <SettingsInfoRow
            icon={<ShieldCheck className="size-4" />}
            label="Session cookie"
            value={safeText(securitySummary?.session?.cookie_name)}
            hint={`HttpOnly · SameSite=${safeText(securitySummary?.session?.same_site, "n/a")}`}
            status={<SettingsValueChip tone={securitySummary?.session?.http_only ? "success" : "warning"}>{securitySummary?.session?.http_only ? "Enabled" : "Review"}</SettingsValueChip>}
            mono
          />
          <SettingsInfoRow
            icon={<LockKeyhole className="size-4" />}
            label="CSRF"
            value={safeText(securitySummary?.csrf?.header_name)}
            hint={safeText(securitySummary?.csrf?.cookie_name)}
            status={<SettingsValueChip tone={securitySummary?.csrf?.enabled ? "success" : "warning"}>{securitySummary?.csrf?.enabled ? "Enabled" : "Pending"}</SettingsValueChip>}
            mono
          />
          <SettingsInfoRow
            icon={<ShieldEllipsis className="size-4" />}
            label="Secure flags"
            value={`Session ${yesNo(securitySummary?.session?.secure)} · CSRF ${yesNo(securitySummary?.csrf?.secure)}`}
            status={<SettingsValueChip tone="info">{safeText(securitySummary?.session?.ttl, "TTL n/a")}</SettingsValueChip>}
          />
        </SettingsInfoGroup>

        <SettingsInfoGroup title="登录保护" description="失败节流与 bootstrap admin 摘要">
          <SettingsInfoRow
            icon={<ShieldCheck className="size-4" />}
            label="Login limiter"
            value={
              securitySummary?.login_protection
                ? `${securitySummary.login_protection.max_failures ?? 0} / ${securitySummary.login_protection.window_seconds ?? 0}s`
                : "未确认"
            }
            hint={
              securitySummary?.login_protection
                ? `封禁 ${securitySummary.login_protection.block_seconds ?? 0}s`
                : undefined
            }
            status={<SettingsValueChip tone="info">Limiter</SettingsValueChip>}
          />
          <SettingsInfoRow
            icon={<KeyRound className="size-4" />}
            label="Bootstrap admin"
            value={safeText(securitySummary?.bootstrap_admin?.username)}
            hint={passwordSourceLabel(securitySummary?.bootstrap_admin?.password_source)}
            status={
              <SettingsValueChip tone={securitySummary?.bootstrap_admin?.password_source === "default" ? "warning" : "success"}>
                {securitySummary?.bootstrap_admin?.password_source === "default" ? "Default" : "Env"}
              </SettingsValueChip>
            }
          />
        </SettingsInfoGroup>

        <SettingsInfoGroup title="Control plane" description="节点签名鉴权边界与 token 过期策略">
          <SettingsInfoRow
            icon={<ShieldCheck className="size-4" />}
            label="Control plane"
            value={enabledDisabled(controlPlane?.enabled)}
            hint={`TTL ${formatSeconds(controlPlane?.token_expire_seconds)}`}
            status={<SettingsValueChip tone={controlPlane?.enabled ? "success" : "warning"}>{controlPlane?.enabled ? "Enabled" : "Disabled"}</SettingsValueChip>}
          />
          <SettingsInfoRow
            icon={<KeyRound className="size-4" />}
            label="Node secret"
            value={controlPlane?.secret_configured ? "Configured" : "Pending"}
            hint={`node_id ${safeText(controlPlane?.node_id)}`}
            status={<SettingsValueChip tone={runtimeSecurity?.using_default_secret ? "warning" : "success"}>{runtimeSecurity?.using_default_secret ? "Default in use" : "Custom"}</SettingsValueChip>}
          />
          <SettingsInfoRow
            label="Issuer"
            value={safeText(controlPlane?.issuer)}
            mono
            status={<SettingsValueChip tone="info">Signed API</SettingsValueChip>}
          />
        </SettingsInfoGroup>

        <SettingsInfoGroup title="边界声明" description="API边界状态，是否使用现代化v1接口">
          <SettingsInfoRow
            icon={<ShieldCheck className="size-4" />}
            label="Legacy compat routes"
            value="removed"
            status={<SettingsValueChip tone="success">Removed</SettingsValueChip>}
          />
          <SettingsInfoRow
            icon={<ShieldCheck className="size-4" />}
            label="API contract"
            value={safeText(systemInfo?.api_contract, "api_v1_only")}
            mono
            status={<SettingsValueChip tone="success">/api/v1/* only</SettingsValueChip>}
          />
          <SettingsInfoRow
            icon={<KeyRound className="size-4" />}
            label="Default node secret"
            value={yesNo(securitySummary?.default_node?.using_default_secret)}
            hint={safeText(securitySummary?.default_node?.node_id)}
            status={<SettingsValueChip tone={securitySummary?.default_node?.using_default_secret ? "warning" : "success"}>{securitySummary?.default_node?.using_default_secret ? "Warning" : "Clean"}</SettingsValueChip>}
          />
        </SettingsInfoGroup>
      </div>
    </div>
  );
}

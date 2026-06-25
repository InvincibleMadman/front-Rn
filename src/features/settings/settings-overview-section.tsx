import {
  Cpu,
  KeyRound,
  LockKeyhole,
  Network,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { SettingsInfoGroup } from "@/features/settings/components/settings-info-group";
import { SettingsInfoRow } from "@/features/settings/components/settings-info-row";
import { SettingsValueChip } from "@/features/settings/components/settings-value-chip";
import { MissingNodeNotice, SectionUnavailableNotice } from "@/features/settings/settings-section-support";
import {
  enabledDisabled,
  formatSeconds,
  roleLabel,
  safeText,
  type NormalizedAuthSecuritySummary,
} from "@/features/settings/settings-shared";
import type { AuthUser } from "@/stores/auth-store";
import type { ApiNode } from "@/types/api/nodes";
import type { ControlPlaneSecuritySummary, SystemInfoResponse } from "@/types/api/config";

export function SettingsOverviewSection({
  hasSelectedNode,
  selectedNode,
  currentNodeStatus,
  controlPlane,
  securitySummary,
  currentUser,
  isAdmin,
  llmProvider,
  llmModel,
  buildEnabled,
  buildAllowLlmAssist,
  configuredToolCount,
  resolvedToolCount,
  offlineCapabilityCount,
  jobsCapabilityCount,
  debugCapabilityCount,
  hasDefaultSecretRisk,
  systemInfo,
  securitySummaryError,
  nodesError,
  systemInfoError,
}: {
  hasSelectedNode: boolean;
  selectedNode: ApiNode | null;
  currentNodeStatus: string;
  controlPlane?: ControlPlaneSecuritySummary;
  securitySummary?: NormalizedAuthSecuritySummary;
  currentUser: AuthUser | null;
  isAdmin: boolean;
  llmProvider: string;
  llmModel: string;
  buildEnabled: boolean;
  buildAllowLlmAssist: boolean;
  configuredToolCount: number;
  resolvedToolCount: number;
  offlineCapabilityCount: number;
  jobsCapabilityCount: number;
  debugCapabilityCount: number;
  hasDefaultSecretRisk: boolean;
  systemInfo?: SystemInfoResponse;
  securitySummaryError?: unknown;
  nodesError?: unknown;
  systemInfoError?: unknown;
}): JSX.Element {
  const hasUnavailableSummary = Boolean(
    (securitySummaryError && !securitySummary)
      || (nodesError && hasSelectedNode && !selectedNode)
      || (systemInfoError && hasSelectedNode && !systemInfo),
  );

  return (
    <div className="space-y-5">
      {hasUnavailableSummary ? (
        <SectionUnavailableNotice
          title="部分概览摘要暂不可用"
          description="当前概览区有部分 BFF 或节点摘要未返回。详细错误已转入全局弹窗与底部日志栏。"
        />
      ) : null}
      {!hasSelectedNode ? <MissingNodeNotice /> : null}

      {hasDefaultSecretRisk ? (
        <div className="settings-section-card--compact border-warning/30 bg-warning/8 px-4 py-4">
          <div className="flex items-start gap-3">
            <KeyRound className="mt-0.5 size-4 shrink-0 text-warning" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">默认 node secret 风险仍存在</p>
              <p className="mt-1 text-sm text-muted-foreground">
                当前环境仍检测到默认 secret 使用痕迹。建议尽快更新默认节点与 control plane secret。
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <SettingsInfoGroup title="当前节点" description="当前选中节点与其控制面属性摘要">
          <SettingsInfoRow
            icon={<Network className="size-4" />}
            label="节点"
            value={selectedNode?.name ?? "未选择节点"}
            hint={selectedNode?.baseUrl ?? "通过 Web BFF 代理"}
            status={<SettingsValueChip tone={hasSelectedNode ? "success" : "warning"}>{currentNodeStatus}</SettingsValueChip>}
          />
          <SettingsInfoRow
            icon={<Cpu className="size-4" />}
            label="Control plane"
            value={enabledDisabled(controlPlane?.enabled)}
            hint={`node_id ${safeText(controlPlane?.node_id)}`}
            status={
              <SettingsValueChip tone={controlPlane?.enabled ? "success" : "warning"}>
                {formatSeconds(controlPlane?.token_expire_seconds)}
              </SettingsValueChip>
            }
          />
          <SettingsInfoRow
            label="Issuer"
            value={safeText(controlPlane?.issuer)}
            mono
            status={
              <SettingsValueChip tone={controlPlane?.secret_configured ? "success" : "warning"}>
                {controlPlane?.secret_configured ? "Secret ready" : "Secret pending"}
              </SettingsValueChip>
            }
          />
        </SettingsInfoGroup>

        <SettingsInfoGroup title="BFF 安全" description="会话保持、CSRF 与失败节流边界">
          <SettingsInfoRow
            icon={<ShieldCheck className="size-4" />}
            label="Session"
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
            status={<SettingsValueChip tone={securitySummary?.csrf?.enabled ? "success" : "warning"}>{securitySummary?.csrf?.enabled ? "Enabled" : "Not ready"}</SettingsValueChip>}
            mono
          />
          <SettingsInfoRow
            icon={<KeyRound className="size-4" />}
            label="登录失败节流"
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
        </SettingsInfoGroup>

        <SettingsInfoGroup title="结构边界" description="系统安全边界与当前角色摘要">
          <SettingsInfoRow
            icon={<ShieldCheck className="size-4" />}
            label="API contract"
            value={safeText(systemInfo?.api_contract, "api_v1_only")}
            mono
            status={<SettingsValueChip tone="success">Compat removed</SettingsValueChip>}
          />
          <SettingsInfoRow
            icon={<LockKeyhole className="size-4" />}
            label="鉴权路径"
            value="Web BFF -> /api/v1/*"
            hint="业务流量不再经过 compat 旁路"
            status={<SettingsValueChip tone="info">Modern only</SettingsValueChip>}
          />
          <SettingsInfoRow
            icon={<Network className="size-4" />}
            label="当前角色"
            value={roleLabel(currentUser?.role)}
            hint={isAdmin ? "管理员额外可见用户管理" : "普通用户无用户管理 tab"}
            status={<SettingsValueChip tone={isAdmin ? "warning" : "default"}>{isAdmin ? "Admin" : "User"}</SettingsValueChip>}
          />
        </SettingsInfoGroup>

        <SettingsInfoGroup title="LLM / Build / Tools" description="简洁汇总当前功能服务主要能力状态">
          <SettingsInfoRow
            icon={<Sparkles className="size-4" />}
            label="LLM"
            value={llmModel || llmProvider || "未配置"}
            hint={llmProvider ? `provider ${llmProvider}` : "provider 未设置"}
            status={<SettingsValueChip tone={llmProvider && llmModel ? "success" : llmProvider || llmModel ? "warning" : "default"}>{llmProvider && llmModel ? "Ready" : "Partial"}</SettingsValueChip>}
          />
          <SettingsInfoRow
            icon={<Wrench className="size-4" />}
            label="工具链"
            value={`${configuredToolCount} / ${resolvedToolCount}`}
            hint={`${offlineCapabilityCount} offline · ${jobsCapabilityCount} jobs · ${debugCapabilityCount} debug`}
            status={<SettingsValueChip tone={configuredToolCount === resolvedToolCount && resolvedToolCount > 0 ? "success" : "warning"}>{configuredToolCount === resolvedToolCount && resolvedToolCount > 0 ? "Ready" : "Partial"}</SettingsValueChip>}
          />
          <SettingsInfoRow
            icon={<Cpu className="size-4" />}
            label="构建助手"
            value={buildEnabled ? "已启用" : "已关闭"}
            hint={buildAllowLlmAssist ? "LLM assist enabled" : "LLM assist disabled"}
            status={<SettingsValueChip tone={buildEnabled ? "success" : "warning"}>{buildEnabled ? "On" : "Off"}</SettingsValueChip>}
          />
        </SettingsInfoGroup>
      </div>
    </div>
  );
}

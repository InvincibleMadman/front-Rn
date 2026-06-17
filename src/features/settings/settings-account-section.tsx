import type { UseFormReturn } from "react-hook-form";
import { KeyRound, LogOut, ShieldCheck, UserCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsEditRow } from "@/features/settings/components/settings-edit-row";
import { SettingsInfoGroup } from "@/features/settings/components/settings-info-group";
import { SettingsInfoRow } from "@/features/settings/components/settings-info-row";
import { SettingsValueChip } from "@/features/settings/components/settings-value-chip";
import { SectionUnavailableNotice } from "@/features/settings/settings-section-support";
import {
  roleLabel,
  safeText,
  type AccountFormValues,
  type NormalizedAuthSecuritySummary,
  type SettingsSubmitHandler,
} from "@/features/settings/settings-shared";
import type { AuthUser } from "@/stores/auth-store";

export function SettingsAccountSection({
  currentUser,
  securitySummary,
  accountForm,
  submitPassword,
  changePasswordPending,
  logoutPending,
  accountMessage,
  onResetPasswordForm,
  onLogout,
  changePasswordError,
  logoutError,
  securitySummaryError,
}: {
  currentUser: AuthUser | null;
  securitySummary?: NormalizedAuthSecuritySummary;
  accountForm: UseFormReturn<AccountFormValues>;
  submitPassword: SettingsSubmitHandler;
  changePasswordPending: boolean;
  logoutPending: boolean;
  accountMessage: string | null;
  onResetPasswordForm: () => void;
  onLogout: () => void;
  changePasswordError?: unknown;
  logoutError?: unknown;
  securitySummaryError?: unknown;
}): JSX.Element {
  return (
    <div className="space-y-5">
      {securitySummaryError && !securitySummary ? (
        <SectionUnavailableNotice
          title="用户中心安全摘要暂不可用"
          description="当前会话安全摘要未完整返回，详情已转入全局弹窗与底部日志栏。"
        />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <SettingsInfoGroup title="当前账号" description="`/settings?tab=account` 直接作为用户中心入口。">
          <SettingsInfoRow
            icon={<UserCircle2 className="size-4" />}
            label="Username"
            value={currentUser?.username ?? "未加载"}
            status={<SettingsValueChip tone="info">{roleLabel(currentUser?.role)}</SettingsValueChip>}
          />
          <SettingsInfoRow
            icon={<ShieldCheck className="size-4" />}
            label="User ID"
            value={currentUser?.user_id ?? "未加载"}
            mono
            status={<SettingsValueChip tone="default">Identity</SettingsValueChip>}
          />
          <SettingsInfoRow
            icon={<KeyRound className="size-4" />}
            label="Session cookie"
            value={safeText(securitySummary?.session?.cookie_name)}
            hint={safeText(securitySummary?.csrf?.header_name)}
            mono
            status={<SettingsValueChip tone={securitySummary?.session?.http_only ? "success" : "warning"}>{securitySummary?.session?.http_only ? "HttpOnly" : "Review"}</SettingsValueChip>}
          />
        </SettingsInfoGroup>

        <SettingsInfoGroup title="修改密码" description="紧凑行式表单，保持 scrypt + session 续签。">
          <form className="space-y-2.5" onSubmit={submitPassword}>
            <SettingsEditRow
              label="Current password"
              control={<Input type="password" autoComplete="current-password" {...accountForm.register("current_password")} />}
              footer={accountForm.formState.errors.current_password?.message ? <p className="text-xs text-danger">{accountForm.formState.errors.current_password.message}</p> : null}
            />
            <SettingsEditRow
              label="New password"
              control={<Input type="password" autoComplete="new-password" {...accountForm.register("new_password")} />}
              footer={accountForm.formState.errors.new_password?.message ? <p className="text-xs text-danger">{accountForm.formState.errors.new_password.message}</p> : null}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/50 px-3 py-3">
              <div className="text-sm text-muted-foreground">{accountMessage ?? "提交后服务端会重新签发当前 session。"}</div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={onResetPasswordForm}>
                  重置
                </Button>
                <Button type="submit" disabled={changePasswordPending}>
                  <KeyRound className="size-4" />
                  {changePasswordPending ? "提交中..." : "更新密码"}
                </Button>
              </div>
            </div>
          </form>
        </SettingsInfoGroup>
      </div>

      <div className="settings-section-card--compact flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">退出登录</p>
          <p className="mt-1 text-sm text-muted-foreground">退出后返回 `/login`，用户菜单与受保护业务页都会回到登录入口。</p>
        </div>
        <Button type="button" variant="danger" onClick={onLogout} disabled={logoutPending}>
          <LogOut className="size-4" />
          {logoutPending ? "退出中..." : "退出登录"}
        </Button>
      </div>
    </div>
  );
}

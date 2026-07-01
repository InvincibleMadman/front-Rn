import type { UseFormReturn } from "react-hook-form";
import { ShieldCheck, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SettingsEditRow } from "@/features/settings/components/settings-edit-row";
import { SettingsInfoGroup } from "@/features/settings/components/settings-info-group";
import { SettingsInfoRow } from "@/features/settings/components/settings-info-row";
import { SettingsValueChip } from "@/features/settings/components/settings-value-chip";
import { SectionUnavailableNotice } from "@/features/settings/settings-section-support";
import {
  formatDateTime,
  roleLabel,
  type CreateUserFormValues,
  type SettingsSubmitHandler,
} from "@/features/settings/settings-shared";
import type { AuthUser } from "@/stores/auth-store";
import type { ManagedUser } from "@/types/api/users";

export function SettingsUsersSection({
  users,
  adminCount,
  regularUserCount,
  currentUser,
  createUserForm,
  submitCreateUser,
  usersMessage,
  createUserPending,
  deleteUserPendingUsername,
  onDeleteUser,
  onResetCreateUserForm,
  usersError,
  createUserError,
  deleteUserError,
  usersLoading,
}: {
  users: ManagedUser[];
  adminCount: number;
  regularUserCount: number;
  currentUser: AuthUser | null;
  createUserForm: UseFormReturn<CreateUserFormValues>;
  submitCreateUser: SettingsSubmitHandler;
  usersMessage: string | null;
  createUserPending: boolean;
  deleteUserPendingUsername?: string;
  onDeleteUser: (username: string) => void;
  onResetCreateUserForm: () => void;
  usersError?: unknown;
  createUserError?: unknown;
  deleteUserError?: unknown;
  usersLoading: boolean;
}): JSX.Element {
  return (
    <div className="space-y-5">
      {usersError && !usersLoading && users.length === 0 ? (
        <SectionUnavailableNotice
          title="用户列表暂不可用"
          description="当前用户管理摘要未返回，详情已转入全局弹窗与底部日志栏。"
        />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-4">
          <SettingsInfoGroup title="用户摘要" description="用户模型统计摘要">
            <SettingsInfoRow
              icon={<Users className="size-4" />}
              label="用户总数"
              value={String(users.length)}
              status={<SettingsValueChip tone="info">BFF users</SettingsValueChip>}
            />
            <SettingsInfoRow
              icon={<ShieldCheck className="size-4" />}
              label="管理员"
              value={String(adminCount)}
              status={<SettingsValueChip tone="warning">Admin</SettingsValueChip>}
            />
            <SettingsInfoRow
              icon={<Users className="size-4" />}
              label="普通用户"
              value={String(regularUserCount)}
              status={<SettingsValueChip tone="default">User</SettingsValueChip>}
            />
          </SettingsInfoGroup>

          <SettingsInfoGroup title="新增用户" description="仅有管理员可进行此操作，不能随意注册">
            <form className="space-y-2.5" onSubmit={submitCreateUser}>
              <div className="grid gap-2.5 md:grid-cols-2">
                <SettingsEditRow
                  label="Username"
                  control={<Input autoComplete="username" {...createUserForm.register("username")} />}
                  footer={createUserForm.formState.errors.username?.message ? <p className="text-xs text-danger">{createUserForm.formState.errors.username.message}</p> : null}
                />
                <SettingsEditRow
                  label="Password"
                  control={<Input type="password" autoComplete="new-password" {...createUserForm.register("password")} />}
                  footer={createUserForm.formState.errors.password?.message ? <p className="text-xs text-danger">{createUserForm.formState.errors.password.message}</p> : null}
                />
              </div>
              <SettingsEditRow
                label="Role"
                control={
                  <Select
                    value={createUserForm.watch("role")}
                    onValueChange={(value) => createUserForm.setValue("role", value as "admin" | "user", { shouldValidate: true, shouldDirty: true })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">普通用户</SelectItem>
                      <SelectItem value="admin">管理员</SelectItem>
                    </SelectContent>
                  </Select>
                }
                status={<SettingsValueChip tone={createUserForm.watch("role") === "admin" ? "warning" : "default"}>{roleLabel(createUserForm.watch("role"))}</SettingsValueChip>}
              />
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/50 px-3 py-3">
                <div className="text-sm text-muted-foreground">{usersMessage ?? "继续使用既有 `/web-api/users`。"}</div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={onResetCreateUserForm}>
                    清空
                  </Button>
                  <Button type="submit" disabled={createUserPending}>
                    <UserPlus className="size-4" />
                    {createUserPending ? "创建中..." : "创建用户"}
                  </Button>
                </div>
              </div>
            </form>
          </SettingsInfoGroup>
        </div>

        <SettingsInfoGroup title="用户列表" description="仅管理员可见的最小化用户管理">
          {usersLoading ? (
            <div className="rounded-xl border border-border/60 bg-background/50 px-4 py-6 text-sm text-muted-foreground">正在加载用户列表...</div>
          ) : users.length === 0 ? (
            <div className="rounded-xl border border-border/60 bg-background/50 px-4 py-6 text-sm text-muted-foreground">暂无用户记录。</div>
          ) : (
            <Table>
              <TableHeader className="table-header-row">
                <TableRow>
                  <TableHead>用户名</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((item) => {
                  const deleting = deleteUserPendingUsername === item.username;

                  return (
                    <TableRow key={item.user_id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.username}</span>
                          {item.username === currentUser?.username ? <Badge variant="outline">当前账号</Badge> : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.role === "admin" ? "warning" : "secondary"}>{roleLabel(item.role)}</Badge>
                      </TableCell>
                      <TableCell>{formatDateTime(item.created_at)}</TableCell>
                      <TableCell>{formatDateTime(item.updated_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="danger"
                          onClick={() => onDeleteUser(item.username)}
                          disabled={deleting}
                        >
                          {deleting ? "删除中..." : "删除"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </SettingsInfoGroup>
      </div>
    </div>
  );
}

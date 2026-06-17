import type { UseFormReturn } from "react-hook-form";
import { Database, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SettingsEditRow } from "@/features/settings/components/settings-edit-row";
import { SettingsInfoGroup } from "@/features/settings/components/settings-info-group";
import { SettingsInfoRow } from "@/features/settings/components/settings-info-row";
import { SettingsValueChip } from "@/features/settings/components/settings-value-chip";
import { ConfigSubmitBar, MissingNodeNotice, SectionUnavailableNotice } from "@/features/settings/settings-section-support";
import { safeText, splitLines, type SettingsFormValues, type SettingsSubmitHandler } from "@/features/settings/settings-shared";
import type { AppConfigResponse } from "@/types/api/config";
import type { ApiNode } from "@/types/api/nodes";

export function SettingsBackendSection({
  form,
  submitConfig,
  patchError,
  configError,
  hasSelectedNode,
  selectedNode,
  pending,
  submitMessage,
  config,
}: {
  form: UseFormReturn<SettingsFormValues>;
  submitConfig: SettingsSubmitHandler;
  patchError?: unknown;
  configError?: unknown;
  hasSelectedNode: boolean;
  selectedNode: ApiNode | null;
  pending: boolean;
  submitMessage: string | null;
  config?: AppConfigResponse;
}): JSX.Element {
  const allowMethods = splitLines((config?.server?.cors?.allow_methods ?? []).join(", "));
  const allowHeaders = splitLines((config?.server?.cors?.allow_headers ?? []).join(", "));

  return (
    <form className="space-y-5" onSubmit={submitConfig}>
      {configError ? (
        <SectionUnavailableNotice
          title="节点配置摘要暂不可用"
          description="当前节点 `/api/v1/config` 暂未返回，详情已转入全局弹窗与底部日志栏。"
        />
      ) : null}
      {!hasSelectedNode ? <MissingNodeNotice /> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,2.05fr)] xl:items-start">
        <div className="space-y-4">
          <SettingsInfoGroup title="Workspace" description="工作区与默认协议。">
            <SettingsEditRow
              label="Workspace root"
              description="当前节点协议工作区根目录。"
              control={<Input {...form.register("workspace_root")} />}
              status={<SettingsValueChip tone="info">Path</SettingsValueChip>}
            />
            <SettingsEditRow
              label="Default protocol"
              description="用于离线流与协议资产的默认协议名。"
              control={<Input {...form.register("workspace_default_protocol")} />}
              status={<SettingsValueChip tone="default">Editable</SettingsValueChip>}
            />
          </SettingsInfoGroup>

          <SettingsInfoGroup title="Server" description="当前节点 HTTP 服务配置。">
            <SettingsEditRow
              label="Server host"
              description="节点监听地址。"
              control={<Input {...form.register("server_host")} />}
              status={<SettingsValueChip tone="info" mono>{safeText(form.watch("server_host"))}</SettingsValueChip>}
            />
            <SettingsEditRow
              label="Server port"
              description="节点监听端口。"
              control={<Input type="number" {...form.register("server_port")} />}
              status={<SettingsValueChip tone="info" mono>{safeText(form.watch("server_port"))}</SettingsValueChip>}
            />
          </SettingsInfoGroup>
        </div>

        <SettingsInfoGroup title="CORS" description="跨域边界与只读方法头部摘要。">
          <SettingsEditRow
            label="CORS enabled"
            description="控制当前节点是否接受跨域请求。"
            control={<Switch checked={form.watch("cors_enabled")} onCheckedChange={(checked) => form.setValue("cors_enabled", checked)} />}
            status={<SettingsValueChip tone={form.watch("cors_enabled") ? "success" : "warning"}>{form.watch("cors_enabled") ? "Enabled" : "Disabled"}</SettingsValueChip>}
          />
          <SettingsEditRow
            label="Allow credentials"
            description="控制 cookie 与认证头是否允许跨域携带。"
            control={<Switch checked={form.watch("cors_allow_credentials")} onCheckedChange={(checked) => form.setValue("cors_allow_credentials", checked)} />}
            status={<SettingsValueChip tone={form.watch("cors_allow_credentials") ? "success" : "warning"}>{form.watch("cors_allow_credentials") ? "Enabled" : "Disabled"}</SettingsValueChip>}
          />
          <SettingsEditRow
            label="Allow origins"
            description="多行输入，一行一个 origin。"
            control={<Textarea rows={4} {...form.register("cors_allow_origins_text")} />}
            status={<SettingsValueChip tone="default">{splitLines(form.watch("cors_allow_origins_text")).length} items</SettingsValueChip>}
          />
          <SettingsEditRow
            label="Origin regex"
            description="可选的正则 origin 白名单。"
            control={<Input {...form.register("cors_allow_origin_regex")} />}
            status={<SettingsValueChip tone="default">{form.watch("cors_allow_origin_regex") ? "Custom" : "None"}</SettingsValueChip>}
          />
          <SettingsInfoRow
            icon={<Globe className="size-4" />}
            label="Allow methods"
            value={allowMethods.length ? allowMethods.join(", ") : "未设置"}
            status={<SettingsValueChip tone="default">{allowMethods.length || 0} methods</SettingsValueChip>}
          />
          <SettingsInfoRow
            icon={<Database className="size-4" />}
            label="Allow headers"
            value={allowHeaders.length ? allowHeaders.join(", ") : "未设置"}
            status={<SettingsValueChip tone="default">{allowHeaders.length || 0} headers</SettingsValueChip>}
          />
        </SettingsInfoGroup>
      </div>

      <ConfigSubmitBar
        disabled={!hasSelectedNode}
        pending={pending}
        selectedNodeName={selectedNode?.name ?? "未选择节点"}
        submitMessage={submitMessage}
      />
    </form>
  );
}

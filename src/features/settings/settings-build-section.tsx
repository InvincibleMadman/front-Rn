import type { UseFormReturn } from "react-hook-form";
import { Hammer } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SettingsEditRow } from "@/features/settings/components/settings-edit-row";
import { SettingsInfoGroup } from "@/features/settings/components/settings-info-group";
import { SettingsInfoRow } from "@/features/settings/components/settings-info-row";
import { SettingsValueChip } from "@/features/settings/components/settings-value-chip";
import { ConfigSubmitBar, MissingNodeNotice, SectionUnavailableNotice } from "@/features/settings/settings-section-support";
import { safeText, splitLines, type SettingsFormValues, type SettingsSubmitHandler } from "@/features/settings/settings-shared";
import type { ApiNode } from "@/types/api/nodes";

export function SettingsBuildSection({
  form,
  submitConfig,
  patchError,
  configError,
  hasSelectedNode,
  selectedNode,
  pending,
  submitMessage,
}: {
  form: UseFormReturn<SettingsFormValues>;
  submitConfig: SettingsSubmitHandler;
  patchError?: unknown;
  configError?: unknown;
  hasSelectedNode: boolean;
  selectedNode: ApiNode | null;
  pending: boolean;
  submitMessage: string | null;
}): JSX.Element {
  const allowedCompilersCount = splitLines(form.watch("build_allowed_compilers_text")).length;
  const allowedToolsCount = splitLines(form.watch("build_allowed_tools_text")).length;

  return (
    <form className="space-y-5" onSubmit={submitConfig}>
      {configError ? (
        <SectionUnavailableNotice
          title="构建配置摘要暂不可用"
          description="当前节点的构建与调试配置未完整返回，详情已转入全局弹窗与底部日志栏。"
        />
      ) : null}
      {!hasSelectedNode ? <MissingNodeNotice /> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <SettingsInfoGroup title="开关项" description="开关类配置统一放在紧凑 toggle rows。">
          <SettingsEditRow
            label="Build enabled"
            description="总构建助手开关。"
            control={<Switch checked={form.watch("build_enabled")} onCheckedChange={(checked) => form.setValue("build_enabled", checked)} />}
            status={<SettingsValueChip tone={form.watch("build_enabled") ? "success" : "warning"}>{form.watch("build_enabled") ? "On" : "Off"}</SettingsValueChip>}
          />
          <SettingsEditRow
            label="LLM assist"
            description="允许构建助手调用 LLM。"
            control={<Switch checked={form.watch("build_allow_llm_assist")} onCheckedChange={(checked) => form.setValue("build_allow_llm_assist", checked)} />}
            status={<SettingsValueChip tone={form.watch("build_allow_llm_assist") ? "success" : "default"}>{form.watch("build_allow_llm_assist") ? "Enabled" : "Disabled"}</SettingsValueChip>}
          />
          <SettingsEditRow
            label="Shell scripts"
            description="默认建议关闭。"
            control={<Switch checked={form.watch("build_allow_shell_scripts")} onCheckedChange={(checked) => form.setValue("build_allow_shell_scripts", checked)} />}
            status={<SettingsValueChip tone={form.watch("build_allow_shell_scripts") ? "warning" : "success"}>{form.watch("build_allow_shell_scripts") ? "Review" : "Safe default"}</SettingsValueChip>}
          />
          <SettingsEditRow
            label="Network replay"
            description="调试器允许网络回放。"
            control={<Switch checked={form.watch("debugger_allow_network_replay")} onCheckedChange={(checked) => form.setValue("debugger_allow_network_replay", checked)} />}
            status={<SettingsValueChip tone={form.watch("debugger_allow_network_replay") ? "warning" : "default"}>{form.watch("debugger_allow_network_replay") ? "Enabled" : "Disabled"}</SettingsValueChip>}
          />
        </SettingsInfoGroup>

        <SettingsInfoGroup title="编译器与调试器" description="默认编译器、GDB 与超时配置。">
          <SettingsEditRow
            label="Default compiler"
            control={<Input {...form.register("build_default_compiler")} />}
            status={<SettingsValueChip tone="info" mono>{safeText(form.watch("build_default_compiler"))}</SettingsValueChip>}
          />
          <SettingsEditRow
            label="GDB path"
            control={<Input {...form.register("debugger_gdb_path")} />}
            status={<SettingsValueChip tone="info" mono>{safeText(form.watch("debugger_gdb_path"))}</SettingsValueChip>}
          />
          <SettingsEditRow
            label="Debugger timeout"
            control={<Input type="number" {...form.register("debugger_timeout_sec")} />}
            status={<SettingsValueChip tone="default">{safeText(form.watch("debugger_timeout_sec"))}s</SettingsValueChip>}
          />
          <SettingsInfoRow
            icon={<Hammer className="size-4" />}
            label="边界说明"
            value="Browser -> BFF -> /api/v1/*"
            hint="不放宽浏览器执行边界"
            status={<SettingsValueChip tone="success">Unchanged</SettingsValueChip>}
          />
        </SettingsInfoGroup>

        <SettingsInfoGroup title="Compiler allowlist" description="每行一个可用 compiler。">
          <SettingsEditRow
            label="Allowed compilers"
            control={<Textarea rows={5} {...form.register("build_allowed_compilers_text")} />}
            status={<SettingsValueChip tone="default">{allowedCompilersCount} items</SettingsValueChip>}
          />
        </SettingsInfoGroup>

        <SettingsInfoGroup title="Tool allowlist" description="每行一个可用工具名。">
          <SettingsEditRow
            label="Allowed tools"
            control={<Textarea rows={5} {...form.register("build_allowed_tools_text")} />}
            status={<SettingsValueChip tone="default">{allowedToolsCount} items</SettingsValueChip>}
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

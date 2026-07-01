import type { UseFormReturn } from "react-hook-form";
import { CheckCircle2, TerminalSquare } from "lucide-react";
import { JsonViewer } from "@/components/common/json-viewer";
import { Input } from "@/components/ui/input";
import { SettingsEditRow } from "@/features/settings/components/settings-edit-row";
import { SettingsInfoGroup } from "@/features/settings/components/settings-info-group";
import { SettingsInfoRow } from "@/features/settings/components/settings-info-row";
import { SettingsValueChip } from "@/features/settings/components/settings-value-chip";
import { ConfigSubmitBar, MissingNodeNotice, SectionUnavailableNotice } from "@/features/settings/settings-section-support";
import {
  countAvailableTools,
  toolchainResolutionLabel,
  toolchainSummaryTone,
  toolchainSummaryValue,
  type SettingsFormValues,
  type SettingsSubmitHandler,
} from "@/features/settings/settings-shared";
import type { ApiNode } from "@/types/api/nodes";
import type { ToolchainItemSummary } from "@/types/api/config";

export function SettingsToolchainSection({
  form,
  submitConfig,
  patchError,
  configError,
  hasSelectedNode,
  selectedNode,
  pending,
  submitMessage,
  toolchainSummary,
  toolchainEntries,
}: {
  form: UseFormReturn<SettingsFormValues>;
  submitConfig: SettingsSubmitHandler;
  patchError?: unknown;
  configError?: unknown;
  hasSelectedNode: boolean;
  selectedNode: ApiNode | null;
  pending: boolean;
  submitMessage: string | null;
  toolchainSummary: Record<string, ToolchainItemSummary>;
  toolchainEntries: Array<[string, ToolchainItemSummary]>;
}): JSX.Element {
  const resolvedTotal = toolchainEntries.length;
  const configuredToolCount = countAvailableTools(toolchainSummary);
  const resolvedTone = resolvedTotal > 0 && configuredToolCount === resolvedTotal ? "success" : "warning";

  const publicSummary = Object.fromEntries(
    toolchainEntries.map(([key, value]) => [key, { status: value?.status ?? "unconfigured", resolution: value?.resolution ?? "none" }]),
  );

  return (
    <form className="space-y-5" onSubmit={submitConfig}>
      {configError ? (
        <SectionUnavailableNotice
          title="工具链摘要暂不可用"
          description="当前节点的工具解析摘要未完整返回"
        />
      ) : null}
      {!hasSelectedNode ? <MissingNodeNotice /> : null}

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <SettingsInfoGroup title="Resolved summary" description="主机工具环境解析结果">
          <SettingsInfoRow
            icon={<CheckCircle2 className="size-4" />}
            label="Toolchain readiness"
            value={`${configuredToolCount} / ${resolvedTotal || 0}`}
            hint="有效工具数 / 当前运行时摘要工具数"
            status={<SettingsValueChip tone={resolvedTone}>{resolvedTone === "success" ? "Ready" : "Partial"}</SettingsValueChip>}
          />
          {toolchainEntries.slice(0, 6).map(([key, value]) => (
            <SettingsInfoRow
              key={key}
              icon={<TerminalSquare className="size-4" />}
              label={key}
              value={toolchainSummaryValue(value)}
              status={<SettingsValueChip tone={toolchainSummaryTone(value)}>{toolchainResolutionLabel(value)}</SettingsValueChip>}
            />
          ))}
          <div className="rounded-xl border border-border/60 bg-background/50 p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Raw resolved tools</p>
            <div className="mt-3 text-xs text-muted-foreground">
              <JsonViewer data={publicSummary} compact />
            </div>
          </div>
        </SettingsInfoGroup>

        <SettingsInfoGroup title="路径配置" description="路径配置与运行时发现状态">
          <SettingsEditRow
            label="AFL++ fuzzer"
            control={<Input {...form.register("paths_afl_fuzz")} />}
            status={<SettingsValueChip tone={toolchainSummaryTone(toolchainSummary.afl_fuzz)}>{toolchainSummaryValue(toolchainSummary.afl_fuzz)}</SettingsValueChip>}
          />
          <SettingsEditRow
            label="AFL showmap"
            control={<Input {...form.register("paths_afl_showmap")} />}
            status={<SettingsValueChip tone={toolchainSummaryTone(toolchainSummary.afl_showmap)}>{toolchainSummaryValue(toolchainSummary.afl_showmap)}</SettingsValueChip>}
          />
          <SettingsEditRow
            label="AFL compiler"
            control={<Input {...form.register("paths_afl_cc")} />}
            status={<SettingsValueChip tone={toolchainSummaryTone(toolchainSummary.afl_cc)}>{toolchainSummaryValue(toolchainSummary.afl_cc)}</SettingsValueChip>}
          />
          <SettingsEditRow
            label="AFL clang fast"
            control={<Input {...form.register("paths_afl_clang_fast")} />}
            status={<SettingsValueChip tone={toolchainSummaryTone(toolchainSummary.afl_clang_fast)}>{toolchainSummaryValue(toolchainSummary.afl_clang_fast)}</SettingsValueChip>}
          />
          <SettingsEditRow
            label="CMake"
            control={<Input {...form.register("paths_cmake")} />}
            status={<SettingsValueChip tone={toolchainSummaryTone(toolchainSummary.cmake)}>{toolchainSummaryValue(toolchainSummary.cmake)}</SettingsValueChip>}
          />
          <SettingsEditRow
            label="Make"
            control={<Input {...form.register("paths_make")} />}
            status={<SettingsValueChip tone={toolchainSummaryTone(toolchainSummary.make)}>{toolchainSummaryValue(toolchainSummary.make)}</SettingsValueChip>}
          />
          <SettingsEditRow
            label="Ninja"
            control={<Input {...form.register("paths_ninja")} />}
            status={<SettingsValueChip tone={toolchainSummaryTone(toolchainSummary.ninja)}>{toolchainSummaryValue(toolchainSummary.ninja)}</SettingsValueChip>}
          />
          <SettingsEditRow
            label="Git"
            control={<Input {...form.register("paths_git")} />}
            status={<SettingsValueChip tone={toolchainSummaryTone(toolchainSummary.git)}>{toolchainSummaryValue(toolchainSummary.git)}</SettingsValueChip>}
          />
          <SettingsEditRow
            label="GDB"
            control={<Input {...form.register("debugger_gdb_path")} />}
            status={<SettingsValueChip tone={toolchainSummaryTone(toolchainSummary.gdb)}>{toolchainSummaryValue(toolchainSummary.gdb)}</SettingsValueChip>}
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

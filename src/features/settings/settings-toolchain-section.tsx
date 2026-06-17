import type { UseFormReturn } from "react-hook-form";
import { CheckCircle2, TerminalSquare } from "lucide-react";
import { JsonViewer } from "@/components/common/json-viewer";
import { Input } from "@/components/ui/input";
import { SettingsEditRow } from "@/features/settings/components/settings-edit-row";
import { SettingsInfoGroup } from "@/features/settings/components/settings-info-group";
import { SettingsInfoRow } from "@/features/settings/components/settings-info-row";
import { SettingsValueChip } from "@/features/settings/components/settings-value-chip";
import { ConfigSubmitBar, MissingNodeNotice, SectionUnavailableNotice } from "@/features/settings/settings-section-support";
import { safeText, type SettingsFormValues, type SettingsSubmitHandler } from "@/features/settings/settings-shared";
import type { ApiNode } from "@/types/api/nodes";

export function SettingsToolchainSection({
  form,
  submitConfig,
  patchError,
  configError,
  hasSelectedNode,
  selectedNode,
  pending,
  submitMessage,
  resolvedTools,
  resolvedToolEntries,
  configuredToolCount,
}: {
  form: UseFormReturn<SettingsFormValues>;
  submitConfig: SettingsSubmitHandler;
  patchError?: unknown;
  configError?: unknown;
  hasSelectedNode: boolean;
  selectedNode: ApiNode | null;
  pending: boolean;
  submitMessage: string | null;
  resolvedTools: Record<string, string | null>;
  resolvedToolEntries: Array<[string, string | null]>;
  configuredToolCount: number;
}): JSX.Element {
  const resolvedTotal = resolvedToolEntries.length;
  const resolvedTone = resolvedTotal > 0 && configuredToolCount === resolvedTotal ? "success" : "warning";

  return (
    <form className="space-y-5" onSubmit={submitConfig}>
      {configError ? (
        <SectionUnavailableNotice
          title="工具链摘要暂不可用"
          description="当前节点的工具解析摘要未完整返回，详情已转入全局弹窗与底部日志栏。"
        />
      ) : null}
      {!hasSelectedNode ? <MissingNodeNotice /> : null}

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <SettingsInfoGroup title="Resolved summary" description="先看解析结果，再调整路径。">
          <SettingsInfoRow
            icon={<CheckCircle2 className="size-4" />}
            label="Toolchain readiness"
            value={`${configuredToolCount} / ${resolvedTotal || 0}`}
            hint="已解析工具数 / 当前运行时摘要工具数"
            status={<SettingsValueChip tone={resolvedTone}>{resolvedTone === "success" ? "Ready" : "Partial"}</SettingsValueChip>}
          />
          {resolvedToolEntries.slice(0, 6).map(([key, value]) => (
            <SettingsInfoRow
              key={key}
              icon={<TerminalSquare className="size-4" />}
              label={key}
              value={safeText(value)}
              mono
              status={<SettingsValueChip tone={value ? "success" : "warning"}>{value ? "Found" : "Missing"}</SettingsValueChip>}
            />
          ))}
          <div className="rounded-xl border border-border/60 bg-background/50 p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Raw resolved tools</p>
            <div className="mt-3 text-xs text-muted-foreground">
              <JsonViewer data={resolvedTools} compact />
            </div>
          </div>
        </SettingsInfoGroup>

        <SettingsInfoGroup title="路径配置" description="路径配置与运行时发现状态并排展示。">
          <SettingsEditRow
            label="AFL++ fuzzer"
            control={<Input {...form.register("paths_afl_fuzz")} />}
            status={<SettingsValueChip tone={resolvedTools.afl_fuzz ? "success" : "warning"}>{resolvedTools.afl_fuzz ? "Found" : "Missing"}</SettingsValueChip>}
          />
          <SettingsEditRow
            label="AFL showmap"
            control={<Input {...form.register("paths_afl_showmap")} />}
            status={<SettingsValueChip tone={resolvedTools.afl_showmap ? "success" : "warning"}>{resolvedTools.afl_showmap ? "Found" : "Missing"}</SettingsValueChip>}
          />
          <SettingsEditRow
            label="AFL compiler"
            control={<Input {...form.register("paths_afl_cc")} />}
            status={<SettingsValueChip tone={resolvedTools.afl_cc ? "success" : "warning"}>{resolvedTools.afl_cc ? "Found" : "Missing"}</SettingsValueChip>}
          />
          <SettingsEditRow
            label="AFL clang fast"
            control={<Input {...form.register("paths_afl_clang_fast")} />}
            status={<SettingsValueChip tone={resolvedTools.afl_clang_fast ? "success" : "warning"}>{resolvedTools.afl_clang_fast ? "Found" : "Missing"}</SettingsValueChip>}
          />
          <SettingsEditRow
            label="CMake"
            control={<Input {...form.register("paths_cmake")} />}
            status={<SettingsValueChip tone={resolvedTools.cmake ? "success" : "warning"}>{resolvedTools.cmake ? "Found" : "Missing"}</SettingsValueChip>}
          />
          <SettingsEditRow
            label="Make"
            control={<Input {...form.register("paths_make")} />}
            status={<SettingsValueChip tone={resolvedTools.make ? "success" : "warning"}>{resolvedTools.make ? "Found" : "Missing"}</SettingsValueChip>}
          />
          <SettingsEditRow
            label="Ninja"
            control={<Input {...form.register("paths_ninja")} />}
            status={<SettingsValueChip tone={resolvedTools.ninja ? "success" : "warning"}>{resolvedTools.ninja ? "Found" : "Missing"}</SettingsValueChip>}
          />
          <SettingsEditRow
            label="Git"
            control={<Input {...form.register("paths_git")} />}
            status={<SettingsValueChip tone={resolvedTools.git ? "success" : "warning"}>{resolvedTools.git ? "Found" : "Missing"}</SettingsValueChip>}
          />
          <SettingsEditRow
            label="GDB"
            control={<Input {...form.register("debugger_gdb_path")} />}
            status={<SettingsValueChip tone="info">Configured</SettingsValueChip>}
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

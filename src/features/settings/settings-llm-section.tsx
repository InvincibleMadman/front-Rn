import type { UseFormReturn } from "react-hook-form";
import { Gauge, Sparkles, Waypoints } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SettingsEditRow } from "@/features/settings/components/settings-edit-row";
import { SettingsInfoGroup } from "@/features/settings/components/settings-info-group";
import { SettingsInfoRow } from "@/features/settings/components/settings-info-row";
import { SettingsValueChip } from "@/features/settings/components/settings-value-chip";
import { ConfigSubmitBar, MissingNodeNotice, SectionUnavailableNotice } from "@/features/settings/settings-section-support";
import {
  safeText,
  type SettingsFormValues,
  type SettingsSubmitHandler,
} from "@/features/settings/settings-shared";
import type { ApiNode } from "@/types/api/nodes";

export function SettingsLlmSection({
  form,
  submitConfig,
  patchError,
  configError,
  hasSelectedNode,
  selectedNode,
  pending,
  submitMessage,
  llmProvider,
  llmModel,
  llmBaseUrl,
}: {
  form: UseFormReturn<SettingsFormValues>;
  submitConfig: SettingsSubmitHandler;
  patchError?: unknown;
  configError?: unknown;
  hasSelectedNode: boolean;
  selectedNode: ApiNode | null;
  pending: boolean;
  submitMessage: string | null;
  llmProvider: string;
  llmModel: string;
  llmBaseUrl: string;
}): JSX.Element {
  return (
    <form className="space-y-5" onSubmit={submitConfig}>
      {configError ? (
        <SectionUnavailableNotice
          title="LLM 配置摘要暂不可用"
          description="当前节点的 LLM 配置未完整返回，详情已转入全局弹窗与底部日志栏。"
        />
      ) : null}
      {!hasSelectedNode ? <MissingNodeNotice /> : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <SettingsInfoGroup title="基础连接" description="Provider、Base URL 与超时。">
          <SettingsEditRow
            label="Provider"
            description="模型服务提供方标识。"
            control={<Input {...form.register("llm_provider")} />}
            status={<SettingsValueChip tone={llmProvider ? "success" : "warning"}>{llmProvider ? "Configured" : "Missing"}</SettingsValueChip>}
          />
          <SettingsEditRow
            label="Base URL"
            description="模型网关或上游服务地址。"
            control={<Input {...form.register("llm_base_url")} />}
            status={<SettingsValueChip tone="info" mono>{safeText(llmBaseUrl)}</SettingsValueChip>}
          />
          <SettingsEditRow
            label="Timeout"
            description="请求超时时间。"
            control={<Input type="number" {...form.register("llm_timeout_sec")} />}
            status={<SettingsValueChip tone="default">{safeText(form.watch("llm_timeout_sec"))}s</SettingsValueChip>}
          />
        </SettingsInfoGroup>

        <SettingsInfoGroup title="模型设置" description="默认模型与当前只读摘要。">
          <SettingsEditRow
            label="Model"
            description="默认用于设置页与辅助构建的模型名。"
            control={<Input {...form.register("llm_model")} />}
            status={<SettingsValueChip tone={llmModel ? "success" : "warning"}>{llmModel ? "Selected" : "Missing"}</SettingsValueChip>}
          />
          <SettingsInfoRow
            icon={<Sparkles className="size-4" />}
            label="Current summary"
            value={llmModel || llmProvider || "未配置"}
            hint={llmProvider ? `provider ${llmProvider}` : "provider 未设置"}
            status={<SettingsValueChip tone={llmProvider && llmModel ? "success" : "warning"}>{llmProvider && llmModel ? "Ready" : "Partial"}</SettingsValueChip>}
          />
          <SettingsInfoRow
            icon={<Gauge className="size-4" />}
            label="Runtime mode"
            value="Modern /api/v1/*"
            hint="不改变现有 envelope 与权限边界"
            status={<SettingsValueChip tone="info">Stable</SettingsValueChip>}
          />
        </SettingsInfoGroup>

        <SettingsInfoGroup title="密钥来源" description="密钥名与浏览器端输入分离。">
          <SettingsEditRow
            label="API key"
            description="仅用于写入当前节点配置。"
            control={<Input type="password" {...form.register("llm_api_key")} />}
            status={<SettingsValueChip tone={form.watch("llm_api_key") ? "warning" : "default"}>{form.watch("llm_api_key") ? "Modified" : "Unchanged"}</SettingsValueChip>}
          />
          <SettingsEditRow
            label="API key env"
            description="推荐使用环境变量读取。"
            control={<Input {...form.register("llm_api_key_env")} />}
            status={<SettingsValueChip tone="info" mono>{safeText(form.watch("llm_api_key_env"))}</SettingsValueChip>}
          />
          <SettingsInfoRow
            icon={<Waypoints className="size-4" />}
            label="读取策略"
            value="Server-side only"
            hint="浏览器不持久化真实密钥"
            status={<SettingsValueChip tone="success">Safe path</SettingsValueChip>}
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

import { AlertTriangle, Info, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MissingNodeNotice(): JSX.Element {
  return (
    <div className="settings-section-card--compact border-warning/30 bg-warning/8 px-4 py-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">尚未选择后端节点</p>
          <p className="mt-1 text-sm text-muted-foreground">
            顶栏节点选择器尚未绑定目标节点。BFF 摘要仍可查看，但节点配置与节点安全信息需要先选择后端节点。
          </p>
        </div>
      </div>
    </div>
  );
}

export function ConfigSubmitBar({
  disabled,
  pending,
  selectedNodeName,
  submitMessage,
}: {
  disabled: boolean;
  pending: boolean;
  selectedNodeName: string;
  submitMessage: string | null;
}): JSX.Element {
  return (
    <div className="settings-section-card--compact flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">保存当前节点配置</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {disabled
            ? "请先在顶栏选择后端节点，再提交到当前节点的 /api/v1/config。"
            : `当前目标节点：${selectedNodeName}。提交结构与现有 API 保持一致。`}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {submitMessage ? <span className="text-sm text-muted-foreground">{submitMessage}</span> : null}
        <Button type="submit" disabled={disabled || pending}>
          <Save className="size-4" />
          {pending ? "保存中..." : "保存配置"}
        </Button>
      </div>
    </div>
  );
}

export function SectionUnavailableNotice({
  title,
  description,
}: {
  title: string;
  description: string;
}): JSX.Element {
  return (
    <div className="settings-section-card--compact px-4 py-4">
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}

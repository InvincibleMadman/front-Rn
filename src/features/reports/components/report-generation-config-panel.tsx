import { Download, FileText, RefreshCw, Settings2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export interface ReportGenerationOptions {
  title: string;
  include_assets: boolean;
  include_debug: boolean;
  include_kb: boolean;
  include_raw_json_appendix: boolean;
}

export function ReportGenerationConfigPanel({
  protocol,
  options,
  generating,
  canGenerate,
  onChange,
  onGenerate,
  onRefresh,
}: {
  protocol: string;
  options: ReportGenerationOptions;
  generating: boolean;
  canGenerate: boolean;
  onChange: (next: ReportGenerationOptions) => void;
  onGenerate: () => void;
  onRefresh: () => void;
}): JSX.Element {
  const setField = <K extends keyof ReportGenerationOptions>(key: K, value: ReportGenerationOptions[K]): void => {
    onChange({ ...options, [key]: value });
  };

  return (
    <Card className="card-surface">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><Settings2 className="size-4.5" /> 生成配置</CardTitle>
        <CardDescription>生成启动配置与摘要信息</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>协议</Label>
          <Input value={protocol} readOnly className="bg-card" />
        </div>
        <div className="space-y-2">
          <Label>报告标题</Label>
          <Input value={options.title} onChange={(event) => setField("title", event.target.value)} placeholder={`${protocol} 协议安全测试报告`} />
        </div>
        <div className="space-y-2 rounded-[var(--radius-lg)] border border-border/60 bg-card p-3">
          {[
            ["include_assets", "纳入资产章节"],
            ["include_debug", "纳入调试章节"],
            ["include_kb", "纳入知识库章节"],
            ["include_raw_json_appendix", "附带 JSON 附录"],
          ].map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-3 py-1.5">
              <span className="text-sm">{label}</span>
              <Switch checked={Boolean(options[key as keyof ReportGenerationOptions])} onCheckedChange={(checked) => setField(key as keyof ReportGenerationOptions, checked as never)} />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={onGenerate} disabled={!canGenerate || generating}>
            <FileText className="size-4" />
            {generating ? "生成中..." : "生成 PDF"}
          </Button>
          <Button variant="secondary" onClick={onRefresh}>
            <RefreshCw className="size-4" /> 刷新
          </Button>
          <Button variant="secondary" disabled>
            <Download className="size-4" /> 将在下方历史列表下载
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

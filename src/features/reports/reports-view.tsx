import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, FileText, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/common/form-field";
import { SummaryCard } from "@/components/common/summary-card";
import { JsonViewer } from "@/components/common/json-viewer";
import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { reportsApi } from "@/lib/api/services/reports";
import { protocolsApi } from "@/lib/api/services/protocols";
import { formatDateTime, formatNumber } from "@/lib/utils/format";

export function ReportsView(): JSX.Element {
  const [protocol, setProtocol] = useState("legacy-default");
  const [title, setTitle] = useState("");
  const protocolsQuery = useQuery({ queryKey: ["protocols"], queryFn: protocolsApi.listProtocols, retry: 0 });
  const summaryQuery = useQuery({
    queryKey: ["reports-summary", protocol],
    queryFn: () => reportsApi.getSummary(protocol),
    enabled: Boolean(protocol),
  });
  const listQuery = useQuery({
    queryKey: ["reports-list", protocol],
    queryFn: () => reportsApi.list(protocol),
    enabled: Boolean(protocol),
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      reportsApi.generate(protocol, {
        title: title.trim() || `${protocol} 协议安全测试报告`,
        include_assets: true,
        include_debug: true,
        include_kb: true,
        include_raw_json_appendix: false,
      }),
    onSuccess: async () => {
      await Promise.all([summaryQuery.refetch(), listQuery.refetch()]);
    },
  });

  const preview = useMemo(
    () => ({
      protocol,
      source_ref: summaryQuery.data?.source_ref,
      vulnerability_count: summaryQuery.data?.vulnerability_count ?? 0,
      debug_session_count: summaryQuery.data?.debug_session_count ?? 0,
      build_run_count: summaryQuery.data?.build_run_count ?? 0,
      launch_profile_count: summaryQuery.data?.launch_profile_count ?? 0,
      latest_reports: summaryQuery.data?.latest_reports ?? [],
    }),
    [protocol, summaryQuery.data],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="报 告 中 心"
        title="报告中心"
        description="按协议生成 PDF，汇总资产、KB、风险分析、Fuzz、Crash、GDB 与漏洞中心记录。"
      />

      {generateMutation.error ? <ApiErrorAlert error={generateMutation.error} title="生成报告失败" /> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="历史报告" value={String(summaryQuery.data?.reports_count ?? 0)} hint="reports/" statusColor="blue" />
        <SummaryCard title="漏洞记录" value={String(summaryQuery.data?.vulnerability_count ?? 0)} hint="vulnerability summary" statusColor="rose" />
        <SummaryCard title="GDB 会话" value={String(summaryQuery.data?.debug_session_count ?? 0)} hint="debug summary" statusColor="violet" />
        <SummaryCard title="构建链路" value={String((summaryQuery.data?.build_run_count ?? 0) + (summaryQuery.data?.launch_profile_count ?? 0))} hint="build + launch profile" statusColor="teal" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>生成 PDF</CardTitle>
            <CardDescription>报告文件写入 `workspace://{protocol}/reports/`，不包含服务器绝对路径。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField label="协议">
              <Input list="report-protocols" value={protocol} onChange={(event) => setProtocol(event.target.value)} placeholder="modbus" />
            </FormField>
            <datalist id="report-protocols">
              {(protocolsQuery.data ?? []).map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
            <FormField label="报告标题">
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={`${protocol} 协议安全测试报告`} />
            </FormField>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
                <FileText className="size-4" />
                {generateMutation.isPending ? "生成中..." : "生成 PDF"}
              </Button>
              <Button variant="secondary" onClick={() => { void summaryQuery.refetch(); void listQuery.refetch(); }}>
                <RefreshCw className="size-4" />
                刷新
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>数据预览</CardTitle>
            <CardDescription>展示生成报告前的协议聚合摘要。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-[var(--radius-lg)] border border-border/60 bg-background/50 p-4">
              <JsonViewer data={preview} compact />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>历史报告列表</CardTitle>
          <CardDescription>支持下载，产物中心也可通过 `reports` scope 检索到这些 PDF。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(listQuery.data ?? []).length === 0 ? (
            <div className="rounded-[var(--radius-lg)] border border-dashed border-border/70 bg-background/50 px-4 py-10 text-center text-sm text-muted-foreground">
              暂无历史报告。
            </div>
          ) : (
            (listQuery.data ?? []).map((item) => (
              <div key={item.report_id} className="rounded-[var(--radius-lg)] border border-border/60 bg-background/50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="mt-1 break-all text-xs text-muted-foreground">{item.pdf_ref}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(item.created_at)} / {formatNumber(item.size ?? 0)} bytes</p>
                  </div>
                  <a href={reportsApi.downloadUrl(protocol, item.report_id)} className="inline-flex">
                    <Button size="sm" variant="secondary">
                      <Download className="size-4" />
                      下载
                    </Button>
                  </a>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

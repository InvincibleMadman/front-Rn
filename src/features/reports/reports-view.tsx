import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { PageHeroBoard } from "@/components/layout/page-hero-board";
import { ApiErrorReporter } from "@/components/common/api-error-alert";
import { Input } from "@/components/ui/input";
import { dockLog } from "@/components/layout/dock";
import { protocolsApi } from "@/lib/api/services/protocols";
import { reportsApi } from "@/lib/api/services/reports";
import { cn } from "@/lib/utils/cn";
import type { ReportGenerationOptions } from "@/features/reports/components/report-generation-config-panel";
import type { ReportReadinessNode } from "@/types/api/reports";
import { ReportReadinessBoard } from "@/features/reports/components/report-readiness-board";
import { ReportReadinessTree } from "@/features/reports/components/report-readiness-tree";
import { ReportAssetPreviewPane } from "@/features/reports/components/report-asset-preview-pane";
import { ReportGenerationConfigPanel } from "@/features/reports/components/report-generation-config-panel";
import { ReportGenerationSummary } from "@/features/reports/components/report-generation-summary";
import { ReportHistoryPanel } from "@/features/reports/components/report-history-panel";

function pickDefaultNode(root?: ReportReadinessNode): ReportReadinessNode | undefined {
  if (!root) return undefined;
  if ((root.children ?? []).length === 0) return root;
  const queue: ReportReadinessNode[] = [...(root.children ?? [])];
  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;
    if ((current.children ?? []).length === 0) return current;
    queue.push(...(current.children ?? []));
  }
  return root;
}

function findNode(root: ReportReadinessNode | undefined, id: string | undefined): ReportReadinessNode | undefined {
  if (!root || !id) return undefined;
  if (root.id === id) return root;
  for (const child of root.children ?? []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return undefined;
}

export function ReportsView(): JSX.Element {
  const [protocol, setProtocol] = useState("");
  const [subpage, setSubpage] = useState<"workspace" | "history">("workspace");
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(undefined);
  const [options, setOptions] = useState<ReportGenerationOptions>({
    title: "",
    include_assets: true,
    include_debug: true,
    include_kb: true,
    include_raw_json_appendix: false,
  });

  useEffect(() => {
    dockLog("info", "reports", "entered reports workspace", { protocol });
    return () => dockLog("info", "reports", "left reports workspace");
  }, []);

  const protocolsQuery = useQuery({ queryKey: ["protocols"], queryFn: protocolsApi.listProtocols, retry: 0 });
  const summaryQuery = useQuery({ queryKey: ["reports-summary", protocol], queryFn: () => reportsApi.getSummary(protocol), enabled: Boolean(protocol) });
  const previewQuery = useQuery({ queryKey: ["reports-preview", protocol], queryFn: () => reportsApi.getPreview(protocol), enabled: Boolean(protocol) });
  const listQuery = useQuery({ queryKey: ["reports-list", protocol], queryFn: () => reportsApi.list(protocol), enabled: Boolean(protocol) });

  useEffect(() => {
    const protocolOptions = protocolsQuery.data ?? [];
    if (!protocolOptions.length) return;
    if (!protocol) {
      setProtocol(protocolOptions[0]);
    }
  }, [protocolsQuery.data, protocol]);

  useEffect(() => {
    if (!protocol) return;
    if (!options.title.trim()) {
      setOptions((current) => ({ ...current, title: `${protocol} 协议安全测试报告` }));
    }
  }, [protocol]);

  useEffect(() => {
    const defaultNode = pickDefaultNode(previewQuery.data?.readiness_tree);
    setSelectedNodeId(defaultNode?.id);
  }, [previewQuery.data?.readiness_tree]);

  const selectedNode = useMemo(
    () => findNode(previewQuery.data?.readiness_tree, selectedNodeId) ?? pickDefaultNode(previewQuery.data?.readiness_tree),
    [previewQuery.data?.readiness_tree, selectedNodeId],
  );

  const generateMutation = useMutation({
    mutationFn: () => reportsApi.generate(protocol, { ...options, title: options.title.trim() || `${protocol} 协议安全测试报告` }),
    onSuccess: async (report) => {
      dockLog("success", "reports", `report generated: ${report.report_id}`, { protocol, pdf_ref: report.pdf_ref });
      await Promise.all([summaryQuery.refetch(), previewQuery.refetch(), listQuery.refetch()]);
    },
    onError: (error) => dockLog("error", "reports", "generate report failed", error),
  });

  const refreshAll = (): void => {
    dockLog("info", "reports", "refresh report preparation workspace", { protocol });
    void summaryQuery.refetch();
    void previewQuery.refetch();
    void listQuery.refetch();
  };

  return (
    <div className="space-y-5">
      <ApiErrorReporter error={protocolsQuery.error} title="加载协议列表失败" source="reports" />
      <ApiErrorReporter error={summaryQuery.error} title="加载报告摘要失败" source="reports" />
      <ApiErrorReporter error={previewQuery.error} title="加载报告准备度失败" source="reports" />
      <ApiErrorReporter error={listQuery.error} title="加载历史报告失败" source="reports" />
      <ApiErrorReporter error={generateMutation.error} title="生成报告失败" source="reports" />

      <PageHeroBoard
          eyebrow="R E P O R T S · W O R K B E N C H"
          title="报告中心"
          description="将页面主体改为真正的三栏准备工作台：左侧章节准备树，中间资产 / 证据预览，右侧生成配置与生成摘要。"
          boardClassName="[--board-surface:190_100%_97%] [--board-border:215_58%_84%] [--board-track:201_62%_92%] [--board-accent-soft:191_86%_93%] [--board-accent:194_72%_46%] [--board-accent-strong:228_70%_44%] dark:[--board-surface:222_27%_18%] dark:[--board-border:223_28%_33%] dark:[--board-track:221_19%_27%] dark:[--board-accent-soft:213_34%_27%] dark:[--board-accent:192_86%_68%] dark:[--board-accent-strong:230_90%_76%]"
          board={<ReportReadinessBoard preview={previewQuery.data} />}
      />

      <div className="card-surface rounded-[var(--radius-xl)] p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/65 p-1">
            {[
              { key: "workspace", label: "工作区" },
              { key: "history", label: "历史报告" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setSubpage(item.key as "workspace" | "history")}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm transition-colors",
                  subpage === item.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="min-w-[16rem] flex-1">
            <Input
              list="report-protocols"
              value={protocol}
              onChange={(event) => {
                const next = event.target.value;
                setProtocol(next);
                dockLog("info", "reports", "report protocol changed", { protocol: next || "empty" });
              }}
              placeholder={protocolsQuery.isLoading ? "加载协议中..." : "输入或选择协议"}
              className="bg-background/80"
            />
            <datalist id="report-protocols">
              {(protocolsQuery.data ?? []).map((item) => <option key={item} value={item} />)}
            </datalist>
          </div>
        </div>
      </div>

      {subpage === "workspace" ? (
        <div className="grid gap-4 xl:grid-cols-[18rem_minmax(0,1.08fr)_24rem]">
          <div className="space-y-4">
            <ReportReadinessTree
              root={previewQuery.data?.readiness_tree}
              selectedId={selectedNode?.id}
              onSelect={(node) => {
                setSelectedNodeId(node.id);
                dockLog("info", "reports", "report section selected", { node_id: node.id, title: node.title, status: node.status });
              }}
            />
          </div>

          <ReportAssetPreviewPane preview={previewQuery.data} selectedNode={selectedNode} />

          <div className="space-y-4">
            <ReportGenerationConfigPanel
              protocol={protocol}
              options={options}
              generating={generateMutation.isPending}
              canGenerate={Boolean(protocol)}
              onChange={setOptions}
              onGenerate={() => generateMutation.mutate()}
              onRefresh={refreshAll}
            />
            <ReportGenerationSummary protocol={protocol} preview={previewQuery.data} />
          </div>
        </div>
      ) : (
        <ReportHistoryPanel protocol={protocol} reports={listQuery.data ?? []} summary={summaryQuery.data} />
      )}
    </div>
  );
}

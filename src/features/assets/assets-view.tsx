import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, FolderTree, GitBranch, RefreshCcw, Trash2, UploadCloud } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { dockLog } from "@/components/layout/dock";
import { reportGlobalError } from "@/components/common/global-error-center";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/common/form-field";
import { SummaryCard } from "@/components/common/summary-card";
import { EchartsBase, useEchartsPalette, type ChartOption } from "@/components/charts/echarts-base";
import { assetsApi } from "@/lib/api/services/assets";
import { useAuthStore } from "@/stores/auth-store";
import { formatDateTime, formatNumber } from "@/lib/utils/format";

const scopeTabs = ["source", "specs", "vuldocs", "kb", "seeds", "risk", "jobs", "debug", "reports"] as const;

function graphOption(palette: string[], nodes: Array<{ id: string; name: string }>, edges: Array<{ source: string; target: string }>): ChartOption {
  if (!nodes.length) {
    return {
      graphic: {
        type: "text",
        left: "center",
        top: "middle",
        style: { text: "暂无协议资产图", fill: "#94a3b8", fontSize: 14 },
      },
    };
  }

  return {
    color: [palette[0], palette[1], palette[2]],
    tooltip: {},
    series: [{
      type: "graph",
      layout: "circular",
      roam: true,
      data: nodes.map((node, index) => ({ ...node, symbolSize: index === 0 ? 56 : 40 })),
      links: edges,
      label: { show: true },
      lineStyle: { opacity: 0.48, width: 2 },
    }],
  };
}

function useQueryErrorToast(error: unknown, title: string, source: string, message: string): void {
  useEffect(() => {
    if (!error) return;
    reportGlobalError(error, title, source);
    dockLog("error", source, message);
  }, [error, message, source, title]);
}

export function AssetsView(): JSX.Element {
  const palette = useEchartsPalette();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === "admin";
  const [protocol, setProtocol] = useState("legacy-default");
  const [scope, setScope] = useState<(typeof scopeTabs)[number]>("source");
  const [path, setPath] = useState("/");
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [selectedPreviewPath, setSelectedPreviewPath] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const overviewQuery = useQuery({ queryKey: ["assets-overview-graph"], queryFn: assetsApi.getOverviewGraph });
  const summaryQuery = useQuery({ queryKey: ["protocol-assets-summary", protocol], queryFn: () => assetsApi.getProtocolAssetsSummary(protocol) });
  const treeQuery = useQuery({ queryKey: ["workspace-tree", protocol, scope, path], queryFn: () => assetsApi.getWorkspaceTree(protocol, scope, path) });
  const previewQuery = useQuery({
    queryKey: ["workspace-preview", protocol, scope, selectedPreviewPath],
    queryFn: () => assetsApi.getWorkspacePreview(protocol, scope, selectedPreviewPath),
    enabled: Boolean(selectedPreviewPath),
  });

  useQueryErrorToast(overviewQuery.error, "资产总览加载失败", "assets", "Asset overview failed");
  useQueryErrorToast(summaryQuery.error, "协议资产摘要加载失败", "assets", "Asset summary failed");
  useQueryErrorToast(treeQuery.error, "工作区文件树加载失败", "assets", "Workspace tree failed");
  useQueryErrorToast(previewQuery.error, "工作区文件预览失败", "assets", "Workspace preview failed");

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile) throw new Error("请选择压缩包文件");
      dockLog("info", "assets", "Source archive upload started");
      return assetsApi.uploadArchive(protocol, uploadFile, true);
    },
    onSuccess: async () => {
      dockLog("success", "assets", "Source archive upload finished");
      await Promise.all([summaryQuery.refetch(), treeQuery.refetch(), overviewQuery.refetch()]);
    },
    onError: (error) => {
      reportGlobalError(error, "源码上传失败", "assets");
      dockLog("error", "assets", "Asset operation failed");
    },
  });

  const importMutation = useMutation({
    mutationFn: () => {
      dockLog("info", "assets", "Git import started");
      return assetsApi.importGit(protocol, repoUrl, branch, true);
    },
    onSuccess: async () => {
      dockLog("success", "assets", "Git import finished");
      await Promise.all([summaryQuery.refetch(), treeQuery.refetch(), overviewQuery.refetch()]);
    },
    onError: (error) => {
      reportGlobalError(error, "Git 导入失败", "assets");
      dockLog("error", "assets", "Asset operation failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      dockLog("warn", "assets", "Protocol project delete requested");
      return assetsApi.deleteProtocol(protocol);
    },
    onSuccess: async () => {
      dockLog("success", "assets", "Protocol project deleted");
      setSelectedPreviewPath("");
      await Promise.all([summaryQuery.refetch(), treeQuery.refetch(), overviewQuery.refetch()]);
    },
    onError: (error) => {
      reportGlobalError(error, "协议删除失败", "assets");
      dockLog("error", "assets", "Asset operation failed");
    },
  });

  const graph = overviewQuery.data ?? { nodes: [], edges: [], protocol_count: 0 };
  const summary = summaryQuery.data;
  const tree = treeQuery.data;
  const preview = previewQuery.data;

  const assetIndexItems = useMemo(() => {
    return (tree?.items ?? []).filter((item) => item.type !== "directory").slice(0, 8);
  }, [tree?.items]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="资 产 中 心"
        title="资产中心"
        description="管理当前后端节点内的协议资产空间，支持协议资产图、源码导入、虚拟文件树、文件预览与安全下载。"
      />

      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard title="协议数量" value={formatNumber(graph.protocol_count)} hint="Asset graph summary" statusColor="blue" />
        <SummaryCard title="源码文件数" value={formatNumber(summary?.files_count ?? 0)} hint={summary?.ready ? "source workspace ready" : "source workspace empty"} statusColor="emerald" />
        <SummaryCard title="当前 scope" value={scope} hint={`workspace://{protocol}/${scope}${path === "/" ? "/" : path}`} statusColor="violet" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>协议资产总览图</CardTitle>
            <CardDescription>展示当前节点协议资产图和协议级关系摘要。</CardDescription>
          </CardHeader>
          <CardContent>
            <EchartsBase option={graphOption(palette, graph.nodes, graph.edges)} height={320} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>导入源码</CardTitle>
            <CardDescription>支持压缩包导入与 Git HTTPS 导入，保持 Browser to Web BFF to Backend Node 架构。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField label="协议">
              <Input value={protocol} onChange={(event) => setProtocol(event.target.value.trim() || "legacy-default")} placeholder="modbus" />
            </FormField>
            <FormField label="源码压缩包">
              <Input type="file" accept=".zip,.tar,.gz,.tgz" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} />
            </FormField>
            <div className="flex gap-2">
              <Button onClick={() => uploadMutation.mutate()} disabled={uploadMutation.isPending || !uploadFile}>
                <UploadCloud className="size-4" />
                上传并解压
              </Button>
            </div>
            <FormField label="Git HTTPS URL">
              <Input value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} placeholder="https://github.com/example/repo.git" />
            </FormField>
            <FormField label="Branch">
              <Input value={branch} onChange={(event) => setBranch(event.target.value)} placeholder="main" />
            </FormField>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => importMutation.mutate()} disabled={importMutation.isPending || !repoUrl.trim()}>
                <GitBranch className="size-4" />
                Git 导入
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  dockLog("info", "assets", "Workspace tree refreshed");
                  await Promise.all([treeQuery.refetch(), summaryQuery.refetch()]);
                }}
                disabled={treeQuery.isFetching || summaryQuery.isFetching}
              >
                <RefreshCcw className="size-4" />
                刷新文件树
              </Button>
              {isAdmin ? (
                <Button variant="danger" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
                  <Trash2 className="size-4" />
                  删除协议项目
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <FolderTree className="size-4 text-[hsl(var(--accent-blue))]" />
              虚拟文件树
            </CardTitle>
            <CardDescription>仅显示虚拟路径，不展示服务器绝对路径。</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={scope} onValueChange={(value) => { setScope(value as (typeof scopeTabs)[number]); setPath("/"); setSelectedPreviewPath(""); }}>
              <TabsList className="mb-4 flex h-auto flex-wrap gap-1 bg-transparent p-0">
                {scopeTabs.map((item) => (
                  <TabsTrigger key={item} value={item} className="rounded-full border border-border/60 bg-background/60 px-3 py-2 text-xs uppercase tracking-[0.16em] data-[state=active]:bg-card">
                    {item}
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value={scope} className="mt-0 space-y-3">
                <div className="rounded-[var(--radius-lg)] border border-border/50 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                  当前目录：`workspace://{protocol}/{scope}{path === "/" ? "/" : path}`
                </div>
                {(tree?.items?.length ?? 0) === 0 ? (
                  <div className="rounded-[var(--radius-lg)] border border-border/50 bg-background/60 px-4 py-10 text-center text-sm text-muted-foreground">
                    暂无工作区文件。
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>名称</TableHead>
                        <TableHead>类型</TableHead>
                        <TableHead>虚拟路径</TableHead>
                        <TableHead>大小</TableHead>
                        <TableHead>更新时间</TableHead>
                        <TableHead>操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(tree?.items ?? []).map((item) => (
                        <TableRow key={`${item.virtual_path}-${item.type}`}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell>{item.type}</TableCell>
                          <TableCell className="font-mono text-xs">{item.virtual_path}</TableCell>
                          <TableCell>{item.size == null ? "—" : formatNumber(item.size)}</TableCell>
                          <TableCell>{formatDateTime(new Date(item.updated_at * 1000).toISOString())}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {item.type === "directory" ? (
                                <Button size="sm" variant="outline" onClick={() => setPath(item.virtual_path)}>进入</Button>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      dockLog("info", "assets", "Workspace file preview loaded");
                                      setSelectedPreviewPath(item.virtual_path);
                                    }}
                                  >
                                    预览
                                  </Button>
                                  <a
                                    href={assetsApi.getWorkspaceDownloadUrl(protocol, scope, item.virtual_path)}
                                    className="inline-flex"
                                    onClick={() => dockLog("info", "assets", "Workspace file download requested")}
                                  >
                                    <Button size="sm" variant="secondary">
                                      <Download className="size-3.5" />
                                      下载
                                    </Button>
                                  </a>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>文件预览</CardTitle>
              <CardDescription>只预览 text / json / hex，不渲染 HTML。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-[var(--radius-lg)] border border-border/50 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                {selectedPreviewPath ? `当前文件：workspace://${protocol}/${scope}${selectedPreviewPath}` : "请选择一个文件进行预览"}
              </div>
              {!preview ? (
                <div className="rounded-[var(--radius-lg)] border border-border/50 bg-background/60 px-4 py-10 text-center text-sm text-muted-foreground">
                  暂无预览内容。
                </div>
              ) : preview.preview_type === "hex" ? (
                <div className="space-y-2 rounded-[var(--radius-lg)] border border-border/50 bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">HEX</p>
                  <pre className="overflow-auto whitespace-pre-wrap break-all text-xs leading-6 text-foreground">{preview.hex}</pre>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">ASCII</p>
                  <pre className="overflow-auto whitespace-pre-wrap break-all text-xs leading-6 text-foreground">{preview.ascii}</pre>
                </div>
              ) : (
                <div className="rounded-[var(--radius-lg)] border border-border/50 bg-background/60 p-4">
                  <pre className="overflow-auto whitespace-pre-wrap break-all text-xs leading-6 text-foreground">{preview.content}</pre>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>协议资产索引</CardTitle>
              <CardDescription>展示当前工作区的轻量文件索引，便于快速定位预览和下载。</CardDescription>
            </CardHeader>
            <CardContent>
              {assetIndexItems.length === 0 ? (
                <div className="rounded-[var(--radius-lg)] border border-border/50 bg-background/60 px-4 py-10 text-center text-sm text-muted-foreground">
                  暂无索引条目。
                </div>
              ) : (
                <div className="space-y-2">
                  {assetIndexItems.map((item) => (
                    <div key={`${item.virtual_path}-${item.updated_at}`} className="rounded-[var(--radius-lg)] border border-border/50 bg-background/60 px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{item.name}</p>
                          <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{item.virtual_path}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">{item.type ?? "file"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { dockLog } from "@/components/layout/dock";
import { reportGlobalError } from "@/components/common/global-error-center";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { assetsApi } from "@/lib/api/services/assets";
import { formatDateTime, formatNumber } from "@/lib/utils/format";

const scopeOptions = ["all", "source", "specs", "vuldocs", "kb", "seeds", "risk", "jobs", "debug", "reports"] as const;

function useArtifactsError(error: unknown): void {
  useEffect(() => {
    if (!error) return;
    reportGlobalError(error, "产物中心加载失败", "artifacts");
    dockLog("error", "artifacts", "Artifact operation failed");
  }, [error]);
}

export function ArtifactsView(): JSX.Element {
  const [keyword, setKeyword] = useState("");
  const [protocol, setProtocol] = useState("");
  const [scope, setScope] = useState<(typeof scopeOptions)[number]>("all");
  const [kind, setKind] = useState("");
  const [previewTarget, setPreviewTarget] = useState<{ protocol: string; scope: string; path: string } | null>(null);

  const artifactsQuery = useQuery({
    queryKey: ["artifacts-list", keyword, protocol, scope, kind],
    queryFn: () => assetsApi.listAssets({
      keyword: keyword || undefined,
      protocol: protocol || undefined,
      scope: scope === "all" ? undefined : scope,
      kind: kind || undefined,
    }),
  });

  const previewQuery = useQuery({
    queryKey: ["artifact-preview", previewTarget?.protocol, previewTarget?.scope, previewTarget?.path],
    queryFn: () => assetsApi.getWorkspacePreview(previewTarget!.protocol, previewTarget!.scope, previewTarget!.path),
    enabled: Boolean(previewTarget),
  });

  useArtifactsError(artifactsQuery.error);
  useArtifactsError(previewQuery.error);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="产 物 中 心"
        title="产物中心"
        description="全局综合检索系统运行产生的资产材料，便于分类搜集整理，提供安全预览与下载"
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Search className="size-4 text-[hsl(var(--accent-blue))]" />
            跨协议产物搜索
          </CardTitle>
          <CardDescription>产物中心只负责跨协议证据检索，不承担源码导入和虚拟文件树管理。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <Input
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              dockLog("info", "artifacts", "Artifact filter changed");
            }}
            placeholder="关键词 / 文件名 / virtual path"
          />
          <Input
            value={protocol}
            onChange={(event) => {
              setProtocol(event.target.value);
              dockLog("info", "artifacts", "Artifact filter changed");
            }}
            placeholder="协议过滤，可留空"
          />
          <Input
            value={scope}
            onChange={(event) => {
              setScope(event.target.value as (typeof scopeOptions)[number]);
              dockLog("info", "artifacts", "Artifact filter changed");
            }}
            placeholder="scope"
          />
          <Input
            value={kind}
            onChange={(event) => {
              setKind(event.target.value);
              dockLog("info", "artifacts", "Artifact filter changed");
            }}
            placeholder="kind，例如 reports / jobs / directory"
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>产物列表</CardTitle>
            <CardDescription>展示节点、协议、scope、kind、name、virtual_path、workspace_ref、size、updated_at 与操作入口。</CardDescription>
          </CardHeader>
          <CardContent>
            {(artifactsQuery.data?.length ?? 0) === 0 ? (
              <div className="rounded-[var(--radius-lg)] border border-border/50 bg-background/60 px-4 py-10 text-center text-sm text-muted-foreground">
                暂无产物数据。
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>协议</TableHead>
                    <TableHead>scope</TableHead>
                    <TableHead>kind</TableHead>
                    <TableHead>name</TableHead>
                    <TableHead>virtual_path</TableHead>
                    <TableHead>workspace_ref</TableHead>
                    <TableHead>size</TableHead>
                    <TableHead>updated_at</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(artifactsQuery.data ?? []).map((item, index) => (
                    <TableRow key={`${item.workspace_ref}-${index}`}>
                      <TableCell>{item.protocol}</TableCell>
                      <TableCell>{item.scope ?? "-"}</TableCell>
                      <TableCell>{item.kind ?? item.type ?? "-"}</TableCell>
                      <TableCell>{item.name ?? "-"}</TableCell>
                      <TableCell className="font-mono text-xs">{item.virtual_path ?? "-"}</TableCell>
                      <TableCell className="font-mono text-xs">{item.workspace_ref}</TableCell>
                      <TableCell>{item.size == null ? "—" : formatNumber(item.size)}</TableCell>
                      <TableCell>{item.updated_at ? formatDateTime(new Date(item.updated_at * 1000).toISOString()) : "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {item.virtual_path && item.scope ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                dockLog("info", "artifacts", "Artifact preview loaded");
                                const nextScope = item.scope;
                                const nextPath = item.virtual_path;
                                if (!nextScope || !nextPath) return;
                                setPreviewTarget({ protocol: item.protocol, scope: nextScope, path: nextPath });
                              }}
                            >
                              预览
                            </Button>
                          ) : null}
                          {item.virtual_path && item.scope ? (
                            <a
                              href={assetsApi.getWorkspaceDownloadUrl(item.protocol, item.scope, item.virtual_path)}
                              className="inline-flex"
                              onClick={() => dockLog("info", "artifacts", "Artifact download requested")}
                            >
                              <Button size="sm" variant="secondary">
                                <Download className="size-3.5" />
                                下载
                              </Button>
                            </a>
                          ) : null}
                          {item.scope ? (
                            <Button size="sm" variant="outline" onClick={() => dockLog("info", "artifacts", "Artifact jump requested")}>
                              跳转关联
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>产物预览</CardTitle>
            <CardDescription>继续使用现有 workspace 预览能力，不暴露真实服务器路径。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-[var(--radius-lg)] border border-border/50 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
              {previewTarget ? `当前文件：workspace://${previewTarget.protocol}/${previewTarget.scope}${previewTarget.path}` : "请选择一个产物进行预览"}
            </div>
            {!previewQuery.data ? (
              <div className="rounded-[var(--radius-lg)] border border-border/50 bg-background/60 px-4 py-10 text-center text-sm text-muted-foreground">
                暂无预览内容。
              </div>
            ) : previewQuery.data.preview_type === "hex" ? (
              <div className="space-y-2 rounded-[var(--radius-lg)] border border-border/50 bg-background/60 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">HEX</p>
                <pre className="overflow-auto whitespace-pre-wrap break-all text-xs leading-6 text-foreground">{previewQuery.data.hex}</pre>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">ASCII</p>
                <pre className="overflow-auto whitespace-pre-wrap break-all text-xs leading-6 text-foreground">{previewQuery.data.ascii}</pre>
              </div>
            ) : (
              <div className="rounded-[var(--radius-lg)] border border-border/50 bg-background/60 p-4">
                <pre className="overflow-auto whitespace-pre-wrap break-all text-xs leading-6 text-foreground">{previewQuery.data.content}</pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

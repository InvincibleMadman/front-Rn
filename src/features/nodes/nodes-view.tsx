import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Network, Save, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/common/form-field";
import { ApiErrorReporter } from "@/components/common/api-error-alert";
import { JsonViewer } from "@/components/common/json-viewer";
import { StatusBadge } from "@/components/common/status-badge";
import { nodesApi } from "@/lib/api/services/nodes";
import { useAuthStore } from "@/stores/auth-store";
import { useUiStore } from "@/stores/ui-store";
import type { ApiNode, NodePingResult } from "@/types/api/nodes";

function emptyNode(): ApiNode {
  return { id: "", name: "", baseUrl: "", description: "", enabled: true };
}

export function NodesView(): JSX.Element {
  const selectedNodeId = useUiStore((state) => state.selectedApiNodeId);
  const currentUser = useAuthStore((state) => state.user);
  const isAdmin = currentUser?.role === "admin";
  const [editing, setEditing] = useState<ApiNode>(emptyNode());
  const [nodeSecret, setNodeSecret] = useState("");
  const [pingResults, setPingResults] = useState<Record<string, NodePingResult>>({});
  const [pingError, setPingError] = useState<unknown>();
  const [lastPingTarget, setLastPingTarget] = useState<ApiNode | null>(null);

  const nodesQuery = useQuery({ queryKey: ["api-nodes", "management"], queryFn: nodesApi.loadAllNodes });
  const nodes = nodesQuery.data?.nodes ?? [];
  const mine = useMemo(() => nodes.filter((node) => node.createdBy === currentUser?.user_id), [nodes, currentUser?.user_id]);
  const others = useMemo(() => nodes.filter((node) => node.createdBy !== currentUser?.user_id), [nodes, currentUser?.user_id]);

  const pingMutation = useMutation({
    mutationFn: nodesApi.pingNode,
    onSuccess: (result) => {
      if (lastPingTarget?.id) setPingResults((current) => ({ ...current, [lastPingTarget.id]: result }));
      setPingError(undefined);
    },
    onError: setPingError,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editing.id.trim() || !editing.name.trim() || !editing.baseUrl.trim()) {
        throw new Error("节点 ID、名称、Base URL 为必填项");
      }
      if (nodes.some((node) => node.id === editing.id)) {
        return nodesApi.updateNode(editing.id, {
          name: editing.name,
          baseUrl: editing.baseUrl,
          description: editing.description,
          enabled: editing.enabled,
          ...(nodeSecret.trim() ? { nodeSecret } : {}),
        });
      }
      if (!nodeSecret.trim()) throw new Error("新增节点必须填写 node secret");
      return nodesApi.createNode({
        id: editing.id,
        name: editing.name,
        baseUrl: editing.baseUrl,
        description: editing.description,
        enabled: editing.enabled,
        nodeSecret,
      });
    },
    onSuccess: async () => {
      setEditing(emptyNode());
      setNodeSecret("");
      await nodesQuery.refetch();
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => nodesApi.deleteNode(id),
    onSuccess: async () => {
      await nodesQuery.refetch();
    },
  });

  const canEditNode = (node: ApiNode): boolean => {
    if (isAdmin) return true;
    return node.createdBy === currentUser?.user_id;
  };

  const pingNode = (node: ApiNode): void => {
    setLastPingTarget(node);
    pingMutation.mutate(node);
  };

  const renderNode = (node: ApiNode): JSX.Element => (
    <div key={node.id} className="rounded-xl border border-border/60 bg-background/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold">{node.name}</p>
            <StatusBadge status={node.enabled ? "running" : "stopped"} />
            {selectedNodeId === node.id ? <StatusBadge status="running" /> : null}
          </div>
          <p className="mt-1 break-all text-sm text-muted-foreground">{node.baseUrl}</p>
          {node.description ? <p className="mt-1 text-xs text-muted-foreground">{node.description}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => nodesApi.selectNode(node)}>设为当前</Button>
          <Button size="sm" variant="outline" onClick={() => pingNode(node)}>Ping</Button>
          {canEditNode(node) ? <Button size="sm" variant="outline" onClick={() => { setEditing(node); setNodeSecret(""); }}>编辑</Button> : null}
          {isAdmin ? <Button size="sm" variant="danger" onClick={() => removeMutation.mutate(node.id)}><Trash2 className="size-3.5" />删除</Button> : null}
        </div>
      </div>
      {pingResults[node.id] ? (
        <div className="mt-3 rounded-xl border border-success/30 bg-success/10 p-3 text-sm">
          Ping 成功：{pingResults[node.id].latencyMs} ms · {pingResults[node.id].endpoint}
          <JsonViewer data={pingResults[node.id].data} compact />
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-6">
      <ApiErrorReporter error={nodesQuery.error} title="加载节点列表失败" source="nodes" />
      <ApiErrorReporter error={pingError} title="节点 Ping 失败" source="nodes" />
      <ApiErrorReporter error={saveMutation.error} title="节点保存失败" source="nodes" />
      <ApiErrorReporter error={removeMutation.error} title="节点删除失败" source="nodes" />
      <PageHeader eyebrow="Backend Nodes" title="后端节点管理" description="Web BFF 层统一管理后端实例节点信息，提供HMAC密钥认证通过节点检查进行安全访问" />

      <div className="grid gap-4 xl:grid-cols-[1fr_0.85fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>我创建的节点</CardTitle><CardDescription>可选择、Ping，并在权限允许时编辑。</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {mine.length ? mine.map(renderNode) : (
                <p className="text-sm text-muted-foreground">
                  {nodesQuery.error ? "节点列表暂不可用，详细错误已转入全局弹窗与日志栏。" : "暂无节点。"}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>其他节点</CardTitle><CardDescription>管理员可管理所有节点；普通用户只能查看和切换。</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {others.length ? others.map(renderNode) : (
                <p className="text-sm text-muted-foreground">
                  {nodesQuery.error ? "节点列表暂不可用，详细错误已转入全局弹窗与日志栏。" : "暂无其他节点。"}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Network className="size-4 text-primary" />新增 / 编辑节点</CardTitle><CardDescription>节点由 Web BFF 保存，浏览器不回显 node secret。</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <FormField label="节点 ID"><Input value={editing.id} onChange={(e) => setEditing((node) => ({ ...node, id: e.target.value.trim() }))} placeholder="vm-dev" /></FormField>
            <FormField label="节点名称"><Input value={editing.name} onChange={(e) => setEditing((node) => ({ ...node, name: e.target.value }))} placeholder="虚拟机开发后端" /></FormField>
            <FormField label="Base URL"><Input value={editing.baseUrl} onChange={(e) => setEditing((node) => ({ ...node, baseUrl: e.target.value }))} placeholder="http://192.168.56.101:18000" /></FormField>
            <FormField label="描述"><Input value={editing.description ?? ""} onChange={(e) => setEditing((node) => ({ ...node, description: e.target.value }))} /></FormField>
            <FormField label="Node Secret"><Input type="password" value={nodeSecret} onChange={(e) => setNodeSecret(e.target.value)} placeholder={editing.id && nodes.some((node) => node.id === editing.id) ? "留空表示不变更" : "必填"} /></FormField>
            <div className="flex gap-2">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}><Save className="size-4" />保存节点</Button>
              <Button variant="secondary" onClick={() => { setEditing(emptyNode()); setNodeSecret(""); }}><X className="size-4" />清空表单</Button>
              <Button variant="outline" disabled={!editing.baseUrl} onClick={() => pingNode(editing)}>Ping 表单节点</Button>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/50 p-3 text-sm text-muted-foreground">正式访问将由 Web BFF 代理到节点。浏览器侧只切换 selectedNodeId，不再直接切后端 URL。</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MoreHorizontal, GitBranch, Trash2, UploadCloud } from "lucide-react";
import { dockLog } from "@/components/layout/dock";
import { reportGlobalError } from "@/components/common/global-error-center";
import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { assetsApi } from "@/lib/api/services/assets";
import { normalizeProtocol } from "@/features/assets/asset-utils";

interface AssetImportActionsProps {
  protocol: string;
  isAdmin: boolean;
  importOpen: boolean;
  onImportOpenChange: (open: boolean) => void;
  onAfterChange?: () => Promise<unknown> | void;
  onProtocolDeleted?: () => void;
  onProtocolImported?: (protocol: string) => void;
}

export function AssetImportActions({
  protocol,
  isAdmin,
  importOpen,
  onImportOpenChange,
  onAfterChange,
  onProtocolDeleted,
  onProtocolImported,
}: AssetImportActionsProps): JSX.Element {
  const normalizedProtocol = normalizeProtocol(protocol);
  const [moreOpen, setMoreOpen] = useState(false);
  const [targetProtocol, setTargetProtocol] = useState(normalizedProtocol);
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const normalizedTargetProtocol = normalizeProtocol(targetProtocol);

  useEffect(() => {
    if (!importOpen) return;
    setTargetProtocol(normalizedProtocol);
  }, [importOpen, normalizedProtocol]);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile) {
        throw new Error("请选择压缩包文件");
      }

      dockLog("info", "assets", "Source archive upload started");
      return assetsApi.uploadArchive(normalizedTargetProtocol, uploadFile, true);
    },
    onSuccess: async (payload) => {
      const createdProtocol = normalizeProtocol(payload.protocol || normalizedTargetProtocol);
      dockLog("success", "assets", "Source archive upload finished");
      onImportOpenChange(false);
      setUploadFile(null);
      await onAfterChange?.();
      onProtocolImported?.(createdProtocol);
    },
    onError: (error) => {
      reportGlobalError(error, "源码上传失败", "assets");
      dockLog("error", "assets", "Asset operation failed");
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      dockLog("info", "assets", "Git import started");
      return assetsApi.importGit(normalizedTargetProtocol, repoUrl, branch, true);
    },
    onSuccess: async (payload) => {
      const createdProtocol = normalizeProtocol(payload.protocol || normalizedTargetProtocol);
      dockLog("success", "assets", "Git import finished");
      onImportOpenChange(false);
      await onAfterChange?.();
      onProtocolImported?.(createdProtocol);
    },
    onError: (error) => {
      reportGlobalError(error, "Git 导入失败", "assets");
      dockLog("error", "assets", "Asset operation failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      dockLog("warn", "assets", "Protocol project delete requested");
      await assetsApi.deleteProtocol(normalizedProtocol);
    },
    onSuccess: async () => {
      dockLog("success", "assets", "Protocol project deleted");
      onProtocolDeleted?.();
      setMoreOpen(false);
    },
    onError: (error) => {
      reportGlobalError(error, "协议删除失败", "assets");
      dockLog("error", "assets", "Asset operation failed");
    },
  });

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => onImportOpenChange(true)}>
        <UploadCloud className="size-4" />
        导入源码
      </Button>

      {isAdmin ? (
        <Button variant="outline" size="sm" onClick={() => setMoreOpen(true)}>
          <MoreHorizontal className="size-4" />
          更多
        </Button>
      ) : null}

      <Dialog open={importOpen} onOpenChange={onImportOpenChange}>
        {importOpen ? (
          <DialogContent className="w-[min(92vw,42rem)] space-y-5">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Asset Import</p>
              <h2 className="mt-2 text-lg font-semibold text-foreground">导入协议源码</h2>
              <p className="mt-1 text-sm text-muted-foreground">后端会将协议名规范化后作为协议根目录名。</p>
            </div>

            <div className="space-y-4 rounded-[var(--radius-xl)] border border-border/70 bg-background/60 p-4">
              <FormField label="目标协议名" description="导入时会以该协议名作为协议根目录名">
                <Input
                  value={targetProtocol}
                  onChange={(event) => setTargetProtocol(event.target.value)}
                  placeholder="legacy-default"
                />
              </FormField>
              {targetProtocol.trim() && targetProtocol.trim() !== normalizedTargetProtocol ? (
                <p className="text-xs text-muted-foreground">后端会规范化为 {normalizedTargetProtocol}</p>
              ) : null}
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-4 rounded-[var(--radius-xl)] border border-border/70 bg-background/60 p-4">
                <div className="flex items-center gap-2">
                  <UploadCloud className="size-4 text-[hsl(var(--accent-blue))]" />
                  <p className="text-sm font-medium text-foreground">压缩包导入</p>
                </div>
                <FormField label="源码压缩包" description="支持 .zip / .tar / .gz / .tgz">
                  <Input
                    type="file"
                    accept=".zip,.tar,.gz,.tgz"
                    onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                  />
                </FormField>
                <Button
                  onClick={() => uploadMutation.mutate()}
                  disabled={uploadMutation.isPending || !uploadFile || !normalizedTargetProtocol}
                >
                  <UploadCloud className="size-4" />
                  上传并解压
                </Button>
              </div>

              <div className="space-y-4 rounded-[var(--radius-xl)] border border-border/70 bg-background/60 p-4">
                <div className="flex items-center gap-2">
                  <GitBranch className="size-4 text-[hsl(var(--accent-orange))]" />
                  <p className="text-sm font-medium text-foreground">Git 导入</p>
                </div>
                <FormField label="Git HTTPS URL">
                  <Input
                    value={repoUrl}
                    onChange={(event) => setRepoUrl(event.target.value)}
                    placeholder="https://github.com/example/repo.git"
                  />
                </FormField>
                <FormField label="Branch">
                  <Input value={branch} onChange={(event) => setBranch(event.target.value)} placeholder="main" />
                </FormField>
                <Button
                  variant="secondary"
                  onClick={() => importMutation.mutate()}
                  disabled={importMutation.isPending || !repoUrl.trim() || !normalizedTargetProtocol}
                >
                  <GitBranch className="size-4" />
                  开始导入
                </Button>
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        {moreOpen ? (
          <DialogContent className="w-[min(92vw,30rem)] space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">More</p>
              <h2 className="mt-2 text-lg font-semibold text-foreground">协议操作</h2>
              <p className="mt-1 text-sm text-muted-foreground">{normalizedProtocol}</p>
            </div>

            <div className="rounded-[var(--radius-xl)] border border-danger/30 bg-danger/5 p-4">
              <p className="text-sm font-medium text-foreground">删除协议项目</p>
              <p className="mt-1 text-sm text-muted-foreground">
                删除后会清空该协议在当前节点下的资产目录，界面仅保留 workspace 引用语义。
              </p>
              <div className="mt-4">
                <Button
                  variant="danger"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="size-4" />
                  删除协议项目
                </Button>
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}

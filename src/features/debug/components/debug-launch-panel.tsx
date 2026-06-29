import { useState } from "react";
import { Bug, FileCode2, FolderCog, Play, RefreshCw, Upload, Wand2 } from "lucide-react";
import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DebugCandidate } from "@/types/api/debug";
import type { Job } from "@/types/api/jobs";
import type { BuildRun, LaunchProfile, TargetCandidate } from "@/types/api/build-assistant";
import type { DebugLaunchFormState } from "@/features/debug/debug-types";

function SectionTitle({ title, desc }: { title: string; desc: string }): JSX.Element {
  return (
    <div>
      <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
      <p className="mt-1 text-[15px] text-foreground">{desc}</p>
    </div>
  );
}

export interface ReplayScriptOption {
  filename: string;
  workspaceRef: string;
  size?: number | null;
}

export function DebugLaunchPanel({
  protocol,
  protocols,
  jobs,
  selectedJobId,
  onProtocolChange,
  onJobChange,
  candidates,
  selectedCandidatePath,
  onSelectCandidate,
  sourceStatus,
  buildTargets,
  buildRuns,
  launchProfiles,
  replayScripts,
  form,
  onFormChange,
  onSubmit,
  onReloadCandidates,
  onUploadReplayScript,
  onDeleteReplayScript,
  submitting,
  uploadingReplayScript,
}: {
  protocol: string;
  protocols: string[];
  jobs: Job[];
  selectedJobId?: string;
  onProtocolChange: (value: string) => void;
  onJobChange: (value?: string) => void;
  candidates: DebugCandidate[];
  selectedCandidatePath?: string;
  onSelectCandidate: (candidate: DebugCandidate | null) => void;
  sourceStatus?: Record<string, unknown> | null;
  buildTargets: TargetCandidate[];
  buildRuns: BuildRun[];
  launchProfiles: LaunchProfile[];
  replayScripts: ReplayScriptOption[];
  form: DebugLaunchFormState;
  onFormChange: (patch: Partial<DebugLaunchFormState>) => void;
  onSubmit: () => void;
  onReloadCandidates: () => void;
  onUploadReplayScript: (file: File, runtime: string) => void;
  onDeleteReplayScript: (filename: string) => void;
  submitting?: boolean;
  uploadingReplayScript?: boolean;
}): JSX.Element {
  const protocolJobs = jobs.filter((job) => !protocol || job.protocol === protocol);
  const selectedCandidate = candidates.find((item) => (item.seed_path || item.path || "") === selectedCandidatePath) ?? null;
  const [pendingReplayFile, setPendingReplayFile] = useState<File | null>(null);

  return (
    <div className="grid gap-4 xl:grid-cols-[24rem_minmax(0,1fr)]">
      <div className="grid gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <SectionTitle title="调试入口" desc="配置协议、候选样本和目标运行环境。" />
            <Button type="button" size="sm" variant="outline" onClick={onReloadCandidates} className="rounded-lg">
              <RefreshCw className="h-3.5 w-3.5" />
              刷新
            </Button>
          </div>

          <div className="grid gap-4">
            <FormField label="协议">
              <Select value={protocol || "__empty__"} onValueChange={(value) => onProtocolChange(value === "__empty__" ? "" : value)}>
                <SelectTrigger><SelectValue placeholder="选择协议" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__empty__">未选择</SelectItem>
                  {protocols.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="任务">
              <Select value={selectedJobId || "__all__"} onValueChange={(value) => onJobChange(value === "__all__" ? undefined : value)}>
                <SelectTrigger><SelectValue placeholder="全部任务" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部任务</SelectItem>
                  {protocolJobs.map((job) => (
                    <SelectItem key={job.job_id} value={job.job_id}>
                      {job.job_id} · {job.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">崩溃候选样本</p>
              <div className="space-y-2">
                {candidates.length ? candidates.slice(0, 14).map((candidate) => {
                  const key = candidate.seed_path || candidate.path || candidate.artifact_id || candidate.name || Math.random().toString();
                  const active = selectedCandidatePath === (candidate.seed_path || candidate.path || "");
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onSelectCandidate(candidate)}
                      className={active
                        ? "w-full rounded-xl border border-primary/35 bg-primary/10 px-3 py-3 text-left"
                        : "w-full rounded-xl border border-border bg-background px-3 py-3 text-left hover:bg-muted/45"}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{candidate.artifact_id || candidate.name || "候选样本"}</p>
                          <p className="mt-1 break-all text-xs text-muted-foreground">{candidate.seed_path || candidate.path || "暂无"}</p>
                        </div>
                        <Badge variant={active ? "default" : "outline"} className="rounded-md">{candidate.kind || "crash"}</Badge>
                      </div>
                    </button>
                  );
                }) : (
                  <div className="rounded-xl border border-dashed border-border bg-background px-4 py-8 text-sm text-muted-foreground">
                    暂无候选样本。请选择任务，或手动填写 `artifact_path`。
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-4">
            <SectionTitle title="入口状态" desc="保持和当前控制台一致的紧凑卡片样式。" />
          </div>
          <div className="grid gap-2">
            <div className="rounded-lg border border-border bg-background px-3 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-primary">
                  <FolderCog className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">源码状态</p>
                  <p className="text-xs text-muted-foreground">{String(sourceStatus?.source_ref || sourceStatus?.root || "等待选择协议")}</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background px-3 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-warning">
                  <Bug className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">构建 / 目标</p>
                  <p className="text-xs text-muted-foreground">{buildRuns.length} 次构建 · {buildTargets.length} 个目标</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background px-3 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-success">
                  <Wand2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">启动配置</p>
                  <p className="text-xs text-muted-foreground">{launchProfiles.length} 个可用配置</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background px-3 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-primary">
                  <Upload className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">回放脚本</p>
                  <p className="text-xs text-muted-foreground">{replayScripts.length} 个可复用脚本</p>
                </div>
              </div>
            </div>
            {selectedCandidate ? (
              <div className="rounded-lg border border-primary/25 bg-primary/8 px-3 py-3 text-xs leading-6 text-foreground">
                当前已选择候选样本：{selectedCandidate.artifact_id || selectedCandidate.name || "候选样本"}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <SectionTitle title="调试表单" desc="所有运行参数都在这里填写，回放配置和目标参数分区展示。" />
          <Button type="button" onClick={onSubmit} disabled={submitting} className="rounded-lg">
            <Play className="h-4 w-4" />
            启动调试
          </Button>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <FormField label="artifact_path" description="单个崩溃样本文件路径。目录会被后端拒绝。">
            <Input value={form.artifact_path} onChange={(e) => onFormChange({ artifact_path: e.target.value })} />
          </FormField>
          <FormField label="artifact_id">
            <Input value={form.artifact_id} onChange={(e) => onFormChange({ artifact_id: e.target.value })} />
          </FormField>

          <FormField label="binary_path">
            <Input value={form.binary_path} onChange={(e) => onFormChange({ binary_path: e.target.value })} />
          </FormField>
          <FormField label="cwd">
            <Input value={form.cwd} onChange={(e) => onFormChange({ cwd: e.target.value })} />
          </FormField>

          <FormField label="args">
            <Input value={form.args_text} onChange={(e) => onFormChange({ args_text: e.target.value })} />
          </FormField>
          <FormField label="transport_type">
            <Input value={form.transport_type} onChange={(e) => onFormChange({ transport_type: e.target.value })} />
          </FormField>

          <FormField label="startup_timeout">
            <Input value={form.startup_timeout} onChange={(e) => onFormChange({ startup_timeout: e.target.value })} />
          </FormField>
          <FormField label="kb_entry_ids">
            <Input value={form.kb_entry_ids_text} onChange={(e) => onFormChange({ kb_entry_ids_text: e.target.value })} />
          </FormField>

          <FormField label="env_json" className="xl:col-span-2">
            <Textarea rows={4} value={form.env_json} onChange={(e) => onFormChange({ env_json: e.target.value })} />
          </FormField>
          <FormField label="transport_config_json" className="xl:col-span-2">
            <Textarea rows={4} value={form.transport_config_json} onChange={(e) => onFormChange({ transport_config_json: e.target.value })} />
          </FormField>
          <FormField label="ready_check_json" className="xl:col-span-2">
            <Textarea rows={4} value={form.ready_check_json} onChange={(e) => onFormChange({ ready_check_json: e.target.value })} />
          </FormField>
          <FormField label="source_doc_ids" className="xl:col-span-2">
            <Textarea rows={2} value={form.source_doc_ids_text} onChange={(e) => onFormChange({ source_doc_ids_text: e.target.value })} />
          </FormField>
        </div>

        <div className="mt-4 rounded-xl border border-border/60 bg-background/55 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <SectionTitle title="回放配置" desc="builtin_transport 继续使用当前 transport 字段；script 模式会在服务就绪后执行样本回放。" />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <FormField label="replay_mode">
              <Select value={form.replay_mode} onValueChange={(value) => onFormChange({ replay_mode: value as DebugLaunchFormState["replay_mode"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="builtin_transport">builtin_transport</SelectItem>
                  <SelectItem value="script">script</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="replay_timeout">
              <Input value={form.replay_timeout} onChange={(e) => onFormChange({ replay_timeout: e.target.value })} />
            </FormField>

            {form.replay_mode === "script" ? (
              <>
                <FormField label="replay_runtime">
                  <Select value={form.replay_runtime} onValueChange={(value) => onFormChange({ replay_runtime: value as DebugLaunchFormState["replay_runtime"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="python3">python3</SelectItem>
                      <SelectItem value="bash">bash</SelectItem>
                      <SelectItem value="native">native</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="replay_script_ref">
                  <Select value={form.replay_script_ref || "__none__"} onValueChange={(value) => onFormChange({ replay_script_ref: value === "__none__" ? "" : value })}>
                    <SelectTrigger><SelectValue placeholder="选择脚本" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">未选择</SelectItem>
                      {replayScripts.map((item) => <SelectItem key={item.workspaceRef} value={item.workspaceRef}>{item.filename}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="replay_args_text">
                  <Input value={form.replay_args_text} onChange={(e) => onFormChange({ replay_args_text: e.target.value })} placeholder="--host 127.0.0.1 --port 1024" />
                </FormField>
                <FormField label="上传回放脚本">
                  <div className="space-y-2">
                    <Input type="file" onChange={(event) => setPendingReplayFile(event.target.files?.[0] ?? null)} />
                    <div className="flex gap-2">
                      <Button type="button" variant="secondary" disabled={!pendingReplayFile || uploadingReplayScript} onClick={() => { if (pendingReplayFile) onUploadReplayScript(pendingReplayFile, form.replay_runtime); }}>
                        <Upload className="h-4 w-4" />
                        {uploadingReplayScript ? "上传中..." : "上传"}
                      </Button>
                      {form.replay_script_ref ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => onDeleteReplayScript((replayScripts.find((item) => item.workspaceRef === form.replay_script_ref)?.filename) || "")}
                        >
                          删除脚本
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </FormField>
                <FormField label="replay_env_json" className="xl:col-span-2">
                  <Textarea rows={4} value={form.replay_env_json} onChange={(e) => onFormChange({ replay_env_json: e.target.value })} />
                </FormField>
                <FormField label="prep_steps_text" className="xl:col-span-2" description="每行一条命令，或每行一个 JSON 对象。">
                  <Textarea rows={5} value={form.prep_steps_text} onChange={(e) => onFormChange({ prep_steps_text: e.target.value })} placeholder={'python3 -c "print(\'prep ok\')"\n{"argv":["bash","hook.sh"],"cwd":"/tmp/demo"}'} />
                </FormField>
              </>
            ) : (
              <div className="xl:col-span-2 rounded-lg border border-border bg-background px-3 py-3 text-sm text-muted-foreground">
                builtin_transport 会继续使用 transport_type 和 transport_config 进行回放。
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-background px-3 py-3 text-[12px] text-muted-foreground">
            <div className="mb-1 flex items-center gap-2 font-semibold uppercase tracking-[0.16em]"><FileCode2 className="h-3.5 w-3.5" />目标二进制</div>
            <div className="break-all text-foreground">{form.binary_path || "暂无"}</div>
          </div>
          <div className="rounded-lg border border-border bg-background px-3 py-3 text-[12px] text-muted-foreground">
            <div className="mb-1 flex items-center gap-2 font-semibold uppercase tracking-[0.16em]"><Bug className="h-3.5 w-3.5" />样本路径</div>
            <div className="break-all text-foreground">{form.artifact_path || "暂无"}</div>
          </div>
          <div className="rounded-lg border border-border bg-background px-3 py-3 text-[12px] text-muted-foreground">
            <div className="mb-1 flex items-center gap-2 font-semibold uppercase tracking-[0.16em]"><FolderCog className="h-3.5 w-3.5" />工作目录</div>
            <div className="break-all text-foreground">{form.cwd || "暂无"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

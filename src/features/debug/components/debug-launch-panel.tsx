import { Bug, FileCode2, FolderCog, Play, RefreshCw, Wand2 } from "lucide-react";
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
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
      <p className="mt-1 text-sm text-foreground">{desc}</p>
    </div>
  );
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
  form,
  onFormChange,
  onSubmit,
  onReloadCandidates,
  submitting,
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
  form: DebugLaunchFormState;
  onFormChange: (patch: Partial<DebugLaunchFormState>) => void;
  onSubmit: () => void;
  onReloadCandidates: () => void;
  submitting?: boolean;
}): JSX.Element {
  const protocolJobs = jobs.filter((job) => !protocol || job.protocol === protocol);
  const selectedCandidate = candidates.find((item) => (item.seed_path || item.path || "") === selectedCandidatePath) ?? null;

  return (
    <div className="grid gap-4 xl:grid-cols-[24rem_minmax(0,1fr)]">
      <div className="grid gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <SectionTitle title="启动入口" desc="先锁定协议与 crash 候选，再对右侧表单做最小修正。" />
            <Button type="button" size="sm" variant="outline" onClick={onReloadCandidates} className="rounded-lg">
              <RefreshCw className="h-3.5 w-3.5" />
              刷新候选
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

            <FormField label="关联任务">
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
              <p className="text-sm font-medium text-foreground">Crash 候选</p>
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
                          <p className="truncate text-sm font-semibold text-foreground">{candidate.artifact_id || candidate.name || "candidate"}</p>
                          <p className="mt-1 break-all text-xs text-muted-foreground">{candidate.seed_path || candidate.path || "—"}</p>
                        </div>
                        <Badge variant={active ? "default" : "outline"} className="rounded-md">{candidate.kind || "crash"}</Badge>
                      </div>
                    </button>
                  );
                }) : (
                  <div className="rounded-xl border border-dashed border-border bg-background px-4 py-8 text-sm text-muted-foreground">
                    当前没有可用候选。可先选择任务再刷新，或手动填写右侧 artifact_path。
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-4">
            <SectionTitle title="协议准备状态" desc="保持列表式状态板，不再用松散彩色大卡片。" />
          </div>
          <div className="grid gap-2">
            <div className="rounded-lg border border-border bg-background px-3 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-primary">
                  <FolderCog className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">源码状态</p>
                  <p className="text-xs text-muted-foreground">{String(sourceStatus?.source_ref || sourceStatus?.root || "等待协议")}</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background px-3 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-warning">
                  <Bug className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Build / Targets</p>
                  <p className="text-xs text-muted-foreground">{buildRuns.length} build runs · {buildTargets.length} targets</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background px-3 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-success">
                  <Wand2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Launch Profiles</p>
                  <p className="text-xs text-muted-foreground">{launchProfiles.length} 条服务端推断配置</p>
                </div>
              </div>
            </div>
            {selectedCandidate ? (
              <div className="rounded-lg border border-primary/25 bg-primary/8 px-3 py-3 text-xs leading-6 text-foreground">
                已选 candidate：{selectedCandidate.artifact_id || selectedCandidate.name || "candidate"}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <SectionTitle title="启动表单" desc="保留工程参数视图，但改成更像 IDE 的矩形工作区。" />
          <Button type="button" onClick={onSubmit} disabled={submitting} className="rounded-lg">
            <Play className="h-4 w-4" />
            发起调试
          </Button>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <FormField label="artifact_path" description="必须是单个 crash 文件路径，不可指向目录。">
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

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-background px-3 py-3 text-[12px] text-muted-foreground">
            <div className="mb-1 flex items-center gap-2 font-semibold uppercase tracking-[0.16em]"><FileCode2 className="h-3.5 w-3.5" />Target Binary</div>
            <div className="break-all text-foreground">{form.binary_path || "未填写"}</div>
          </div>
          <div className="rounded-lg border border-border bg-background px-3 py-3 text-[12px] text-muted-foreground">
            <div className="mb-1 flex items-center gap-2 font-semibold uppercase tracking-[0.16em]"><Bug className="h-3.5 w-3.5" />Artifact</div>
            <div className="break-all text-foreground">{form.artifact_path || "未填写"}</div>
          </div>
          <div className="rounded-lg border border-border bg-background px-3 py-3 text-[12px] text-muted-foreground">
            <div className="mb-1 flex items-center gap-2 font-semibold uppercase tracking-[0.16em]"><FolderCog className="h-3.5 w-3.5" />Workspace</div>
            <div className="break-all text-foreground">{form.cwd || "未填写"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

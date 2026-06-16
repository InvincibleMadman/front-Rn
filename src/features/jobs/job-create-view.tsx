import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, FolderSymlink, Play, Settings2, Wrench } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { jobsApi } from "@/lib/api/services/jobs";
import { buildAssistantApi } from "@/lib/api/services/build-assistant";
import { parseCommandInput, parseJsonObject } from "@/lib/utils/format";
import { selectWorkspaceReferences, useWorkspaceStore } from "@/stores/workspace-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/common/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiErrorAlert } from "@/components/common/api-error-alert";
import type { JobCreateRequest } from "@/types/api/jobs";
import type { LaunchProfile, TargetCandidate } from "@/types/api/build-assistant";

const aflBinaryOptions = [
  { value: "afl-fuzz", label: "afl-fuzz", note: "当前 Runner 命令模板原生适配该模式" },
  { value: "afl-showmap", label: "afl-showmap", note: "高级工具模式，实际可用性取决于后端与宿主机命令兼容性" },
  { value: "afl-cmin", label: "afl-cmin", note: "高级工具模式，参数语义可能与标准创建流程不一致" },
  { value: "afl-tmin", label: "afl-tmin", note: "高级工具模式，适用于最小化样本，不保证可直接启动任务" },
  { value: "afl-analyze", label: "afl-analyze", note: "高级工具模式，更多用于分析输入结构" },
] as const;

const transportOptions = [
  { value: "stdin", label: "stdin" },
  { value: "file", label: "file" },
  { value: "udp", label: "udp" },
  { value: "tcp", label: "tcp" },
  { value: "custom", label: "custom" },
] as const;

const schedulerOptions = [
  { value: "auto", label: "自动 / 未指定" },
  { value: "fast", label: "fast" },
  { value: "explore", label: "explore" },
  { value: "coe", label: "coe" },
  { value: "lin", label: "lin" },
  { value: "quad", label: "quad" },
  { value: "rare", label: "rare" },
] as const;

const formSchema = z.object({
  protocol: z.string().default(""),
  cwd: z.string().min(1, "必填"),
  target_cmd_mode: z.enum(["split", "manual"]).default("split"),
  target_binary: z.string().min(1, "必填"),
  target_args_text: z.string().default(""),
  target_cmd_manual: z.string().default(""),
  afl_path: z.string().default("afl-fuzz"),
  tool_mode: z.enum(["standard", "advanced"]).default("standard"),
  input_dir: z.string().min(1, "必填"),
  output_dir: z.string().min(1, "必填"),
  timeout_sec: z.coerce.number().int().positive().default(3600),
  workers: z.coerce.number().int().positive().default(1),
  transport_type: z.string().default("stdin"),
  transport_config_json: z.string().default("{}"),
  env_json: z.string().default("{}"),
  fuzzer_args_text: z.string().default(""),
  source_dir: z.string().default(""),
  build_dir: z.string().default(""),
  scheduler: z.string().default("auto"),
  node_name: z.string().default(""),
  operation_id: z.string().default(""),
  risk_enabled: z.boolean().default(false),
  dry_run: z.boolean().default(false),
  notes: z.string().default(""),
  launch_profile_id: z.string().default(""),
});

type JobCreateFormValues = z.infer<typeof formSchema>;

function optionalText(value: string): string | undefined {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function toStringRecord(value: string): Record<string, string> {
  return Object.fromEntries(
    Object.entries(parseJsonObject(value)).map(([key, item]) => [key, String(item)]),
  );
}

function selectAflNote(aflPath: string): string {
  return aflBinaryOptions.find((item) => item.value === aflPath)?.note ?? "取决于后端支持";
}

function buildStructuredTargetCmd(values: Pick<JobCreateFormValues, "target_binary" | "target_args_text">): string[] {
  const binary = values.target_binary.trim();
  const targetArgs = parseCommandInput(values.target_args_text);
  return [binary, ...targetArgs].filter(Boolean);
}

function parseManualTargetCmd(input: string): string[] {
  const text = input.trim();
  if (!text) {
    throw new Error("请填写 target_cmd 参数组");
  }

  if (text.startsWith("[")) {
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error("手动 target_cmd 模式要求输入 JSON 数组或每行一个参数");
    }

    const items = parsed.map((item) => String(item).trim()).filter(Boolean);
    if (!items.length) {
      throw new Error("target_cmd 数组不能为空");
    }
    return items;
  }

  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    throw new Error("target_cmd 参数组不能为空");
  }

  return lines;
}

function serializeTargetCmd(cmd: string[]): string {
  return cmd.join("\n");
}

export function JobCreateView(): JSX.Element {
  const navigate = useNavigate();
  const references = useWorkspaceStore((state) => state.references);
  const seedRefs = useMemo(() => selectWorkspaceReferences(references, "seeds"), [references]);
  const instrumentRefs = useMemo(() => selectWorkspaceReferences(references, "instrument"), [references]);
  const protocolRefs = useMemo(() => selectWorkspaceReferences(references, "protocol"), [references]);
  const riskRefs = useMemo(
    () => references.filter((item) => ["risk-analysis", "risk-preview", "risk-upload"].includes(item.type)),
    [references],
  );
  const [formError, setFormError] = useState<unknown>();

  const form = useForm<JobCreateFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      protocol: "",
      cwd: "",
      target_cmd_mode: "split",
      target_binary: "",
      target_args_text: "",
      target_cmd_manual: "",
      afl_path: "afl-fuzz",
      tool_mode: "standard",
      input_dir: "",
      output_dir: "",
      timeout_sec: 3600,
      workers: 1,
      transport_type: "stdin",
      transport_config_json: "{}",
      env_json: "{}",
      fuzzer_args_text: "",
      source_dir: "",
      build_dir: "",
      scheduler: "auto",
      node_name: "",
      operation_id: "",
      risk_enabled: false,
      dry_run: false,
      notes: "",
      launch_profile_id: "",
    },
  });

  const createJobMutation = useMutation({
    mutationFn: jobsApi.createJob,
    onSuccess: (job) => navigate(`/jobs/${job.job_id}`),
    onError: setFormError,
  });

  const selectedAfl = form.watch("afl_path");
  const toolMode = form.watch("tool_mode");
  const targetCmdMode = form.watch("target_cmd_mode");
  const selectedProtocol = form.watch("protocol").trim();
  const selectedLaunchProfileId = form.watch("launch_profile_id");

  const launchProfilesQuery = useQuery({
    queryKey: ["launch-profiles", selectedProtocol],
    queryFn: () => buildAssistantApi.listLaunchProfiles(selectedProtocol),
    enabled: Boolean(selectedProtocol),
  });
  const buildTargetsQuery = useQuery({
    queryKey: ["build-targets", selectedProtocol],
    queryFn: () => buildAssistantApi.listTargets(selectedProtocol),
    enabled: Boolean(selectedProtocol),
  });

  const selectedLaunchProfile = useMemo<LaunchProfile | null>(
    () => launchProfilesQuery.data?.find((item) => item.profile_id === selectedLaunchProfileId) ?? null,
    [launchProfilesQuery.data, selectedLaunchProfileId],
  );

  const applyLaunchProfile = (profile: LaunchProfile): void => {
    form.setValue("launch_profile_id", profile.profile_id, { shouldDirty: true });
    form.setValue("protocol", profile.protocol, { shouldDirty: true });
    form.setValue("cwd", profile.cwd_ref ?? "", { shouldDirty: true });
    form.setValue("input_dir", profile.input_ref ?? "", { shouldDirty: true });
    form.setValue("output_dir", profile.output_ref ?? "", { shouldDirty: true });
    form.setValue("target_binary", profile.binary_ref, { shouldDirty: true });
    form.setValue("target_args_text", profile.target_cmd.slice(1).join(" "), { shouldDirty: true });
    form.setValue("target_cmd_manual", serializeTargetCmd(profile.target_cmd), { shouldDirty: true });
    form.setValue("fuzzer_args_text", profile.afl_args.join(" "), { shouldDirty: true });
    form.setValue("env_json", JSON.stringify(profile.env ?? {}, null, 2), { shouldDirty: true });
  };

  const submit = (values: JobCreateFormValues): void => {
    setFormError(undefined);

    try {
      const targetCmd =
        values.target_cmd_mode === "manual"
          ? parseManualTargetCmd(values.target_cmd_manual)
          : buildStructuredTargetCmd(values);
      const targetArgs = targetCmd.slice(1);
      const fuzzerArgs = parseCommandInput(values.fuzzer_args_text);
      const transportConfig = parseJsonObject(values.transport_config_json);
      const env = toStringRecord(values.env_json);
      const scheduler = values.scheduler === "auto" ? undefined : values.scheduler;
      const operationId = optionalText(values.operation_id);
      const selectedBinary = values.tool_mode === "standard" ? "afl-fuzz" : values.afl_path;

      const formalExecution = !values.dry_run;
      const payload: JobCreateRequest = {
        protocol: optionalText(values.protocol) ?? "legacy-default",
        ...(values.cwd.trim().startsWith("workspace://") ? { cwd_ref: values.cwd.trim() } : { cwd: values.cwd.trim() }),
        ...(!formalExecution ? { target_cmd: targetCmd } : {}),
        ...(!formalExecution ? { afl_path: selectedBinary } : {}),
        ...(values.input_dir.trim().startsWith("workspace://") ? { input_dir_ref: values.input_dir.trim() } : { input_dir: values.input_dir.trim() }),
        ...(values.output_dir.trim().startsWith("workspace://") ? { output_dir_ref: values.output_dir.trim() } : { output_dir: values.output_dir.trim() }),
        ...(formalExecution ? { launch_profile_id: optionalText(values.launch_profile_id) } : {}),
        timeout_sec: values.timeout_sec,
        dry_run: values.dry_run,
        debug: {
          transport_type: values.transport_type,
          transport_config: transportConfig,
        },
        ...(operationId ? { operation_id: operationId } : {}),
        ...(scheduler ? { scheduler } : {}),
        ...(optionalText(values.node_name) ? { node_name: optionalText(values.node_name) } : {}),
        ...(values.risk_enabled ? { risk_enabled: true } : {}),
        ...(values.workers > 0 ? { workers: values.workers } : {}),
        ...(Object.keys(env).length > 0 ? { env } : {}),
        ...(!formalExecution && targetArgs.length > 0 ? { target_args: targetArgs } : {}),
        ...(!formalExecution && fuzzerArgs.length > 0 ? { fuzzer_args: fuzzerArgs } : {}),
        ...(optionalText(values.source_dir) ? { source_dir: optionalText(values.source_dir) } : {}),
        ...(optionalText(values.build_dir) ? { build_dir: optionalText(values.build_dir) } : {}),
        afl: {
          afl_binary: selectedBinary,
          target_binary: targetCmd[0] ?? "",
          target_args: targetArgs,
          fuzzer_args: fuzzerArgs,
          env,
          workers: values.workers,
          input_dir: values.input_dir.trim(),
          output_dir: values.output_dir.trim(),
          run_cwd: values.cwd.trim(),
          source_dir: optionalText(values.source_dir) ?? null,
          build_dir: optionalText(values.build_dir) ?? null,
        },
        metadata: {
          tool_mode: values.tool_mode,
          scheduler: scheduler ?? null,
          node_name: optionalText(values.node_name) ?? null,
          risk_enabled: values.risk_enabled,
          notes: optionalText(values.notes) ?? null,
          runner_notice:
            selectedBinary === "afl-fuzz"
              ? "当前 Runner 原生使用 afl-fuzz 风格命令。"
              : "当前 Runner 仍按 afl-fuzz 风格组装命令，其他 AFL 工具能否直接运行取决于后端与宿主机支持。",
        },
      };

      createJobMutation.mutate(payload);
    } catch (error) {
      setFormError(error);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="任务创建"
        title="创建 Fuzz 任务"
        description="补齐页面侧可配置输入项，但保持 API service 与请求组装边界不变。当前 Runner 已明确消费基础字段与 debug.transport_*，高级扩展字段会随请求附带，是否生效取决于后端支持。"
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.9fr)]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>高密度任务表单</CardTitle>
            <CardDescription>路径必须是后端主机可访问路径，不是浏览器本机路径。标准模式固定走 `afl-fuzz`，非 `afl-fuzz` 进入高级工具模式。</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={form.handleSubmit(submit)}>
              <div className="grid gap-3 rounded-[var(--radius-xl)] border border-border/60 bg-background/50 p-4 md:grid-cols-2">
                <div className="md:col-span-2 rounded-[var(--radius-lg)] border border-[hsl(var(--accent-blue)/0.16)] bg-[hsl(var(--accent-blue-light)/0.66)] px-4 py-3 text-sm text-[hsl(var(--accent-blue))] dark:bg-[hsl(var(--accent-blue-light)/0.2)]">
                  正式执行时只提交 `launch_profile_id`，后端会重新读取并校验 LaunchProfile。当前表单中的命令、参数和环境变量在 `dry_run=true` 时作为草案预览与校验使用。
                </div>

                <div className="md:col-span-2 rounded-[var(--radius-lg)] border border-border/60 bg-background/60 p-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <FormField label="launch_profile_id" description="正式执行必选；可一键回填下方草案预览字段。">
                      <Select
                        value={selectedLaunchProfileId}
                        onValueChange={(value) => {
                          form.setValue("launch_profile_id", value, { shouldDirty: true });
                          const profile = launchProfilesQuery.data?.find((item) => item.profile_id === value);
                          if (profile) applyLaunchProfile(profile);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择 LaunchProfile" />
                        </SelectTrigger>
                        <SelectContent>
                          {(launchProfilesQuery.data ?? []).map((item) => (
                            <SelectItem key={item.profile_id} value={item.profile_id}>
                              {item.profile_id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormField>
                    <div className="rounded-[var(--radius-lg)] border border-border/60 bg-background/50 p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Build targets</p>
                      <div className="mt-2 space-y-2">
                        {(buildTargetsQuery.data ?? []).slice(0, 3).map((item: TargetCandidate) => (
                          <div key={item.target_id} className="rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                            <p className="text-sm font-medium">{item.name}</p>
                            <p className="mt-1 break-all text-xs text-muted-foreground">{item.binary_ref}</p>
                          </div>
                        ))}
                        {(buildTargetsQuery.data ?? []).length === 0 ? <p className="text-xs text-muted-foreground">当前协议暂无 BuildRun targets。</p> : null}
                      </div>
                    </div>
                  </div>
                  {selectedLaunchProfile ? (
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-[var(--radius-lg)] border border-border/60 bg-background/50 p-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">cwd / input</p>
                        <p className="mt-2 break-all text-xs text-muted-foreground">{selectedLaunchProfile.cwd_ref ?? "-"}</p>
                        <p className="mt-1 break-all text-xs text-muted-foreground">{selectedLaunchProfile.input_ref ?? "-"}</p>
                      </div>
                      <div className="rounded-[var(--radius-lg)] border border-border/60 bg-background/50 p-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">target preview</p>
                        <p className="mt-2 break-all text-xs text-muted-foreground">{selectedLaunchProfile.target_cmd.join(" ")}</p>
                      </div>
                      <div className="rounded-[var(--radius-lg)] border border-border/60 bg-background/50 p-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">afl/env preview</p>
                        <p className="mt-2 break-all text-xs text-muted-foreground">{selectedLaunchProfile.afl_args.join(" ")}</p>
                        <p className="mt-2 break-all text-xs text-muted-foreground">{Object.entries(selectedLaunchProfile.env ?? {}).map(([key, value]) => `${key}=${value}`).join(" ") || "-"}</p>
                      </div>
                    </div>
                  ) : null}
                </div>

                <FormField label="protocol" description="可手动填写，也可从右侧工作区引用回填。">
                  <Input {...form.register("protocol")} placeholder="modbus / bacnet / s7comm ..." />
                </FormField>

                <FormField label="operation_id" description="会被后端操作日志体系消费，用于串联创建任务过程。">
                  <Input {...form.register("operation_id")} placeholder="op-job-20260531-001" />
                </FormField>

                <div className="md:col-span-2">
                  <FormField label="cwd" description="Runner 启动 AFL 进程时使用的工作目录。">
                    <Input {...form.register("cwd")} placeholder="/opt/fuzz/workdir" />
                  </FormField>
                </div>

                <div className="md:col-span-2 rounded-[var(--radius-lg)] border border-border/60 bg-background/60 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className={targetCmdMode === "split" ? "rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground" : "rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground"}
                      onClick={() => {
                        const nextCmd = buildStructuredTargetCmd(form.getValues());
                        form.setValue("target_cmd_manual", serializeTargetCmd(nextCmd), { shouldDirty: true });
                        form.setValue("target_cmd_mode", "split", { shouldDirty: true });
                      }}
                    >
                      结构化输入
                    </button>
                    <button
                      type="button"
                      className={targetCmdMode === "manual" ? "rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground" : "rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground"}
                      onClick={() => {
                        const current = form.getValues("target_cmd_manual").trim();
                        if (!current) {
                          const nextCmd = buildStructuredTargetCmd(form.getValues());
                          form.setValue("target_cmd_manual", serializeTargetCmd(nextCmd), { shouldDirty: true });
                        }
                        form.setValue("target_cmd_mode", "manual", { shouldDirty: true });
                      }}
                    >
                      手动 argv 组
                    </button>
                    <span className="text-xs text-muted-foreground">
                      手动模式直接构造后端 `target_cmd: string[]`
                    </span>
                  </div>

                  {targetCmdMode === "split" ? (
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <FormField label="被测程序 / target_cmd[0]" description="这里不是 AFL 主程序；AFL 主程序由上方 `AFL binary` 控制。">
                        <Input {...form.register("target_binary")} placeholder="/opt/bin/target" />
                      </FormField>

                      <FormField label="附加参数组" description="按空格分词，文件输入模式可显式使用 `@@` 占位。">
                        <Textarea
                          className="min-h-[5.5rem] resize-y"
                          {...form.register("target_args_text")}
                          placeholder="@@ --mode fast --port 502"
                        />
                      </FormField>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <FormField label="target_cmd 手动参数组" description="支持两种格式：1. 每行一个 argv token；2. 直接填写 JSON 数组。可拖动右下角增高。">
                        <Textarea
                          className="min-h-[9rem] resize-y font-mono text-xs"
                          {...form.register("target_cmd_manual")}
                          placeholder={"/opt/bin/target\n@@\n--mode\nfast\n--port\n502"}
                        />
                      </FormField>
                    </div>
                  )}
                </div>

                <FormField label="AFL binary" description={selectAflNote(selectedAfl)}>
                  <Select
                    value={selectedAfl}
                    onValueChange={(value) => {
                      form.setValue("afl_path", value, { shouldDirty: true });
                      if (value !== "afl-fuzz") {
                        form.setValue("tool_mode", "advanced", { shouldDirty: true });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择 AFL 工具" />
                    </SelectTrigger>
                    <SelectContent>
                      {aflBinaryOptions.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField label="tool_mode" description="切回标准模式时会强制使用 `afl-fuzz`。">
                  <Select
                    value={toolMode}
                    onValueChange={(value) => {
                      form.setValue("tool_mode", value as "standard" | "advanced", { shouldDirty: true });
                      if (value === "standard") {
                        form.setValue("afl_path", "afl-fuzz", { shouldDirty: true });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择模式" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">标准任务模式</SelectItem>
                      <SelectItem value="advanced">高级工具模式</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField label="input_dir">
                  <Input {...form.register("input_dir")} placeholder="/opt/fuzz/in" />
                </FormField>

                <FormField label="output_dir">
                  <Input {...form.register("output_dir")} placeholder="/opt/fuzz/out" />
                </FormField>

                <FormField label="timeout_sec">
                  <Input type="number" {...form.register("timeout_sec")} />
                </FormField>

                <FormField label="workers" description="当前后端 Runner 未直接消费该字段，但会随请求一并发送。">
                  <Input type="number" {...form.register("workers")} />
                </FormField>

                <div className="flex min-w-0 items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-border/60 bg-background/60 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">dry_run</p>
                    <p className="text-xs text-muted-foreground">只做路径与二进制校验，不真正启动进程。</p>
                  </div>
                  <Switch checked={form.watch("dry_run")} onCheckedChange={(checked) => form.setValue("dry_run", checked)} />
                </div>

                <div className="flex min-w-0 items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-border/60 bg-background/60 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">risk_enabled</p>
                    <p className="text-xs text-muted-foreground">作为扩展字段与元数据发送，供后端未来扩展读取。</p>
                  </div>
                  <Switch checked={form.watch("risk_enabled")} onCheckedChange={(checked) => form.setValue("risk_enabled", checked)} />
                </div>
              </div>

              {toolMode === "advanced" ? (
                <div className="rounded-[var(--radius-xl)] border border-[hsl(var(--accent-orange)/0.2)] bg-[hsl(var(--accent-orange-light)/0.48)] px-4 py-3 text-sm text-[hsl(var(--accent-orange))] dark:bg-[hsl(var(--accent-orange-light)/0.18)]">
                  高级工具模式已启用。当前 Runner 仍以 `afl-fuzz -i -o -- target_cmd` 的方式拼接命令，`afl-showmap / afl-cmin / afl-tmin / afl-analyze` 是否能直接运行，取决于后端是否扩展了命令模板以及宿主机实际安装方式。
                </div>
              ) : null}

              <details className="rounded-[var(--radius-xl)] border border-border/60 bg-background/50 p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Wrench className="size-4 text-[hsl(var(--accent-orange))]" />
                    <span className="text-sm font-semibold">高级工具模式与 AFL 扩展字段</span>
                  </div>
                  <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs text-muted-foreground">
                    展开
                  </span>
                </summary>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <FormField label="scheduler">
                    <Select value={form.watch("scheduler")} onValueChange={(value) => form.setValue("scheduler", value, { shouldDirty: true })}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择调度策略" />
                      </SelectTrigger>
                      <SelectContent>
                        {schedulerOptions.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>

                  <FormField label="node_name" description="用于页面侧标记节点来源，不要求后端当前必须消费。">
                    <Input {...form.register("node_name")} placeholder="node-a / lab-02" />
                  </FormField>

                  <FormField label="source_dir" description="扩展字段，适合记录源码路径。">
                    <Input {...form.register("source_dir")} placeholder="/src/project" />
                  </FormField>

                  <FormField label="build_dir" description="扩展字段，适合记录构建产物目录。">
                    <Input {...form.register("build_dir")} placeholder="/src/project/build" />
                  </FormField>

                  <div className="md:col-span-2">
                    <FormField label="fuzzer_args" description="按空格分词，作为附加字段附加到请求。">
                      <Input {...form.register("fuzzer_args_text")} placeholder="-m none -t 1000+ -M master" />
                    </FormField>
                  </div>

                  <div className="md:col-span-2">
                    <FormField label="env_json" description="必须是 JSON 对象，将被转成字符串字典发送。">
                      <Textarea className="min-h-[7rem] font-mono text-xs" {...form.register("env_json")} />
                    </FormField>
                  </div>
                </div>
              </details>

              <details className="rounded-[var(--radius-xl)] border border-border/60 bg-background/50 p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Settings2 className="size-4 text-[hsl(var(--accent-pink))]" />
                    <span className="text-sm font-semibold">Debug / Transport 参数</span>
                  </div>
                  <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs text-muted-foreground">
                    展开
                  </span>
                </summary>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <FormField label="transport_type" description="当前后端会直接读取该字段。">
                    <Select
                      value={form.watch("transport_type")}
                      onValueChange={(value) => form.setValue("transport_type", value, { shouldDirty: true })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择 transport" />
                      </SelectTrigger>
                      <SelectContent>
                        {transportOptions.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>

                  <div className="md:col-span-2">
                    <FormField label="transport_config_json" description="必须是 JSON 对象，将进入 `debug.transport_config`。">
                      <Textarea className="min-h-[7rem] font-mono text-xs" {...form.register("transport_config_json")} />
                    </FormField>
                  </div>

                  <div className="md:col-span-2">
                    <FormField label="notes" description="仅写入元数据，便于后续页面做本地说明和筛选。">
                      <Textarea className="min-h-[6rem]" {...form.register("notes")} placeholder="记录测试目的、节点上下文或运行注意事项" />
                    </FormField>
                  </div>
                </div>
              </details>

              {formError ? <ApiErrorAlert error={formError} title="创建任务失败" /> : null}

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={createJobMutation.isPending}>
                  <Play className="size-4" />
                  {createJobMutation.isPending ? "创建中..." : "创建并启动任务"}
                </Button>
                <span className="text-sm text-muted-foreground">
                  标准模式下提交的实际 AFL binary 为 `afl-fuzz`；高级工具模式保持你选择的 AFL binary 原样透传。
                </span>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>最近引用 · 种子结果</CardTitle>
              <CardDescription>一键回填 `input_dir`，避免手动抄写路径。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {seedRefs.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无种子结果引用。</p>
              ) : (
                seedRefs.slice(0, 6).map((ref) => (
                  <button
                    key={ref.id}
                    type="button"
                    className="w-full rounded-[var(--radius-lg)] border border-border/60 bg-background/50 p-3 text-left transition-colors hover:bg-muted/30"
                    onClick={() => form.setValue("input_dir", ref.primaryPath ?? "", { shouldDirty: true })}
                  >
                    <p className="text-sm font-medium">{ref.label}</p>
                    <p className="mt-1 break-all text-xs text-muted-foreground">{ref.primaryPath}</p>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>最近引用 · 插桩结果</CardTitle>
              <CardDescription>快速预填 `cwd / source_dir / build_dir`。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {instrumentRefs.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无插桩结果引用。</p>
              ) : (
                instrumentRefs.slice(0, 5).map((ref) => (
                  <div key={ref.id} className="rounded-[var(--radius-lg)] border border-border/60 bg-background/50 p-3">
                    <p className="text-sm font-medium">{ref.label}</p>
                    <p className="mt-1 break-all text-xs text-muted-foreground">{ref.primaryPath}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="secondary" onClick={() => form.setValue("cwd", ref.primaryPath ?? "", { shouldDirty: true })}>
                        填入 cwd
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => form.setValue("source_dir", ref.primaryPath ?? "", { shouldDirty: true })}>
                        填入 source_dir
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => form.setValue("build_dir", ref.primaryPath ?? "", { shouldDirty: true })}>
                        填入 build_dir
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>最近引用 · 协议 / 风险结果</CardTitle>
              <CardDescription>辅助回填 `protocol` 与上下文说明。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {[...protocolRefs, ...riskRefs].slice(0, 8).map((ref) => (
                <div key={ref.id} className="rounded-[var(--radius-lg)] border border-border/60 bg-background/50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{ref.label}</p>
                      <p className="mt-1 break-all text-xs text-muted-foreground">{ref.primaryPath}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const data = ref.data as
                          | { protocol?: string | { protocol?: string; protocol_name?: string }; protocol_name?: string }
                          | undefined;
                        const protocol =
                          typeof data?.protocol === "string"
                            ? data.protocol
                            : data?.protocol?.protocol ?? data?.protocol?.protocol_name ?? data?.protocol_name ?? form.getValues("protocol");

                        form.setValue("protocol", String(protocol), { shouldDirty: true });
                      }}
                    >
                      <FolderSymlink className="size-4" />
                      引用
                    </Button>
                  </div>
                </div>
              ))}
              {protocolRefs.length + riskRefs.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无协议 / 风险结果引用。</p>
              ) : null}
            </CardContent>
          </Card>

          {createJobMutation.data ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>创建成功</CardTitle>
                <CardDescription>任务已创建，正在跳转到详情页。</CardDescription>
              </CardHeader>
              <CardContent>
                <Button type="button" variant="secondary" onClick={() => navigate(`/jobs/${createJobMutation.data?.job_id}`)}>
                  查看任务详情
                  <ArrowRight className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

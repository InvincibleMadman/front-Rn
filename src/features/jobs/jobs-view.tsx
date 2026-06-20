import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Boxes, GitBranchPlus, Hammer, RefreshCw, TerminalSquare, Wand2, Wrench } from "lucide-react";
import { PageHeroBoard } from "@/components/layout/page-hero-board";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ApiErrorReporter } from "@/components/common/api-error-alert";
import { buildAssistantApi } from "@/lib/api/services/build-assistant";
import { jobsApi } from "@/lib/api/services/jobs";
import { protocolsApi } from "@/lib/api/services/protocols";
import { dockLog } from "@/components/layout/dock";
import type { JobCreateRequest, JobsListQuery, Metrics } from "@/types/api/jobs";
import type { BuildPlan, BuildProbe, BuildSuggestion, LaunchProfile, RuntimeToolDefinition, SanitizerModeDefinition, TargetCandidate } from "@/types/api/build-assistant";
import { JobsStatusBoard } from "@/features/jobs/components/jobs-status-board";
import { JobsFlowTabs, type JobsFlowTabKey } from "@/features/jobs/components/jobs-flow-tabs";
import { JobsQueryBar } from "@/features/jobs/components/jobs-query-bar";
import { JobRowList } from "@/features/jobs/components/job-row-list";
import { JobsResultSummaryPanel } from "@/features/jobs/components/jobs-result-summary-panel";
import { JobLaunchPreviewPanel } from "@/features/jobs/components/job-launch-preview-panel";
import { JobsMonitoringOverview } from "@/features/jobs/components/jobs-monitoring-overview";

function parseCommand(input: string): string[] {
  return input
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseKeyValues(text: string): Record<string, string> {
  try {
    if (!text.trim()) return {};
    return JSON.parse(text) as Record<string, string>;
  } catch {
    return {};
  }
}

function joinEnvPreview(env?: Record<string, string>): string {
  const pairs = Object.entries(env ?? {});
  return pairs.length ? pairs.map(([key, value]) => `${key}=${value}`).join(" ") : "";
}

function uniqueBuildSystems(probe?: BuildProbe): string[] {
  const values = new Set<string>();
  if (probe?.preferred_build_system) values.add(probe.preferred_build_system);
  (probe?.build_suggestions ?? []).forEach((item) => values.add(item.build_system));
  return Array.from(values).filter(Boolean);
}

function estimateToolCommand(options: {
  tool?: RuntimeToolDefinition | null;
  targetBinary?: string;
  targetArgs: string[];
  inputDir?: string;
  outputDir?: string;
  singleInput?: string;
  scheduler?: string;
  timeoutSec?: string;
  memoryLimitMb?: string;
  fuzzerArgs: string[];
}): string[] {
  const { tool, targetBinary, targetArgs, inputDir, outputDir, singleInput, scheduler, timeoutSec, memoryLimitMb, fuzzerArgs } = options;
  const toolId = tool?.tool_id ?? "afl-fuzz";
  const targetCmd = [targetBinary || "<target>", ...(targetArgs.length ? targetArgs : ["@@"])];

  if (toolId === "afl-fuzz") {
    const args = ["-i", inputDir || "<input-dir>", "-o", outputDir || "<output-dir>", "-m", memoryLimitMb || "none"];
    if (timeoutSec?.trim()) args.push("-t", timeoutSec.trim());
    if (scheduler && scheduler !== "auto") args.push("-p", scheduler);
    args.push(...fuzzerArgs);
    return [toolId, ...args, "--", ...targetCmd];
  }
  if (toolId === "afl-cmin") {
    return [toolId, "-i", inputDir || "<input-dir>", "-o", outputDir || "<output-dir>", ...fuzzerArgs, "--", ...targetCmd];
  }
  if (toolId === "afl-showmap") {
    return [toolId, "-o", outputDir || "showmap.out", ...fuzzerArgs, "--", ...targetCmd];
  }
  if (toolId === "afl-tmin") {
    return [toolId, "-i", singleInput || "<testcase>", "-o", outputDir || "tmin.out", ...fuzzerArgs, "--", ...targetCmd];
  }
  if (toolId === "afl-analyze") {
    return [toolId, ...fuzzerArgs, singleInput || "<testcase>"];
  }
  return [toolId, ...fuzzerArgs, "--", ...targetCmd];
}

const schedulerOptions = ["auto", "fast", "explore", "linucb", "rare", "mmopt", "seek"];
const transportOptions = ["stdin", "file", "udp", "tcp", "custom"];
const buildTypeOptions = ["RelWithDebInfo", "Debug", "Release", "MinSizeRel"];
const executionModeOptions = [
  { value: "runtime", label: "实时 Fuzz 任务" },
  { value: "aux", label: "AFL 辅助工具" },
  { value: "build", label: "编译 / 构建辅助" },
] as const;

type ExecutionMode = (typeof executionModeOptions)[number]["value"];

export function JobsView(): JSX.Element {
  const [tab, setTab] = useState<JobsFlowTabKey>("compose");
  const [query, setQuery] = useState<JobsListQuery>({ sort: "updated_at", order: "desc" });
  const [selectedMonitorJobId, setSelectedMonitorJobId] = useState<string | undefined>(undefined);
  const [selectedMonitorJobHistory, setSelectedMonitorJobHistory] = useState<Metrics[]>([]);
  const [form, setForm] = useState({
    protocol: "legacy-default",
    cwd: "",
    sourceDir: "",
    buildDir: "",
    executionMode: "runtime" as ExecutionMode,
    launchProfileId: "",
    selectedTargetId: "",
    targetBinary: "",
    targetArgs: "",
    dryRun: true,
    aflPath: "afl-fuzz",
    scheduler: "auto",
    workers: "1",
    timeoutSec: "3600",
    memoryLimitMb: "none",
    inputDir: "",
    outputDir: "",
    singleInputRef: "",
    transportType: "stdin",
    transportConfig: "{}",
    env: '{"AFL_SKIP_CPUFREQ":"1"}',
    fuzzerArgs: "-m none -t 1000+",
    notes: "",
    operationId: "",
    nodeName: "",
    riskEnabled: false,
    buildSystem: "",
    compiler: "afl-clang-fast",
    sanitizerMode: "none",
    instrumentationMode: "llvm",
    buildType: "RelWithDebInfo",
    generator: "",
    parallelism: "4",
    buildTarget: "",
    extraCFlags: "",
    extraCxxFlags: "",
    extraLdFlags: "",
    selectedSuggestionId: "",
    useLlmBuildAssist: false,
  });

  useEffect(() => {
    dockLog("info", "job", "entered jobs workspace", { tab });
    return () => dockLog("info", "job", "left jobs workspace");
  }, [tab]);

  const protocolsQuery = useQuery({ queryKey: ["protocols"], queryFn: protocolsApi.listProtocols, retry: 0 });
  const buildProbeQuery = useQuery({
    queryKey: ["build-probe", form.protocol],
    queryFn: () => buildAssistantApi.probe(form.protocol),
    enabled: Boolean(form.protocol),
    staleTime: 10_000,
  });
  const launchProfilesQuery = useQuery({
    queryKey: ["launch-profiles", form.protocol],
    queryFn: () => buildAssistantApi.listLaunchProfiles(form.protocol),
    enabled: Boolean(form.protocol),
  });
  const targetsQuery = useQuery({
    queryKey: ["build-targets", form.protocol],
    queryFn: () => buildAssistantApi.listTargets(form.protocol),
    enabled: Boolean(form.protocol),
  });
  const jobsQuery = useQuery({ queryKey: ["jobs", query], queryFn: () => jobsApi.listJobs(query), refetchInterval: 5000 });
  const summaryQuery = useQuery({ queryKey: ["jobs-summary", query], queryFn: () => jobsApi.requestSummary(query), refetchInterval: 5000 });
  const monitorQuery = useQuery({
    queryKey: ["jobs-monitor-overview", selectedMonitorJobId, query.protocol, query.status],
    queryFn: () => jobsApi.getMonitorOverview({ job_id: selectedMonitorJobId, protocol: query.protocol, status: query.status }),
    refetchInterval: 5000,
  });
  const monitorMetricsHistoryQuery = useQuery({
    queryKey: ["jobs-monitor-metrics-history", selectedMonitorJobId],
    queryFn: () => jobsApi.getMetricsHistory(selectedMonitorJobId ?? "", 300),
    enabled: tab === "monitor" && Boolean(selectedMonitorJobId),
    refetchInterval: 5000,
  });

  useEffect(() => {
    const probe = buildProbeQuery.data;
    if (!probe) return;
    setForm((current) => ({
      ...current,
      buildSystem: current.buildSystem || probe.preferred_build_system || uniqueBuildSystems(probe)[0] || "manual",
      compiler: current.compiler || probe.allowed_compilers[0] || "afl-clang-fast",
      sanitizerMode: current.sanitizerMode || probe.sanitizer_modes?.[0]?.mode || "none",
      aflPath: current.aflPath || probe.runtime_tools?.[0]?.tool_id || "afl-fuzz",
    }));
  }, [buildProbeQuery.data]);

  const createMutation = useMutation({
    mutationFn: (payload: JobCreateRequest) => jobsApi.createJob(payload),
    onSuccess: async (job) => {
      dockLog("success", "job", `job created: ${job.job_id}`, { protocol: job.protocol, status: job.status });
      setTab("monitor");
      setSelectedMonitorJobId(job.job_id);
      await Promise.all([jobsQuery.refetch(), summaryQuery.refetch(), monitorQuery.refetch()]);
    },
    onError: (error) => dockLog("error", "job", "job create failed", error),
  });

  const buildPlanMutation = useMutation({
    mutationFn: () =>
      buildAssistantApi.createPlan(form.protocol, {
        protocol: form.protocol,
        source_ref: buildProbeQuery.data?.source_ref,
        compiler: form.compiler,
        instrumentation_mode: form.instrumentationMode,
        sanitizer_mode: form.sanitizerMode,
        build_system: form.buildSystem,
        build_type: form.buildType,
        generator: form.generator,
        parallelism: Number(form.parallelism || 4) || 4,
        build_target: form.buildTarget || undefined,
        extra_cflags: form.extraCFlags,
        extra_cxxflags: form.extraCxxFlags,
        extra_ldflags: form.extraLdFlags,
        selected_suggestion_id: form.selectedSuggestionId || undefined,
        use_llm: form.useLlmBuildAssist,
      }),
    onSuccess: (plan) => {
      dockLog("success", "job", `build plan ready: ${plan.plan_id}`, { build_system: plan.build_system, compiler: plan.compiler });
    },
    onError: (error) => dockLog("error", "job", "build plan create failed", error),
  });

  const buildRunMutation = useMutation({
    mutationFn: () => {
      const planId = buildPlanMutation.data?.plan_id;
      if (!planId) throw new Error("请先生成 BuildPlan");
      return buildAssistantApi.runPlan(form.protocol, planId);
    },
    onSuccess: async (run) => {
      dockLog("success", "job", `build run ready: ${run.build_id}`, { targets: run.targets.length });
      if (run.targets[0]?.target_id) {
        setForm((current) => ({ ...current, selectedTargetId: current.selectedTargetId || run.targets[0].target_id, targetBinary: current.targetBinary || run.targets[0].binary_ref }));
      }
      await Promise.all([targetsQuery.refetch(), launchProfilesQuery.refetch()]);
    },
    onError: (error) => dockLog("error", "job", "build run failed", error),
  });

  const predictProfileMutation = useMutation({
    mutationFn: () =>
      buildAssistantApi.predictLaunchProfile(form.protocol, {
        build_id: buildRunMutation.data?.build_id,
        target_id: form.selectedTargetId || undefined,
        afl_tool_id: form.aflPath,
        input_ref: form.inputDir || undefined,
        output_ref: form.outputDir || undefined,
        single_input_ref: form.singleInputRef || undefined,
        scheduler: form.scheduler,
        timeout: form.timeoutSec,
        memory_limit: form.memoryLimitMb,
        sanitizer_mode: form.sanitizerMode,
        env: parseKeyValues(form.env),
        extra_afl_args: parseCommand(form.fuzzerArgs),
        target_args: parseCommand(form.targetArgs),
      }),
    onSuccess: async (profile) => {
      dockLog("success", "job", `launch profile predicted: ${profile.profile_id}`, { afl_tool_id: profile.afl_tool_id, runner_compatible: profile.runner_compatible });
      setForm((current) => ({ ...current, launchProfileId: profile.profile_id }));
      await launchProfilesQuery.refetch();
    },
    onError: (error) => dockLog("error", "job", "predict launch profile failed", error),
  });

  const jobs = jobsQuery.data ?? [];
  const summary = summaryQuery.data;
  const probe = buildProbeQuery.data;
  const protocolOptions = useMemo(
    () => Array.from(new Set([...(protocolsQuery.data ?? []), ...jobs.map((item) => item.protocol ?? "").filter(Boolean)])),
    [jobs, protocolsQuery.data],
  );
  const nodeOptions = useMemo(
    () => Array.from(new Set(jobs.map((item) => String((item.request as Record<string, unknown> | undefined)?.node_name ?? "未指定")).filter(Boolean))),
    [jobs],
  );
  const schedulerListOptions = useMemo(
    () => Array.from(new Set(jobs.map((item) => String((item.request as Record<string, unknown> | undefined)?.scheduler ?? "未指定")).filter(Boolean))),
    [jobs],
  );

  useEffect(() => {
    if (tab !== "monitor") return;
    if (selectedMonitorJobId) return;
    const fallbackJobId = monitorQuery.data?.recent_task_activity?.[0]?.job_id;
    if (fallbackJobId) {
      setSelectedMonitorJobId(fallbackJobId);
      dockLog("info", "job", `default monitor job ${fallbackJobId}`);
    }
  }, [monitorQuery.data, selectedMonitorJobId, tab]);

  useEffect(() => {
    if (monitorMetricsHistoryQuery.data) {
      setSelectedMonitorJobHistory(monitorMetricsHistoryQuery.data);
    } else if (!selectedMonitorJobId) {
      setSelectedMonitorJobHistory([]);
    }
  }, [monitorMetricsHistoryQuery.data, selectedMonitorJobId]);

  const selectedProfile = useMemo(
    () => (launchProfilesQuery.data ?? []).find((item) => item.profile_id === form.launchProfileId),
    [form.launchProfileId, launchProfilesQuery.data],
  );
  const targetOptions = targetsQuery.data ?? [];
  const selectedTarget = useMemo(
    () => targetOptions.find((item) => item.target_id === form.selectedTargetId) ?? null,
    [form.selectedTargetId, targetOptions],
  );
  const runtimeTools = probe?.runtime_tools ?? [
    { tool_id: "afl-fuzz", label: "afl-fuzz", binary_path: "afl-fuzz", category: "monitored", runner_compatible: true, requires_target: true, input_kind: "directory", output_kind: "directory", default_args: ["-m", "none", "-t", "1000+"], notes: [] },
  ];
  const selectedRuntimeTool = useMemo<RuntimeToolDefinition | null>(
    () => runtimeTools.find((item) => item.tool_id === form.aflPath) ?? runtimeTools[0] ?? null,
    [form.aflPath, runtimeTools],
  );
  const sanitizerModes = probe?.sanitizer_modes ?? [{ mode: "none", label: "默认", env: {}, description: "保持默认" } satisfies SanitizerModeDefinition];
  const buildSystems = uniqueBuildSystems(probe);
  const buildSuggestions: BuildSuggestion[] = buildPlanMutation.data?.build_suggestions ?? probe?.build_suggestions ?? [];
  const primaryBuildSuggestions = useMemo(
    () => buildSuggestions.filter((item) => !form.buildSystem || item.build_system === form.buildSystem || item.phase === "suggestion"),
    [buildSuggestions, form.buildSystem],
  );

  const payload = useMemo<JobCreateRequest>(() => ({
    protocol: form.protocol || "legacy-default",
    cwd: form.cwd || undefined,
    target_cmd: [form.targetBinary, ...parseCommand(form.targetArgs)].filter(Boolean),
    afl_path: form.aflPath || "afl-fuzz",
    input_dir: form.inputDir || undefined,
    output_dir: form.outputDir || undefined,
    timeout_sec: Number(form.timeoutSec || 0) || undefined,
    memory_limit_mb: form.memoryLimitMb === "none" ? undefined : Number(form.memoryLimitMb || 0) || undefined,
    workers: Number(form.workers || 1) || 1,
    scheduler: form.scheduler === "auto" ? undefined : form.scheduler,
    risk_enabled: form.riskEnabled,
    node_name: form.nodeName || undefined,
    notes: form.notes || undefined,
    operation_id: form.operationId || undefined,
    launch_profile_id: form.launchProfileId || undefined,
    fuzzer_args: parseCommand(form.fuzzerArgs),
    env: parseKeyValues(form.env),
    dry_run: form.dryRun,
    debug: {
      transport_type: form.transportType,
      transport_config: parseKeyValues(form.transportConfig),
    },
  }), [form]);

  const localCommandPreview = useMemo(
    () =>
      estimateToolCommand({
        tool: selectedRuntimeTool,
        targetBinary: selectedTarget?.binary_ref || form.targetBinary,
        targetArgs: parseCommand(form.targetArgs),
        inputDir: form.inputDir,
        outputDir: form.outputDir,
        singleInput: form.singleInputRef,
        scheduler: form.scheduler,
        timeoutSec: form.timeoutSec,
        memoryLimitMb: form.memoryLimitMb,
        fuzzerArgs: parseCommand(form.fuzzerArgs),
      }),
    [form.aflPath, form.targetBinary, form.targetArgs, form.inputDir, form.outputDir, form.singleInputRef, form.scheduler, form.timeoutSec, form.memoryLimitMb, form.fuzzerArgs, selectedRuntimeTool, selectedTarget],
  );

  const runnerReadyProfile = predictProfileMutation.data ?? selectedProfile;
  const validationWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (!payload.protocol) warnings.push("需要指定 protocol 才能生成任务。");
    if (form.executionMode !== "build" && selectedRuntimeTool?.requires_target && !form.targetBinary && !selectedTarget && !payload.launch_profile_id) {
      warnings.push("当前 AFL 工具需要 target binary；请从 Build targets 选择，或手动填写 targetBinary。");
    }
    if (form.executionMode !== "build" && selectedRuntimeTool?.input_kind === "directory" && !form.inputDir) {
      warnings.push("该工具需要输入目录，请填写 input dir 或 workspace ref。");
    }
    if (form.executionMode !== "build" && selectedRuntimeTool?.input_kind.includes("single_file") && !form.singleInputRef) {
      warnings.push("该工具需要单个 testcase 路径；如果暂时无法自动分析，请先用侧栏命令建议。\n");
    }
    if (form.executionMode !== "build" && selectedRuntimeTool?.output_kind !== "none" && !form.outputDir) {
      warnings.push("建议填写 output 路径，避免运行后无法回收结果或输出文件。");
    }
    if (form.executionMode === "runtime" && payload.launch_profile_id && selectedProfile?.runner_compatible === false && !payload.dry_run) {
      warnings.push("当前 LaunchProfile 对应的 AFL 工具不兼容实时监控 Runner；请改为 dry_run 或使用侧栏命令建议。");
    }
    if (form.executionMode !== "build" && selectedRuntimeTool && !selectedRuntimeTool.runner_compatible && !form.dryRun) {
      warnings.push("当前 AFL 工具属于单次/辅助工具，不应作为长期实时监控任务启动；建议生成命令建议侧栏后在宿主机执行。");
    }
    if (form.executionMode === "build" && !probe?.source_ref) {
      warnings.push("构建辅助依赖协议源码工作区；当前协议下尚未发现 source 作用域。");
    }
    if (form.executionMode === "build" && !buildSystems.length) {
      warnings.push("未检测到稳定构建系统；系统将退化为侧栏建议命令，而不是强制生成 BuildPlan。");
    }
    if (form.executionMode === "runtime" && !form.launchProfileId && !form.dryRun) {
      warnings.push("正式执行建议先生成或选择 LaunchProfile，避免前端参数与服务端最终命令不一致。");
    }
    return warnings.map((item) => item.trim()).filter(Boolean);
  }, [buildSystems.length, form.dryRun, form.executionMode, form.inputDir, form.launchProfileId, form.outputDir, form.singleInputRef, form.targetBinary, payload.dry_run, payload.launch_profile_id, payload.protocol, probe?.source_ref, selectedProfile?.runner_compatible, selectedRuntimeTool, selectedTarget]);

  const canSubmitJob = useMemo(() => {
    if (form.executionMode === "build") return false;
    if (selectedRuntimeTool && !selectedRuntimeTool.runner_compatible && !form.dryRun) return false;
    if (form.executionMode === "runtime" && !form.dryRun && !form.launchProfileId) return false;
    if (selectedRuntimeTool?.requires_target && !form.targetBinary && !selectedTarget && !form.launchProfileId) return false;
    if (selectedRuntimeTool?.input_kind === "directory" && !form.inputDir) return false;
    if (selectedRuntimeTool?.input_kind.includes("single_file") && !form.singleInputRef) return false;
    return true;
  }, [form.dryRun, form.executionMode, form.inputDir, form.launchProfileId, form.singleInputRef, form.targetBinary, selectedRuntimeTool, selectedTarget]);

  const profileSummary = [
    { label: "protocol", value: form.protocol || "legacy-default" },
    { label: "执行模式", value: executionModeOptions.find((item) => item.value === form.executionMode)?.label ?? form.executionMode },
    { label: form.executionMode === "build" ? "compiler" : "AFL tool", value: form.executionMode === "build" ? form.compiler : selectedRuntimeTool?.tool_id ?? form.aflPath },
    { label: "launch profile", value: selectedProfile?.profile_id ?? predictProfileMutation.data?.profile_id ?? "未生成" },
    { label: "runner 兼容", value: form.executionMode === "build" ? "BuildPlan / 侧栏建议" : (runnerReadyProfile?.runner_compatible === false ? "仅建议命令" : "可进入正式 Runner") },
    { label: "target", value: (selectedTarget?.name ?? form.targetBinary) || "—" },
  ];

  const commandBlocks = useMemo(() => {
    const blocks: Array<{ title: string; command: string; env?: string; note?: string }> = [];
    if (form.executionMode === "build") {
      const steps = buildPlanMutation.data?.steps ?? [];
      if (steps.length) {
        steps.forEach((step, index) => {
          blocks.push({
            title: `BuildPlan · Step ${index + 1} · ${step.name}`,
            command: step.argv.join(" "),
            env: joinEnvPreview(step.env),
            note: step.cwd_ref,
          });
        });
      }
      primaryBuildSuggestions.slice(0, 4).forEach((item) => {
        blocks.push({
          title: `建议命令 · ${item.label}`,
          command: item.argv.join(" "),
          env: joinEnvPreview(item.env),
          note: `${item.reason} · cwd=${item.cwd_ref}`,
        });
      });
      return blocks;
    }

    if (runnerReadyProfile?.command_preview?.length) {
      blocks.push({
        title: `服务端校准 · ${runnerReadyProfile.afl_tool_id}`,
        command: runnerReadyProfile.command_preview.join(" "),
        env: joinEnvPreview(runnerReadyProfile.env),
        note: runnerReadyProfile.explanation?.join("；") || undefined,
      });
    }

    blocks.push({
      title: `页面预估 · ${selectedRuntimeTool?.tool_id ?? form.aflPath}`,
      command: localCommandPreview.join(" "),
      env: joinEnvPreview(parseKeyValues(form.env)),
      note: selectedRuntimeTool?.notes?.join("；") || undefined,
    });
    return blocks;
  }, [buildPlanMutation.data?.steps, form.aflPath, form.env, form.executionMode, localCommandPreview, primaryBuildSuggestions, runnerReadyProfile, selectedRuntimeTool]);

  const assistantNotes = useMemo(() => {
    const notes = new Set<string>();
    selectedRuntimeTool?.notes?.forEach((item) => notes.add(item));
    runnerReadyProfile?.warnings?.forEach((item) => notes.add(item));
    runnerReadyProfile?.explanation?.forEach((item) => notes.add(item));
    buildPlanMutation.data?.warnings?.forEach((item) => notes.add(item));
    primaryBuildSuggestions.slice(0, 3).forEach((item) => notes.add(item.reason));
    return Array.from(notes);
  }, [buildPlanMutation.data?.warnings, primaryBuildSuggestions, runnerReadyProfile, selectedRuntimeTool]);

  const tabMetrics = {
    compose: String((launchProfilesQuery.data ?? []).length),
    list: `${jobs.length}/${summary?.running ?? 0}`,
    monitor: `${monitorQuery.data?.recent_artifacts?.length ?? 0}/${monitorQuery.data?.alert_timeline?.length ?? 0}`,
  } satisfies Record<JobsFlowTabKey, string>;

  const submitJob = (): void => {
    dockLog("info", "job", "submit job payload", payload);
    createMutation.mutate(payload);
  };

  return (
    <div className="space-y-5">
      <ApiErrorReporter error={protocolsQuery.error} title="加载协议列表失败" source="job" />
      <ApiErrorReporter error={buildProbeQuery.error} title="加载 Build Probe 失败" source="job" />
      <ApiErrorReporter error={launchProfilesQuery.error} title="加载 LaunchProfile 失败" source="job" />
      <ApiErrorReporter error={targetsQuery.error} title="加载 Build targets 失败" source="job" />
      <ApiErrorReporter error={jobsQuery.error} title="加载任务列表失败" source="job" />
      <ApiErrorReporter error={summaryQuery.error} title="加载任务态势板失败" source="job" />
      <ApiErrorReporter error={monitorQuery.error} title="加载运行态监控失败" source="job" />
      <ApiErrorReporter error={monitorMetricsHistoryQuery.error} title="加载 AFL++ 指标历史失败" source="job" />
      <ApiErrorReporter error={createMutation.error} title="创建任务失败" source="job" />
      <ApiErrorReporter error={buildPlanMutation.error} title="生成 BuildPlan 失败" source="job" />
      <ApiErrorReporter error={buildRunMutation.error} title="运行 BuildPlan 失败" source="job" />
      <ApiErrorReporter error={predictProfileMutation.error} title="预测 LaunchProfile 失败" source="job" />

      <PageHeroBoard
          eyebrow="F U Z Z · J O B S"
          title="任务中心"
          description="将任务创建、检索与运行态监控拆分成三种工作流；右侧统一态势板只负责概览，不替代主体工作台。"
          boardClassName="[--board-surface:276_100%_98%] [--board-border:274_54%_85%] [--board-track:274_55%_92%] [--board-accent-soft:276_92%_95%] [--board-accent:272_68%_56%] [--board-accent-strong:268_74%_44%] dark:[--board-surface:263_28%_19%] dark:[--board-border:267_32%_34%] dark:[--board-track:263_20%_28%] dark:[--board-accent-soft:268_34%_28%] dark:[--board-accent:278_85%_73%] dark:[--board-accent-strong:286_92%_82%]"
          board={<JobsStatusBoard summary={summary} />}
      />

      <JobsFlowTabs value={tab} onChange={setTab} metrics={tabMetrics} />

      {tab === "compose" ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_32rem]">
          <div className="space-y-4">
            <Card className="card-surface">
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Boxes className="size-4.5" /> 任务目标与上下文</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                <Input value={form.protocol} onChange={(event) => setForm((current) => ({ ...current, protocol: event.target.value }))} list="jobs-protocols" placeholder="protocol" />
                <datalist id="jobs-protocols">{protocolOptions.map((item) => <option key={item} value={item} />)}</datalist>
                <Input value={form.cwd} onChange={(event) => setForm((current) => ({ ...current, cwd: event.target.value }))} placeholder="cwd / workspace://..." />
                <Select value={form.launchProfileId || "none"} onValueChange={(next) => setForm((current) => ({ ...current, launchProfileId: next === "none" ? "" : next }))}>
                  <SelectTrigger><SelectValue placeholder="LaunchProfile" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不使用 LaunchProfile</SelectItem>
                    {(launchProfilesQuery.data ?? []).map((item) => <SelectItem key={item.profile_id} value={item.profile_id}>{item.profile_id}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input value={form.targetBinary} onChange={(event) => setForm((current) => ({ ...current, targetBinary: event.target.value }))} placeholder="target binary / workspace ref" list="build-targets" />
                <datalist id="build-targets">{targetOptions.map((item) => <option key={item.target_id} value={item.binary_ref} />)}</datalist>
                <Input value={form.targetArgs} onChange={(event) => setForm((current) => ({ ...current, targetArgs: event.target.value }))} placeholder="target args" />
                <Select value={form.selectedTargetId || "none"} onValueChange={(next) => {
                  const selected = targetOptions.find((item) => item.target_id === next);
                  setForm((current) => ({ ...current, selectedTargetId: next === "none" ? "" : next, targetBinary: selected?.binary_ref ?? current.targetBinary }));
                }}>
                  <SelectTrigger><SelectValue placeholder="Build targets" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不绑定 build target</SelectItem>
                    {targetOptions.map((item) => <SelectItem key={item.target_id} value={item.target_id}>{item.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="md:col-span-2 rounded-[var(--radius-lg)] border border-border/60 bg-background/55 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full border border-border/60 bg-background px-2.5 py-1">构建探针</span>
                    {(probe?.build_files ?? []).slice(0, 6).map((item) => (
                      <span key={`${item.kind}-${item.path_ref}`} className="rounded-full border border-border/60 bg-background px-2.5 py-1">
                        {item.kind} · {item.filename}
                      </span>
                    ))}
                    {!(probe?.build_files ?? []).length ? <span>当前协议下未检测到稳定构建文件，将优先给出建议命令侧栏。</span> : null}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card-surface">
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Wand2 className="size-4.5" /> 执行模式与 AFL 助手</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <Select value={form.executionMode} onValueChange={(next) => setForm((current) => ({ ...current, executionMode: next as ExecutionMode }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{executionModeOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <div className="flex items-center justify-between rounded-[var(--radius-lg)] border border-border/60 bg-background/55 px-3 py-2.5">
                    <span className="text-sm">Dry run</span>
                    <Switch checked={form.dryRun} onCheckedChange={(checked) => setForm((current) => ({ ...current, dryRun: checked }))} />
                  </div>
                </div>

                {form.executionMode !== "build" ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="md:col-span-2 rounded-[var(--radius-lg)] border border-border/60 bg-background/55 p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">AFL tool catalog</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                        <Select value={form.aflPath} onValueChange={(next) => setForm((current) => ({ ...current, aflPath: next }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {runtimeTools.map((item) => (
                              <SelectItem key={item.tool_id} value={item.tool_id}>{item.tool_id}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className={`rounded-full border px-3 py-2 text-xs ${selectedRuntimeTool?.runner_compatible ? 'border-success/40 bg-success/10 text-success' : 'border-warning/40 bg-warning/10 text-warning-foreground'}`}>
                          {selectedRuntimeTool?.runner_compatible ? '可进入 Runner' : '仅建议命令'}
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{selectedRuntimeTool?.notes?.join(" ") || "当前工具说明将由后端 probe 提供。"}</p>
                    </div>
                    <Select value={form.scheduler} onValueChange={(next) => setForm((current) => ({ ...current, scheduler: next }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{schedulerOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input value={form.workers} onChange={(event) => setForm((current) => ({ ...current, workers: event.target.value }))} placeholder="workers" />
                    <Input value={form.timeoutSec} onChange={(event) => setForm((current) => ({ ...current, timeoutSec: event.target.value }))} placeholder="timeout sec" />
                    <Input value={form.memoryLimitMb} onChange={(event) => setForm((current) => ({ ...current, memoryLimitMb: event.target.value }))} placeholder="memory limit mb / none" />
                    <Input value={form.inputDir} onChange={(event) => setForm((current) => ({ ...current, inputDir: event.target.value }))} placeholder={selectedRuntimeTool?.input_kind === 'directory' ? 'input dir / workspace ref' : 'input ref / workspace ref'} />
                    <Input value={form.outputDir} onChange={(event) => setForm((current) => ({ ...current, outputDir: event.target.value }))} placeholder={selectedRuntimeTool?.output_kind === 'directory' ? 'output dir / workspace ref' : 'output file / workspace ref'} />
                    {(selectedRuntimeTool?.input_kind ?? '').includes('single_file') ? (
                      <Input value={form.singleInputRef} onChange={(event) => setForm((current) => ({ ...current, singleInputRef: event.target.value }))} placeholder="single testcase path / workspace ref" className="md:col-span-2" />
                    ) : null}
                    <Select value={form.transportType} onValueChange={(next) => setForm((current) => ({ ...current, transportType: next }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{transportOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input value={form.nodeName} onChange={(event) => setForm((current) => ({ ...current, nodeName: event.target.value }))} placeholder="node name" />
                    <div className="md:col-span-2 flex items-center justify-between rounded-[var(--radius-lg)] border border-border/60 bg-background/55 px-3 py-2.5">
                      <span className="text-sm">Risk enabled</span>
                      <Switch checked={form.riskEnabled} onCheckedChange={(checked) => setForm((current) => ({ ...current, riskEnabled: checked }))} />
                    </div>
                    <Textarea className="md:col-span-2 min-h-[88px]" value={form.transportConfig} onChange={(event) => setForm((current) => ({ ...current, transportConfig: event.target.value }))} placeholder='transport config JSON' />
                    <Textarea className="min-h-[88px]" value={form.env} onChange={(event) => setForm((current) => ({ ...current, env: event.target.value }))} placeholder='env JSON' />
                    <Textarea className="min-h-[88px]" value={form.fuzzerArgs} onChange={(event) => setForm((current) => ({ ...current, fuzzerArgs: event.target.value }))} placeholder='tool / fuzzer args' />
                    <Input value={form.operationId} onChange={(event) => setForm((current) => ({ ...current, operationId: event.target.value }))} placeholder="operation id" />
                    <Input value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="notes" />
                  </div>
                ) : (
                  <div className="space-y-3 rounded-[var(--radius-lg)] border border-border/60 bg-background/55 p-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <Select value={form.buildSystem || (buildSystems[0] ?? 'manual')} onValueChange={(next) => setForm((current) => ({ ...current, buildSystem: next }))}>
                        <SelectTrigger><SelectValue placeholder="build system" /></SelectTrigger>
                        <SelectContent>{(buildSystems.length ? buildSystems : ['manual']).map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={form.compiler} onValueChange={(next) => setForm((current) => ({ ...current, compiler: next }))}>
                        <SelectTrigger><SelectValue placeholder="compiler wrapper" /></SelectTrigger>
                        <SelectContent>{(probe?.compiler_catalog ?? []).map((item) => <SelectItem key={item.compiler_id} value={item.compiler_id}>{item.compiler_id}</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={form.sanitizerMode} onValueChange={(next) => setForm((current) => ({ ...current, sanitizerMode: next }))}>
                        <SelectTrigger><SelectValue placeholder="sanitizer" /></SelectTrigger>
                        <SelectContent>{sanitizerModes.map((item) => <SelectItem key={item.mode} value={item.mode}>{item.label}</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={form.buildType} onValueChange={(next) => setForm((current) => ({ ...current, buildType: next }))}>
                        <SelectTrigger><SelectValue placeholder="build type" /></SelectTrigger>
                        <SelectContent>{buildTypeOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input value={form.parallelism} onChange={(event) => setForm((current) => ({ ...current, parallelism: event.target.value }))} placeholder="parallelism" />
                      <Input value={form.generator} onChange={(event) => setForm((current) => ({ ...current, generator: event.target.value }))} placeholder="generator (optional)" />
                      <Input value={form.buildTarget} onChange={(event) => setForm((current) => ({ ...current, buildTarget: event.target.value }))} placeholder="build target (optional)" />
                      <div className="flex items-center justify-between rounded-[var(--radius-lg)] border border-border/60 bg-background px-3 py-2.5">
                        <span className="text-sm">LLM 辅助构建建议</span>
                        <Switch checked={form.useLlmBuildAssist} onCheckedChange={(checked) => setForm((current) => ({ ...current, useLlmBuildAssist: checked }))} />
                      </div>
                      <Textarea className="min-h-[84px]" value={form.extraCFlags} onChange={(event) => setForm((current) => ({ ...current, extraCFlags: event.target.value }))} placeholder='extra CFLAGS' />
                      <Textarea className="min-h-[84px]" value={form.extraCxxFlags} onChange={(event) => setForm((current) => ({ ...current, extraCxxFlags: event.target.value }))} placeholder='extra CXXFLAGS' />
                      <Textarea className="md:col-span-2 min-h-[84px]" value={form.extraLdFlags} onChange={(event) => setForm((current) => ({ ...current, extraLdFlags: event.target.value }))} placeholder='extra LDFLAGS' />
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button type="button" variant="secondary" onClick={() => buildPlanMutation.mutate()} disabled={buildPlanMutation.isPending || !probe?.source_ref}>
                        <Hammer className="size-4" />
                        {buildPlanMutation.isPending ? '生成中...' : '生成 BuildPlan'}
                      </Button>
                      <Button type="button" onClick={() => buildRunMutation.mutate()} disabled={buildRunMutation.isPending || !buildPlanMutation.data?.plan_id}>
                        <TerminalSquare className="size-4" />
                        {buildRunMutation.isPending ? '构建中...' : '运行 BuildPlan'}
                      </Button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Select value={form.selectedSuggestionId || 'none'} onValueChange={(next) => setForm((current) => ({ ...current, selectedSuggestionId: next === 'none' ? '' : next }))}>
                        <SelectTrigger><SelectValue placeholder="建议命令" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">不锁定建议命令</SelectItem>
                          {primaryBuildSuggestions.map((item) => <SelectItem key={item.suggestion_id} value={item.suggestion_id}>{item.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <p className="rounded-[var(--radius-lg)] border border-border/60 bg-background px-3 py-2 text-xs text-muted-foreground">
                        如果无法可靠反推出完整 build 链，系统会在右侧展示可复制的建议命令，而不是伪造可运行配置。
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="card-surface">
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><GitBranchPlus className="size-4.5" /> 闭环动作</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <Button type="button" variant="secondary" onClick={() => predictProfileMutation.mutate()} disabled={predictProfileMutation.isPending || form.executionMode === 'build'}>
                    <Wrench className="size-4" />
                    {predictProfileMutation.isPending ? '生成中...' : '生成 LaunchProfile 草案'}
                  </Button>
                  <Button onClick={submitJob} disabled={createMutation.isPending || !canSubmitJob}>
                    {createMutation.isPending ? '提交中...' : form.dryRun ? '执行校验' : '启动任务'}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  实时任务建议：构建辅助 → 选择 target → 生成 LaunchProfile → 正式启动。辅助工具模式如果与 Runner 不兼容，会自动退化为右侧可复制命令建议。
                </p>
              </CardContent>
            </Card>
          </div>

          <JobLaunchPreviewPanel
            payload={payload}
            warnings={validationWarnings}
            profileSummary={profileSummary}
            commandBlocks={commandBlocks}
            assistantNotes={assistantNotes}
          />
        </div>
      ) : null}

      {tab === "list" ? (
        <div className="space-y-4">
          <JobsQueryBar value={query} onChange={(next) => { setQuery(next); dockLog("info", "job", "job filters updated", next); }} protocolOptions={protocolOptions} nodeOptions={nodeOptions} schedulerOptions={schedulerListOptions} />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_24rem]">
            <JobRowList jobs={jobs} />
            <JobsResultSummaryPanel jobs={jobs} summary={summary} />
          </div>
        </div>
      ) : null}

      {tab === "monitor" ? (
        <div className="space-y-4">
          <div className="card-surface rounded-[var(--radius-xl)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
              <p className="text-sm font-medium">运行态总览</p>
              <p className="text-sm text-muted-foreground">主趋势图与全字段面板直接消费后端 `metrics/history` 和 `fuzzer_stats`；运行参数回显来自后端最终启动 command 解析。</p>
              </div>
              <Button variant="secondary" onClick={() => { void monitorQuery.refetch(); void summaryQuery.refetch(); void monitorMetricsHistoryQuery.refetch(); }}>
                <RefreshCw className="size-4" /> 刷新
              </Button>
            </div>
          </div>
          <JobsMonitoringOverview data={monitorQuery.data} selectedJobId={selectedMonitorJobId} selectedJobHistory={selectedMonitorJobHistory} onSelectJob={(jobId) => { setSelectedMonitorJobId(jobId); dockLog("info", "job", `inspect monitor job ${jobId}`); }} />
        </div>
      ) : null}
    </div>
  );
}

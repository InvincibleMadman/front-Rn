import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Boxes, GitBranchPlus, Hammer, RefreshCw, TerminalSquare, Wand2, Wrench } from "lucide-react";
import { ApiErrorReporter } from "@/components/common/api-error-alert";
import { PageHeroBoard } from "@/components/layout/page-hero-board";
import { dockLog } from "@/components/layout/dock";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BuildTaskComposerSections, type BuildTaskComposerState } from "@/features/jobs/components/build-task-composer-sections";
import { JobComposerSections, type JobComposerState } from "@/features/jobs/components/job-composer-sections";
import { JobLaunchPreviewPanel } from "@/features/jobs/components/job-launch-preview-panel";
import { JobRowList } from "@/features/jobs/components/job-row-list";
import { JobsFlowTabs, type JobsFlowTabKey } from "@/features/jobs/components/jobs-flow-tabs";
import { JobsMonitoringOverview } from "@/features/jobs/components/jobs-monitoring-overview";
import { JobsQueryBar } from "@/features/jobs/components/jobs-query-bar";
import { JobsResultSummaryPanel } from "@/features/jobs/components/jobs-result-summary-panel";
import { JobsStatusBoard } from "@/features/jobs/components/jobs-status-board";
import { sanitizeBuildCommandLines } from "@/features/jobs/job-command-guard";
import { buildAssistantApi } from "@/lib/api/services/build-assistant";
import { jobsApi } from "@/lib/api/services/jobs";
import { protocolsApi } from "@/lib/api/services/protocols";
import type { BuildPlanCreatePayload, BuildProbe, RuntimeToolDefinition } from "@/types/api/build-assistant";
import type { JobCreateRequest, JobsListQuery, Metrics } from "@/types/api/jobs";

function parseCommand(input: string): string[] {
  return input.split(/\s+/).map((item) => item.trim()).filter(Boolean);
}

function parseKeyValues(text: string): Record<string, string> {
  try {
    if (!text.trim()) return {};
    return JSON.parse(text) as Record<string, string>;
  } catch {
    return {};
  }
}

function splitLines(input: string): string[] {
  return input.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function joinEnvPreview(env?: Record<string, string>): string {
  const pairs = Object.entries(env ?? {});
  return pairs.length ? pairs.map(([key, value]) => `${key}=${value}`).join(" ") : "";
}

function buildEffectiveEnv(env: Record<string, string>, options: { riskFeedbackEnabled: boolean; riskScheduleEnabled: boolean }): Record<string, string> {
  const next = { ...env };
  if (options.riskFeedbackEnabled) {
    delete next.AFL_DISABLE_RISK;
  } else {
    next.AFL_DISABLE_RISK = "1";
  }

  if (options.riskFeedbackEnabled && options.riskScheduleEnabled) {
    delete next.AFL_DISABLE_RISK_SCHED;
  } else {
    next.AFL_DISABLE_RISK_SCHED = "1";
  }

  return next;
}

function stripFlagArg(args: string[], flag: string): string[] {
  const cleaned: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === flag) {
      index += 1;
      continue;
    }
    cleaned.push(args[index]);
  }
  return cleaned;
}

function buildEffectiveAflArgs(baseArgs: string[], options: { scheduler?: string; timeoutSec?: string; memoryLimitMb?: string }): string[] {
  let next = [...baseArgs];
  const scheduler = options.scheduler?.trim().toLowerCase();
  if (options.scheduler !== undefined) {
    next = stripFlagArg(next, "-p");
    if (scheduler && !["auto", "default", "normal"].includes(scheduler)) next.push("-p", scheduler);
  }

  const timeout = options.timeoutSec?.trim();
  if (options.timeoutSec !== undefined && timeout) {
    next = stripFlagArg(next, "-t");
    next.push("-t", timeout);
  }

  const memoryLimit = options.memoryLimitMb?.trim();
  if (options.memoryLimitMb !== undefined && memoryLimit) {
    next = stripFlagArg(next, "-m");
    next.push("-m", memoryLimit);
  }

  return next;
}

function uniqueBuildSystems(probe?: BuildProbe): string[] {
  const values = new Set<string>();
  if (probe?.preferred_build_system) values.add(probe.preferred_build_system);
  if (probe?.has_cmake) values.add("cmake");
  if (probe?.has_makefile) values.add("make");
  if (probe?.has_meson) values.add("meson");
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
  const targetCmd = [targetBinary || "<target>", ...(targetArgs.length ? targetArgs : ["@@"] )];

  if (toolId === "afl-fuzz") {
    const args = buildEffectiveAflArgs(fuzzerArgs, {
      scheduler,
      timeoutSec,
      memoryLimitMb: memoryLimitMb || "none",
    });
    return [toolId, "-i", inputDir || "<input-dir>", "-o", outputDir || "<output-dir>", ...args, "--", ...targetCmd];
  }
  if (toolId === "afl-cmin") return [toolId, "-i", inputDir || "<input-dir>", "-o", outputDir || "<output-dir>", ...fuzzerArgs, "--", ...targetCmd];
  if (toolId === "afl-showmap") return [toolId, "-o", outputDir || "showmap.out", ...fuzzerArgs, "--", ...targetCmd];
  if (toolId === "afl-tmin") return [toolId, "-i", singleInput || "<testcase>", "-o", outputDir || "tmin.out", ...fuzzerArgs, "--", ...targetCmd];
  if (toolId === "afl-analyze") return [toolId, ...fuzzerArgs, singleInput || "<testcase>"];
  return [toolId, ...fuzzerArgs, "--", ...targetCmd];
}

function deriveStructuredCommands(form: BuildTaskComposerState): Array<{ title: string; cwd?: string; command: string }> {
  const sourceRoot = form.source_ref || form.source_root || "workspace://<protocol>/source/";
  const buildRoot = form.build_root_ref || form.build_root || "workspace://<protocol>/build/";
  const explicit = [
    ...splitLines(form.configure_command_text).map((command, index) => ({ title: `configure ${index + 1}`, cwd: sourceRoot, command })),
    ...splitLines(form.build_command_text).map((command, index) => ({ title: `build ${index + 1}`, cwd: buildRoot, command })),
    ...splitLines(form.post_build_commands_text).map((command, index) => ({ title: `post-build ${index + 1}`, cwd: buildRoot, command })),
  ];
  if (explicit.length) return explicit;

  const parallelism = Number(form.parallelism || 4) || 4;
  const generator = form.generator.trim();
  const buildType = form.build_type.trim();
  const target = form.build_target.trim();
  switch (form.build_system) {
    case "cmake":
      return [
        {
          title: "configure",
          cwd: sourceRoot,
          command: ["cmake", "-S", sourceRoot, "-B", buildRoot, generator ? `-G ${generator}` : "", buildType ? `-DCMAKE_BUILD_TYPE=${buildType}` : ""].filter(Boolean).join(" "),
        },
        {
          title: "build",
          cwd: buildRoot,
          command: ["cmake", "--build", buildRoot, "--parallel", String(parallelism), target ? `--target ${target}` : ""].filter(Boolean).join(" "),
        },
      ];
    case "make":
      return [{ title: "build", cwd: sourceRoot, command: ["make", "-C", sourceRoot, `-j${parallelism}`, target].filter(Boolean).join(" ") }];
    case "meson":
      return [
        { title: "setup", cwd: sourceRoot, command: ["meson", "setup", buildRoot, sourceRoot].filter(Boolean).join(" ") },
        { title: "compile", cwd: buildRoot, command: ["meson", "compile", "-C", buildRoot, `-j${parallelism}`, target].filter(Boolean).join(" ") },
      ];
    case "ninja":
      return [{ title: "build", cwd: buildRoot, command: ["ninja", "-C", buildRoot, `-j${parallelism}`, target].filter(Boolean).join(" ") }];
    default:
      return [];
  }
}

const runtimeToolFallback: RuntimeToolDefinition[] = [
  { tool_id: "afl-fuzz", label: "afl-fuzz", binary_path: "afl-fuzz", category: "monitored", runner_compatible: true, requires_target: true, input_kind: "directory", output_kind: "directory", default_args: ["-m", "none", "-t", "1000+"], notes: ["默认 Runner 兼容工具。"] },
  { tool_id: "afl-showmap", label: "afl-showmap", binary_path: "afl-showmap", category: "aux", runner_compatible: false, requires_target: true, input_kind: "single_file", output_kind: "file", default_args: [], notes: ["一次性辅助工具，不适合实时监控 Runner。"] },
  { tool_id: "afl-tmin", label: "afl-tmin", binary_path: "afl-tmin", category: "aux", runner_compatible: false, requires_target: true, input_kind: "single_file", output_kind: "file", default_args: [], notes: ["最小化输入样本辅助工具。"] },
  { tool_id: "afl-cmin", label: "afl-cmin", binary_path: "afl-cmin", category: "aux", runner_compatible: false, requires_target: true, input_kind: "directory", output_kind: "directory", default_args: [], notes: ["语料裁剪辅助工具。"] },
  { tool_id: "afl-analyze", label: "afl-analyze", binary_path: "afl-analyze", category: "aux", runner_compatible: false, requires_target: false, input_kind: "single_file", output_kind: "none", default_args: [], notes: ["单次输入分析工具。"] },
];

export function JobsView(): JSX.Element {
  const [tab, setTab] = useState<JobsFlowTabKey>("compose");
  const [composeMode, setComposeMode] = useState<"fuzz" | "build">("fuzz");
  const [query, setQuery] = useState<JobsListQuery>({ sort: "updated_at", order: "desc" });
  const [selectedMonitorJobId, setSelectedMonitorJobId] = useState<string | undefined>(undefined);
  const [selectedMonitorJobHistory, setSelectedMonitorJobHistory] = useState<Metrics[]>([]);
  const [fuzzForm, setFuzzForm] = useState<JobComposerState>({
    protocol: "legacy-default",
    task_kind: "runtime",
    launch_profile_id: "",
    selected_target_id: "",
    cwd: "",
    target_binary: "",
    target_args: "",
    afl_path: "afl-fuzz",
    scheduler: "auto",
    workers: "1",
    timeout_sec: "3600",
    memory_limit_mb: "none",
    input_dir: "",
    output_dir: "",
    single_input_ref: "",
    transport_type: "stdin",
    transport_config_json: "{}",
    env_json: '{"AFL_SKIP_CPUFREQ":"1"}',
    fuzzer_args_text: "-m none -t 1000+",
    node_name: "",
    operation_id: "",
    notes: "",
    dry_run: true,
    risk_feedback_enabled: true,
    risk_schedule_enabled: true,
  });
  const [buildForm, setBuildForm] = useState<BuildTaskComposerState>({
    protocol: "legacy-default",
    mode: "structured",
    source_ref: "",
    source_root: "",
    build_root_ref: "",
    build_root: "",
    build_system: "cmake",
    compiler: "afl-clang-fast",
    build_type: "RelWithDebInfo",
    generator: "",
    build_target: "",
    parallelism: "4",
    extra_cflags: "",
    extra_cxxflags: "",
    extra_ldflags: "",
    expected_outputs_text: "",
    target_io_hint: "unknown",
    configure_command_text: "",
    build_command_text: "",
    post_build_commands_text: "",
    direct_commands_text: "",
  });

  useEffect(() => {
    dockLog("info", "job", "entered jobs workspace", { tab, composeMode });
    return () => dockLog("info", "job", "left jobs workspace");
  }, [tab, composeMode]);

  const protocolsQuery = useQuery({ queryKey: ["protocols"], queryFn: protocolsApi.listProtocols, retry: 0 });
  const fuzzProbeQuery = useQuery({
    queryKey: ["build-probe", "fuzz", fuzzForm.protocol],
    queryFn: () => buildAssistantApi.probe(fuzzForm.protocol),
    enabled: Boolean(fuzzForm.protocol),
    staleTime: 10_000,
  });
  const buildProbeQuery = useQuery({
    queryKey: ["build-probe", "build", buildForm.protocol],
    queryFn: () => buildAssistantApi.probe(buildForm.protocol),
    enabled: Boolean(buildForm.protocol),
    staleTime: 10_000,
  });
  const launchProfilesQuery = useQuery({
    queryKey: ["launch-profiles", fuzzForm.protocol],
    queryFn: () => buildAssistantApi.listLaunchProfiles(fuzzForm.protocol),
    enabled: Boolean(fuzzForm.protocol),
  });
  const targetsQuery = useQuery({
    queryKey: ["build-targets", fuzzForm.protocol],
    queryFn: () => buildAssistantApi.listTargets(fuzzForm.protocol),
    enabled: Boolean(fuzzForm.protocol),
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
    const probe = fuzzProbeQuery.data;
    if (!probe) return;
    setFuzzForm((current) => ({ ...current, protocol: probe.protocol || current.protocol }));
  }, [fuzzProbeQuery.data]);

  useEffect(() => {
    const probe = buildProbeQuery.data;
    if (!probe) return;
    setBuildForm((current) => ({
      ...current,
      protocol: probe.protocol || current.protocol,
      source_ref: current.source_ref || probe.source_ref || "",
      build_root_ref: current.build_root_ref || probe.build_root_ref || "",
      build_system: current.build_system || uniqueBuildSystems(probe)[0] || "cmake",
      compiler: current.compiler || probe.allowed_compilers?.[0] || "afl-clang-fast",
    }));
  }, [buildProbeQuery.data]);

  useEffect(() => {
    if (fuzzForm.risk_feedback_enabled) return;
    setFuzzForm((current) => (current.risk_schedule_enabled ? { ...current, risk_schedule_enabled: false } : current));
  }, [fuzzForm.risk_feedback_enabled]);

  const jobs = jobsQuery.data ?? [];
  const summary = summaryQuery.data;
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
    () => (launchProfilesQuery.data ?? []).find((item) => item.profile_id === fuzzForm.launch_profile_id),
    [fuzzForm.launch_profile_id, launchProfilesQuery.data],
  );
  const targetOptions = targetsQuery.data ?? [];
  const selectedTarget = useMemo(
    () => targetOptions.find((item) => item.target_id === fuzzForm.selected_target_id) ?? null,
    [fuzzForm.selected_target_id, targetOptions],
  );
  const runtimeTools = fuzzProbeQuery.data?.runtime_tools?.length ? fuzzProbeQuery.data.runtime_tools : runtimeToolFallback;
  const selectedRuntimeTool = useMemo<RuntimeToolDefinition | null>(
    () => runtimeTools.find((item) => item.tool_id === fuzzForm.afl_path) ?? runtimeTools[0] ?? null,
    [fuzzForm.afl_path, runtimeTools],
  );

  useEffect(() => {
    if (!selectedTarget) return;
    setFuzzForm((current) => ({
      ...current,
      target_binary: current.selected_target_id === selectedTarget.target_id ? (current.target_binary || selectedTarget.binary_ref) : current.target_binary,
      cwd: current.selected_target_id === selectedTarget.target_id ? (current.cwd || selectedTarget.cwd_ref) : current.cwd,
    }));
  }, [selectedTarget]);

  const effectiveRuntimeEnv = useMemo(
    () => buildEffectiveEnv(parseKeyValues(fuzzForm.env_json), { riskFeedbackEnabled: fuzzForm.risk_feedback_enabled, riskScheduleEnabled: fuzzForm.risk_schedule_enabled }),
    [fuzzForm.env_json, fuzzForm.risk_feedback_enabled, fuzzForm.risk_schedule_enabled],
  );
  const effectiveFuzzerArgs = useMemo(
    () => buildEffectiveAflArgs(parseCommand(fuzzForm.fuzzer_args_text), { scheduler: fuzzForm.scheduler, timeoutSec: fuzzForm.timeout_sec, memoryLimitMb: fuzzForm.memory_limit_mb }),
    [fuzzForm.fuzzer_args_text, fuzzForm.memory_limit_mb, fuzzForm.scheduler, fuzzForm.timeout_sec],
  );

  const fuzzPayload = useMemo<JobCreateRequest>(() => ({
    protocol: fuzzForm.protocol || "legacy-default",
    cwd: fuzzForm.cwd || undefined,
    target_cmd: [selectedTarget?.binary_ref || fuzzForm.target_binary, ...parseCommand(fuzzForm.target_args)].filter(Boolean),
    afl_path: fuzzForm.afl_path || "afl-fuzz",
    input_dir: fuzzForm.input_dir || undefined,
    output_dir: fuzzForm.output_dir || undefined,
    timeout_sec: Number(fuzzForm.timeout_sec || 0) || undefined,
    memory_limit_mb: fuzzForm.memory_limit_mb === "none" ? undefined : Number(fuzzForm.memory_limit_mb || 0) || undefined,
    workers: Number(fuzzForm.workers || 1) || 1,
    scheduler: fuzzForm.scheduler === "auto" ? undefined : fuzzForm.scheduler,
    risk_enabled: fuzzForm.risk_feedback_enabled,
    risk_feedback_enabled: fuzzForm.risk_feedback_enabled,
    risk_schedule_enabled: fuzzForm.risk_feedback_enabled && fuzzForm.risk_schedule_enabled,
    node_name: fuzzForm.node_name || undefined,
    notes: fuzzForm.notes || undefined,
    operation_id: fuzzForm.operation_id || undefined,
    launch_profile_id: fuzzForm.launch_profile_id || undefined,
    fuzzer_args: effectiveFuzzerArgs,
    env: effectiveRuntimeEnv,
    dry_run: fuzzForm.dry_run,
    debug: {
      transport_type: fuzzForm.transport_type,
      transport_config: parseKeyValues(fuzzForm.transport_config_json),
    },
  }), [effectiveFuzzerArgs, effectiveRuntimeEnv, fuzzForm, selectedTarget]);

  const sanitizedDirectCommands = useMemo(
    () => sanitizeBuildCommandLines(buildForm.direct_commands_text),
    [buildForm.direct_commands_text],
  );

  const buildPayload = useMemo<BuildPlanCreatePayload>(() => ({
    mode: buildForm.mode,
    protocol: buildForm.protocol || "legacy-default",
    source_ref: buildForm.source_ref || undefined,
    source_root: buildForm.source_root || undefined,
    build_root_ref: buildForm.build_root_ref || undefined,
    build_root: buildForm.build_root || undefined,
    build_system: buildForm.build_system || undefined,
    compiler: buildForm.compiler || undefined,
    build_type: buildForm.build_type || undefined,
    generator: buildForm.generator || undefined,
    build_target: buildForm.build_target || undefined,
    parallelism: Number(buildForm.parallelism || 4) || 4,
    extra_cflags: buildForm.extra_cflags || undefined,
    extra_cxxflags: buildForm.extra_cxxflags || undefined,
    extra_ldflags: buildForm.extra_ldflags || undefined,
    expected_outputs: splitLines(buildForm.expected_outputs_text),
    target_io_hint: buildForm.target_io_hint,
    command_lines: buildForm.mode === "direct_commands" ? sanitizedDirectCommands.acceptedLines : undefined,
    configure_command_text: buildForm.mode === "structured" ? buildForm.configure_command_text || undefined : undefined,
    build_command_text: buildForm.mode === "structured" ? buildForm.build_command_text || undefined : undefined,
    post_build_commands_text: buildForm.mode === "structured" ? buildForm.post_build_commands_text || undefined : undefined,
  }), [buildForm, sanitizedDirectCommands.acceptedLines]);

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
    mutationFn: () => buildAssistantApi.createPlan(buildForm.protocol, buildPayload),
    onSuccess: (plan) => dockLog("success", "job", `build plan ready: ${plan.plan_id}`, { protocol: plan.protocol, mode: plan.mode }),
    onError: (error) => dockLog("error", "job", "build plan create failed", error),
  });

  const buildRunMutation = useMutation({
    mutationFn: () => {
      const planId = buildPlanMutation.data?.plan_id;
      if (!planId) throw new Error("missing build plan id");
      return buildAssistantApi.runPlan(buildForm.protocol, planId);
    },
    onSuccess: async (run) => {
      dockLog("success", "job", `build run finished: ${run.build_id}`, { targets: run.targets.length, status: run.status });
      await Promise.all([targetsQuery.refetch(), launchProfilesQuery.refetch()]);
      if (run.targets[0]) {
        setComposeMode("fuzz");
        setFuzzForm((current) => ({
          ...current,
          protocol: buildForm.protocol,
          selected_target_id: run.targets[0].target_id,
          target_binary: run.targets[0].binary_ref,
          cwd: run.targets[0].cwd_ref,
        }));
      }
    },
    onError: (error) => dockLog("error", "job", "build run failed", error),
  });

  const predictProfileMutation = useMutation({
    mutationFn: () =>
      buildAssistantApi.predictLaunchProfile(fuzzForm.protocol, {
        target_id: fuzzForm.selected_target_id,
        build_id: undefined,
        afl_tool_id: fuzzForm.afl_path || "afl-fuzz",
        input_ref: fuzzForm.input_dir || undefined,
        dict_ref: undefined,
        scheduler: fuzzForm.scheduler,
        timeout: fuzzForm.timeout_sec,
        memory_limit: fuzzForm.memory_limit_mb,
        risk_enabled: fuzzForm.risk_feedback_enabled,
        risk_feedback_enabled: fuzzForm.risk_feedback_enabled,
        risk_schedule_enabled: fuzzForm.risk_feedback_enabled && fuzzForm.risk_schedule_enabled,
        env: effectiveRuntimeEnv,
        extra_afl_args: effectiveFuzzerArgs,
        target_args: parseCommand(fuzzForm.target_args),
      }),
    onSuccess: async (profile) => {
      dockLog("success", "job", `launch profile predicted: ${profile.profile_id}`, { afl_tool_id: profile.afl_tool_id, runner_compatible: profile.runner_compatible });
      setFuzzForm((current) => ({ ...current, launch_profile_id: profile.profile_id }));
      await launchProfilesQuery.refetch();
    },
    onError: (error) => dockLog("error", "job", "predict launch profile failed", error),
  });

  const localCommandPreview = useMemo(
    () => estimateToolCommand({
      tool: selectedRuntimeTool,
      targetBinary: selectedTarget?.binary_ref || fuzzForm.target_binary,
      targetArgs: parseCommand(fuzzForm.target_args),
      inputDir: fuzzForm.input_dir,
      outputDir: fuzzForm.output_dir,
      singleInput: fuzzForm.single_input_ref,
      scheduler: fuzzForm.scheduler,
      timeoutSec: fuzzForm.timeout_sec,
      memoryLimitMb: fuzzForm.memory_limit_mb,
      fuzzerArgs: parseCommand(fuzzForm.fuzzer_args_text),
    }),
    [fuzzForm, selectedRuntimeTool, selectedTarget],
  );

  const runnerReadyProfile = predictProfileMutation.data ?? selectedProfile;
  const fuzzWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (!fuzzPayload.protocol) warnings.push("需要指定 protocol 才能生成任务。");
    if (selectedRuntimeTool?.requires_target && !fuzzForm.target_binary && !selectedTarget && !fuzzPayload.launch_profile_id) {
      warnings.push("当前 AFL 工具需要 target binary；请填写目标程序或从已有目标产物中选择。");
    }
    if (selectedRuntimeTool?.input_kind === "directory" && !fuzzForm.input_dir) warnings.push("该工具需要输入目录。");
    if ((selectedRuntimeTool?.input_kind ?? "").includes("single_file") && !fuzzForm.single_input_ref) warnings.push("该工具需要单个 testcase 路径。");
    if (selectedRuntimeTool?.output_kind !== "none" && !fuzzForm.output_dir) warnings.push("建议填写 output 路径，避免输出结果丢失。");
    if (fuzzForm.task_kind === "runtime" && !fuzzForm.launch_profile_id && !fuzzForm.dry_run) warnings.push("正式执行建议先生成或选择 LaunchProfile。");
    if (runnerReadyProfile?.runner_compatible === false && !fuzzForm.dry_run) warnings.push("当前 LaunchProfile 不兼容实时 Runner；请改为 dry run 或转到宿主机执行命令建议。");
    if (selectedRuntimeTool && !selectedRuntimeTool.runner_compatible && !fuzzForm.dry_run) warnings.push("当前 AFL 工具属于一次性辅助工具，不建议作为长期 Runner 任务。");
    return warnings.map((item) => item.trim()).filter(Boolean);
  }, [fuzzPayload.launch_profile_id, fuzzPayload.protocol, fuzzForm.dry_run, fuzzForm.input_dir, fuzzForm.launch_profile_id, fuzzForm.output_dir, fuzzForm.single_input_ref, fuzzForm.target_binary, fuzzForm.task_kind, runnerReadyProfile?.runner_compatible, selectedRuntimeTool, selectedTarget]);

  const buildWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (!buildPayload.protocol) warnings.push("构建任务需要 protocol。");
    if (!buildPayload.source_ref) warnings.push("建议指定 source_ref，确保后端只在协议源码工作区内解析构建步骤。");
    if (buildPayload.mode === "direct_commands" && !(buildPayload.command_lines ?? []).length) warnings.push("直接命令模式下，过滤后没有任何可发送的构建命令。");
    if (buildPayload.mode === "structured" && !deriveStructuredCommands(buildForm).length) warnings.push("当前表单模式还无法推导出可执行 steps，请补充 configure/build 命令或选择可识别的 build system。");
    return warnings.map((item) => item.trim()).filter(Boolean);
  }, [buildForm, buildPayload]);

  const canSubmitJob = useMemo(() => {
    if (selectedRuntimeTool && !selectedRuntimeTool.runner_compatible && !fuzzForm.dry_run) return false;
    if (fuzzForm.task_kind === "runtime" && !fuzzForm.dry_run && !fuzzForm.launch_profile_id) return false;
    if (selectedRuntimeTool?.requires_target && !fuzzForm.target_binary && !selectedTarget && !fuzzForm.launch_profile_id) return false;
    if (selectedRuntimeTool?.input_kind === "directory" && !fuzzForm.input_dir) return false;
    if ((selectedRuntimeTool?.input_kind ?? "").includes("single_file") && !fuzzForm.single_input_ref) return false;
    return true;
  }, [fuzzForm, selectedRuntimeTool, selectedTarget]);

  const fuzzProfileSummary = [
    { label: "protocol", value: fuzzForm.protocol || "legacy-default" },
    { label: "任务类型", value: fuzzForm.task_kind === "runtime" ? "实时 Fuzz 任务" : "AFL 辅助工具" },
    { label: "AFL tool", value: selectedRuntimeTool?.tool_id ?? fuzzForm.afl_path },
    { label: "launch profile", value: selectedProfile?.profile_id ?? predictProfileMutation.data?.profile_id ?? "未生成" },
    { label: "runner 兼容", value: runnerReadyProfile?.runner_compatible === false ? "仅建议命令" : "可进入正式 Runner" },
    { label: "target", value: (selectedTarget?.name ?? fuzzForm.target_binary) || "—" },
  ];

  const buildProfileSummary = [
    { label: "protocol", value: buildForm.protocol || "legacy-default" },
    { label: "mode", value: buildForm.mode },
    { label: "build system", value: buildForm.build_system || "manual" },
    { label: "compiler", value: buildForm.compiler || "—" },
    { label: "target io", value: buildForm.target_io_hint },
    { label: "expected outputs", value: String(splitLines(buildForm.expected_outputs_text).length) },
  ];

  const fuzzCommandBlocks = useMemo(() => {
    const blocks: Array<{ title: string; command: string; env?: string; note?: string }> = [];
    if (runnerReadyProfile?.command_preview?.length) {
      blocks.push({
        title: runnerReadyProfile.runner_compatible === false ? "LaunchProfile 侧栏建议" : "Runner 目标命令",
        command: runnerReadyProfile.command_preview.join(" "),
        env: joinEnvPreview(runnerReadyProfile.env),
        note: runnerReadyProfile.binary_ref,
      });
    }
    if (localCommandPreview.length) {
      blocks.push({
        title: fuzzForm.task_kind === "runtime" ? "本地参数预估" : "辅助工具预估命令",
        command: localCommandPreview.join(" "),
        env: joinEnvPreview(fuzzPayload.env),
        note: selectedTarget?.cwd_ref || fuzzForm.cwd || undefined,
      });
    }
    return blocks;
  }, [fuzzForm.cwd, fuzzForm.task_kind, fuzzPayload.env, localCommandPreview, runnerReadyProfile, selectedTarget?.cwd_ref]);

  const buildPreviewSteps = useMemo(() => {
    if (buildForm.mode === "direct_commands") {
      return sanitizedDirectCommands.acceptedLines.map((command, index) => ({ title: `command ${index + 1}`, cwd: buildPayload.build_root_ref || buildPayload.source_ref, command }));
    }
    return deriveStructuredCommands(buildForm);
  }, [buildForm, buildPayload.build_root_ref, buildPayload.source_ref, sanitizedDirectCommands.acceptedLines]);

  const buildCommandBlocks = useMemo(() => {
    const serverSteps = buildPlanMutation.data?.steps ?? [];
    if (serverSteps.length) {
      return serverSteps.map((step, index) => ({ title: `BuildPlan · Step ${index + 1} · ${step.name}`, command: step.argv.join(" "), env: joinEnvPreview(step.env), note: step.cwd_ref }));
    }
    return buildPreviewSteps.map((item) => ({ title: `Build 预估 · ${item.title}`, command: item.command, note: item.cwd }));
  }, [buildPlanMutation.data?.steps, buildPreviewSteps]);

  const fuzzAssistantNotes = useMemo(() => {
    const notes = new Set<string>();
    selectedRuntimeTool?.notes?.forEach((item) => notes.add(item));
    runnerReadyProfile?.warnings?.forEach((item) => notes.add(item));
    runnerReadyProfile?.explanation?.forEach((item) => notes.add(item));
    return Array.from(notes);
  }, [runnerReadyProfile, selectedRuntimeTool]);

  const buildAssistantNotes = useMemo(() => {
    const notes = new Set<string>();
    buildPlanMutation.data?.warnings?.forEach((item) => notes.add(item));
    buildRunMutation.data?.warnings?.forEach((item) => notes.add(item));
    if (buildForm.mode === "direct_commands" && sanitizedDirectCommands.droppedLines.length) {
      notes.add(`前端已丢弃 ${sanitizedDirectCommands.droppedLines.length} 条明显非构建命令；后端仍会再次校验。`);
    }
    return Array.from(notes);
  }, [buildForm.mode, buildPlanMutation.data?.warnings, buildRunMutation.data?.warnings, sanitizedDirectCommands.droppedLines.length]);

  const tabMetrics = {
    compose: String((launchProfilesQuery.data ?? []).length),
    list: `${jobs.length}/${summary?.running ?? 0}`,
    monitor: `${monitorQuery.data?.recent_artifacts?.length ?? 0}/${monitorQuery.data?.alert_timeline?.length ?? 0}`,
  } satisfies Record<JobsFlowTabKey, string>;

  const submitJob = (): void => {
    dockLog("info", "job", "submit job payload", fuzzPayload);
    createMutation.mutate(fuzzPayload);
  };

  return (
    <div className="space-y-5">
      <ApiErrorReporter error={protocolsQuery.error} title="加载协议列表失败" source="job" />
      <ApiErrorReporter error={fuzzProbeQuery.error} title="加载 Fuzz Build Probe 失败" source="job" />
      <ApiErrorReporter error={buildProbeQuery.error} title="加载 Build Probe 失败" source="job" />
      <ApiErrorReporter error={launchProfilesQuery.error} title="加载 LaunchProfile 失败" source="job" />
      <ApiErrorReporter error={targetsQuery.error} title="加载已识别目标失败" source="job" />
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
        description="将任务创建、检索与运行态监控拆分成三种工作流；创建页内部再明确拆成 Fuzz / AFL 与 Build 两个一级面板。"
        boardClassName="[--board-surface:276_100%_98%] [--board-border:274_54%_85%] [--board-track:274_55%_92%] [--board-accent-soft:276_92%_95%] [--board-accent:272_68%_56%] [--board-accent-strong:268_74%_44%] dark:[--board-surface:263_28%_19%] dark:[--board-border:267_32%_34%] dark:[--board-track:263_20%_28%] dark:[--board-accent-soft:268_34%_28%] dark:[--board-accent:278_85%_73%] dark:[--board-accent-strong:286_92%_82%]"
        board={<JobsStatusBoard summary={summary} />}
      />

      <JobsFlowTabs value={tab} onChange={setTab} metrics={tabMetrics} />

      {tab === "compose" ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_32rem]">
          <div className="space-y-4">
            <Card className="card-surface">
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Boxes className="size-4.5" /> 任务创建入口</CardTitle></CardHeader>
              <CardContent>
                <Tabs value={composeMode} onValueChange={(next) => setComposeMode(next as "fuzz" | "build")}>
                  <TabsList>
                    <TabsTrigger value="fuzz">Fuzz / AFL 任务</TabsTrigger>
                    <TabsTrigger value="build">构建任务</TabsTrigger>
                  </TabsList>
                  <TabsContent value="fuzz">
                    <JobComposerSections
                      value={fuzzForm}
                      onChange={(patch) => setFuzzForm((current) => ({ ...current, ...patch }))}
                      protocols={protocolOptions}
                      launchProfiles={launchProfilesQuery.data ?? []}
                      runtimeTools={runtimeTools}
                      targetOptions={targetOptions}
                      selectedRuntimeTool={selectedRuntimeTool}
                    />
                  </TabsContent>
                  <TabsContent value="build">
                    <BuildTaskComposerSections
                      value={buildForm}
                      onChange={(patch) => setBuildForm((current) => ({ ...current, ...patch }))}
                      buildSystems={uniqueBuildSystems(buildProbeQuery.data)}
                      compilers={buildProbeQuery.data?.allowed_compilers?.length ? buildProbeQuery.data.allowed_compilers : ["afl-clang-fast", "afl-cc", "clang", "clang++", "gcc", "g++"]}
                      directCommandSanitize={sanitizedDirectCommands}
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {composeMode === "fuzz" ? (
              <Card className="card-surface">
                <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><GitBranchPlus className="size-4.5" /> Fuzz 闭环动作</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Button type="button" variant="secondary" onClick={() => predictProfileMutation.mutate()} disabled={predictProfileMutation.isPending || !fuzzForm.selected_target_id}>
                      <Wrench className="size-4" />
                      {predictProfileMutation.isPending ? "生成中..." : "生成 LaunchProfile 草案"}
                    </Button>
                    <Button onClick={submitJob} disabled={createMutation.isPending || !canSubmitJob}>
                      {createMutation.isPending ? "提交中..." : fuzzForm.dry_run ? "执行校验" : "启动任务"}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Fuzz 页只负责运行配置与已有目标绑定；需要生成构建产物时，请切到“构建任务”卡片完成 BuildPlan 与 BuildRun。
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card className="card-surface">
                <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Hammer className="size-4.5" /> 构建闭环动作</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Button type="button" variant="secondary" onClick={() => buildPlanMutation.mutate()} disabled={buildPlanMutation.isPending || buildWarnings.length > 0}>
                      <Hammer className="size-4" />
                      {buildPlanMutation.isPending ? "生成中..." : "生成 BuildPlan"}
                    </Button>
                    <Button type="button" onClick={() => buildRunMutation.mutate()} disabled={buildRunMutation.isPending || !buildPlanMutation.data?.plan_id}>
                      <TerminalSquare className="size-4" />
                      {buildRunMutation.isPending ? "构建中..." : "运行 BuildPlan"}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    构建页只负责表达真实构建步骤与产物；构建成功后，会把首个识别到的目标带回 Fuzz 页作为默认运行目标。
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          <JobLaunchPreviewPanel
            payload={composeMode === "fuzz" ? fuzzPayload : buildPayload}
            warnings={composeMode === "fuzz" ? fuzzWarnings : buildWarnings}
            profileSummary={composeMode === "fuzz" ? fuzzProfileSummary : buildProfileSummary}
            commandBlocks={composeMode === "fuzz" ? fuzzCommandBlocks : buildCommandBlocks}
            assistantNotes={composeMode === "fuzz" ? fuzzAssistantNotes : buildAssistantNotes}
            buildPreview={composeMode === "build" ? {
              mode: buildForm.mode,
              steps: buildPreviewSteps,
              acceptedCommandLines: sanitizedDirectCommands.acceptedLines,
              droppedLines: sanitizedDirectCommands.droppedLines,
              expectedOutputs: splitLines(buildForm.expected_outputs_text),
              targetIoHint: buildForm.target_io_hint,
            } : undefined}
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
          <JobsMonitoringOverview
            activity={monitorQuery.data}
            jobs={jobs}
            selectedJobId={selectedMonitorJobId}
            focusedJob={jobs.find((job) => job.job_id === selectedMonitorJobId)}
            focusedMetrics={monitorQuery.data?.selected_job_metrics ?? null}
            focusedMetricsHistory={selectedMonitorJobHistory}
            onSelectJob={(jobId) => {
              setSelectedMonitorJobId(jobId);
              dockLog("info", "job", `inspect monitor job ${jobId}`);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

import { formatDateTime, parseCommandInput, parseJsonObject } from "@/lib/utils/format";
import type {
  DebugCandidate,
  DebugFrame,
  DebugLiveSession,
  DebugLocal,
  DebugOutputStreams,
  DebugPrepStep,
  DebugRegister,
  DebugSession,
  DebugSessionRequest,
} from "@/types/api/debug";
import type { DebugLaunchFormState, DebugUiState, MonitorViewModel } from "@/features/debug/debug-types";

export const DEBUG_SECTIONS = ["launch", "monitor", "history", "archive"] as const;
export const DEBUG_STAGE_ORDER = ["created", "launching_target", "replaying_input", "waiting_signal", "collecting_context", "llm_reasoning", "locate_line", "classified", "archived", "failed"] as const;

const STATUS_DESCRIPTIONS: Record<string, string> = {
  created: "会话已登记，等待启动目标与 crash 回放。",
  launching_target: "正在准备目标程序与运行目录。",
  replaying_input: "正在回放 crash 输入并构造调试现场。",
  waiting_signal: "目标程序已经启动，正在等待异常信号。",
  collecting_context: "已捕获异常，正在采集调用栈、寄存器和局部变量。",
  llm_reasoning: "结构化上下文已就绪，正在形成根因推断。",
  locate_line: "已经锁定到主要源码位置，正在整理落点。",
  classified: "根因与分类结论已经形成，等待归档。",
  archived: "当前调试结果已完成归档，可以回填复用。",
  failed: "调试会话执行失败，请检查目标环境与调试参数。",
};

const TIMELINE_SPECS = [
  { key: "created", label: "创建", description: "登记会话与 crash 目标。" },
  { key: "started", label: "启动", description: "目标程序与回放流程已开始。" },
  { key: "captured", label: "捕获异常", description: "已拿到信号或聚焦 frame。" },
  { key: "evidence", label: "收集证据", description: "调用栈、寄存器与局部变量已采集。" },
  { key: "located", label: "定位代码", description: "已锁定源码行与关联文件。" },
  { key: "archived", label: "归档", description: "结果已沉淀到历史记录。" },
] as const;

const KEY_REGISTER_NAMES = ["rip", "eip", "pc", "rsp", "esp", "rbp", "ebp", "sp", "lr"];

interface LogTailItem {
  kind?: string;
  stage?: string;
  message?: string;
  data?: Record<string, unknown>;
}

export function initialLaunchForm(): DebugLaunchFormState {
  return {
    artifact_path: "",
    artifact_id: "",
    binary_path: "",
    cwd: "",
    args_text: "",
    env_json: "{}",
    transport_type: "stdin",
    transport_config_json: "{}",
    startup_timeout: "3",
    ready_check_json: "{}",
    kb_entry_ids_text: "",
    source_doc_ids_text: "",
    replay_mode: "builtin_transport",
    replay_script_ref: "",
    replay_runtime: "python3",
    replay_args_text: "",
    replay_env_json: "{}",
    replay_timeout: "10",
    prep_steps_text: "",
  };
}

export function initialDebugUiState(): DebugUiState {
  return {
    protocol: "",
    section: "launch",
    launchForm: initialLaunchForm(),
    refillDraft: null,
  };
}

export function textValue(value: unknown, fallback = "未解析"): string {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text ? text : fallback;
}

export function emptyToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function splitTextList(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isLikelyDirectoryPath(path: string): boolean {
  const trimmed = path.trim();
  if (!trimmed) return false;
  return /[\\/]$/.test(trimmed) || /[\\/](inputs?|crashes?|queue|seeds?)[\\/]?$/i.test(trimmed);
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

export function candidateToRequest(candidate?: DebugCandidate | null): DebugSessionRequest | undefined {
  if (!candidate) return undefined;
  return candidate.debug_session_request ?? (candidate.seed_path || candidate.path
    ? {
        protocol: candidate.protocol ?? "",
        artifact_path: candidate.seed_path ?? candidate.path ?? "",
        artifact_id: candidate.artifact_id,
        job_id: candidate.job_id,
        target: candidate.target ?? {},
      }
    : undefined);
}

function stringifyPrepSteps(steps?: DebugPrepStep[]): string {
  if (!steps?.length) return "";
  return steps.map((step) => JSON.stringify(step)).join("\n");
}

function parsePrepSteps(text: string): DebugPrepStep[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.startsWith("{")) {
        const parsed = parseJsonObject(line);
        const argv = Array.isArray(parsed.argv) ? parsed.argv.map((item) => String(item)).filter(Boolean) : [];
        return {
          argv,
          cwd: typeof parsed.cwd === "string" ? parsed.cwd : undefined,
          env: parsed.env && typeof parsed.env === "object" && !Array.isArray(parsed.env)
            ? Object.fromEntries(Object.entries(parsed.env as Record<string, unknown>).map(([key, value]) => [key, String(value)]))
            : undefined,
        } satisfies DebugPrepStep;
      }
      return { argv: parseCommandInput(line) } satisfies DebugPrepStep;
    })
    .filter((item) => item.argv.length);
}

export function formFromRequest(request?: DebugSessionRequest): Partial<DebugLaunchFormState> {
  if (!request) return {};
  return {
    artifact_path: request.artifact_path ?? "",
    artifact_id: request.artifact_id ?? "",
    binary_path: textValue(request.target?.binary_path, "").replace(/^未解析$/, ""),
    cwd: textValue(request.target?.cwd, "").replace(/^未解析$/, ""),
    args_text: Array.isArray(request.target?.args) ? request.target.args.join(" ") : "",
    env_json: JSON.stringify(request.target?.env ?? {}, null, 2),
    transport_type: textValue(request.target?.transport_type, "stdin"),
    transport_config_json: JSON.stringify(request.target?.transport_config ?? {}, null, 2),
    startup_timeout: request.target?.startup_timeout !== undefined ? String(request.target.startup_timeout) : "3",
    ready_check_json: JSON.stringify(request.target?.ready_check ?? {}, null, 2),
    kb_entry_ids_text: Array.isArray(request.kb_entry_ids) ? request.kb_entry_ids.join("\n") : "",
    source_doc_ids_text: Array.isArray(request.source_doc_ids) ? request.source_doc_ids.join("\n") : "",
  };
}

export function applyFormDraft(current: DebugLaunchFormState, draft?: Partial<DebugLaunchFormState> | null): DebugLaunchFormState {
  if (!draft) return current;
  return { ...current, ...draft };
}

export function buildCreatePayload(protocol: string, form: DebugLaunchFormState, base?: Partial<DebugSessionRequest>): DebugSessionRequest {
  const replayMode = form.replay_mode === "script" ? "script" : "builtin_transport";
  const replayArgs = parseCommandInput(form.replay_args_text);
  const replayEnv = Object.fromEntries(Object.entries(parseJsonObject(form.replay_env_json)).map(([key, value]) => [key, String(value)]));
  const prepSteps = parsePrepSteps(form.prep_steps_text);
  return {
    operation_id: base?.operation_id,
    protocol: protocol.trim(),
    artifact_path: form.artifact_path.trim(),
    artifact_id: emptyToUndefined(form.artifact_id) ?? base?.artifact_id,
    job_id: emptyToUndefined(String(base?.job_id ?? "")) ?? undefined,
    kb_entry_ids: splitTextList(form.kb_entry_ids_text),
    source_doc_ids: splitTextList(form.source_doc_ids_text),
    run_mode: base?.run_mode ?? "async",
    analysis_mode: base?.analysis_mode ?? "locate_only",
    target: {
      ...(base?.target ?? {}),
      binary_path: form.binary_path.trim(),
      cwd: emptyToUndefined(form.cwd),
      args: parseCommandInput(form.args_text),
      env: Object.fromEntries(Object.entries(parseJsonObject(form.env_json)).map(([key, value]) => [key, String(value)])),
      protocol: protocol.trim(),
      transport_type: form.transport_type.trim(),
      transport_config: parseJsonObject(form.transport_config_json),
      startup_timeout: Number(form.startup_timeout || 3),
      ready_check: parseJsonObject(form.ready_check_json),
    },
    replay: replayMode === "script" ? {
      mode: "script",
      script_ref: emptyToUndefined(form.replay_script_ref),
      runtime: form.replay_runtime,
      args: replayArgs,
      env: replayEnv,
      timeout_sec: Number(form.replay_timeout || 10),
    } : { mode: "builtin_transport" },
    prep_steps: prepSteps,
  };
}

export function parseWorkspaceRef(value?: string | null): { protocol: string; scope: string; virtualPath: string } | null {
  const ref = String(value ?? "").trim();
  const match = /^workspace:\/\/([^/]+)\/([^/]+)(\/.*)?$/.exec(ref);
  if (!match) return null;
  return { protocol: match[1], scope: match[2], virtualPath: match[3] || "/" };
}

export function statusDescription(status?: string): string {
  return STATUS_DESCRIPTIONS[status ?? ""] ?? "调试会话状态已更新。";
}

export function isTerminalStatus(status?: string): boolean {
  return ["archived", "failed"].includes(String(status ?? ""));
}

function formatLocationLabel(frame?: DebugFrame | null): string {
  if (!frame) return "未定位";
  const fn = textValue(frame.function, "unknown");
  const file = textValue(frame.file_path || frame.library, "未解析");
  const line = typeof frame.line === "number" ? `:${frame.line}` : "";
  const index = frame.index !== undefined ? `#${frame.index}` : "#?";
  return `${index} · ${fn} · ${file}${line}`;
}

function stageRank(status?: string): number {
  const normalized = String(status ?? "created");
  return Math.max(0, DEBUG_STAGE_ORDER.findIndex((item) => item === normalized));
}

function hasCapturedSignal(session?: DebugSession | null, live?: DebugLiveSession | null): boolean {
  return Boolean(
    live?.current_focus?.signal ||
    session?.current_focus?.signal ||
    live?.latest_evidence_summary?.signal ||
    session?.latest_evidence_summary?.signal ||
    stageRank(live?.status ?? session?.status) >= stageRank("collecting_context")
  );
}

function hasEvidence(session?: DebugSession | null, live?: DebugLiveSession | null): boolean {
  return Boolean(
    (live?.frames?.length || session?.gdb_context?.frames?.length || 0) > 0 ||
    (live?.registers_map?.length || session?.gdb_context?.registers_map?.length || 0) > 0 ||
    (live?.locals_map?.length || session?.gdb_context?.locals_map?.length || 0) > 0 ||
    stageRank(live?.status ?? session?.status) >= stageRank("collecting_context")
  );
}

function hasLocation(session?: DebugSession | null, live?: DebugLiveSession | null): boolean {
  const location = asRecord(live?.location_result) ?? asRecord(session?.debug_report?.location_result);
  return Boolean(location?.primary_file_path || location?.primary_line || stageRank(live?.status ?? session?.status) >= stageRank("locate_line"));
}

export function extractFrames(session?: DebugSession | null, live?: DebugLiveSession | null): DebugFrame[] {
  return (live?.frames?.length ? live.frames : session?.gdb_context?.frames) ?? [];
}

export function extractLocals(session?: DebugSession | null, live?: DebugLiveSession | null): DebugLocal[] {
  return (live?.locals_map?.length ? live.locals_map : session?.gdb_context?.locals_map) ?? [];
}

export function extractRegisters(session?: DebugSession | null, live?: DebugLiveSession | null): DebugRegister[] {
  return (live?.registers_map?.length ? live.registers_map : session?.gdb_context?.registers_map) ?? [];
}

function extractOutputStreams(session?: DebugSession | null, live?: DebugLiveSession | null): DebugOutputStreams | null {
  return live?.output_streams ?? session?.gdb_context?.output_streams ?? null;
}

function buildOutput(session?: DebugSession | null, live?: DebugLiveSession | null, logItems: LogTailItem[] = []): MonitorViewModel["output"] {
  const streams = extractOutputStreams(session, live);
  const gdbLog = logItems
    .filter((item) => ["gdb", "stream"].includes(String(item.kind ?? "")))
    .map((item) => String(item.message ?? "").trim())
    .filter(Boolean)
    .join("\n");

  const targetOutputAvailable = Boolean(streams?.can_separate_target_output);
  const targetOutputParts = [streams?.target_stdout, streams?.target_stderr]
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
  const targetOutput = targetOutputAvailable
    ? (targetOutputParts.join("\n\n") || "当前目标程序没有可显示的 stdout/stderr。")
    : "当前调试链路运行在 gdb batch 模式下，无法可靠区分 target stdout/stderr 与 GDB transcript；下方已回退展示调试混合输出。";

  const gdbTranscript = [
    streams?.gdb_transcript,
    gdbLog,
    session?.gdb_context?.backtrace,
    session?.gdb_context?.frame_locals,
    session?.gdb_context?.registers,
    session?.gdb_context?.shared_libraries_text,
    streams?.mixed_output,
  ]
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .join("\n\n") || "暂无 GDB transcript";

  const argv = Array.isArray(session?.gdb_context?.target_argv) ? session!.gdb_context!.target_argv!.map((item) => String(item)) : [];
  return {
    targetOutput,
    gdbTranscript,
    argv,
    targetOutputAvailable,
    targetOutputDisclaimer: targetOutputAvailable
      ? "当前内容来自已分离的 target stdout/stderr。"
      : "当前内容并非纯目标程序输出，而是严格标记后的回退展示。",
    streams,
  };
}

export function buildTimeline(session?: DebugSession | null, live?: DebugLiveSession | null): MonitorViewModel["timeline"] {
  const status = String(live?.status ?? session?.status ?? "created");
  const currentStageKey =
    status === "created" ? "created" :
    ["launching_target", "replaying_input", "waiting_signal"].includes(status) ? "started" :
    status === "collecting_context" ? "evidence" :
    ["llm_reasoning", "locate_line", "classified"].includes(status) ? "located" :
    status === "archived" ? "archived" :
    status === "failed" ? "located" : "created";

  const stateMap = new Map<string, string | undefined>();
  [...(session?.states ?? []), ...(live?.states ?? [])].forEach((item) => {
    if (item?.status && !stateMap.has(String(item.status))) {
      stateMap.set(String(item.status), item.at);
    }
  });

  const startedAt = stateMap.get("launching_target") ?? stateMap.get("replaying_input") ?? stateMap.get("waiting_signal");
  const evidenceAt = stateMap.get("collecting_context") ?? stateMap.get("llm_reasoning");
  const locatedAt = stateMap.get("locate_line") ?? stateMap.get("classified");

  return TIMELINE_SPECS.map((item) => {
    const reached =
      item.key === "created" ? true :
      item.key === "started" ? stageRank(status) >= stageRank("launching_target") :
      item.key === "captured" ? hasCapturedSignal(session, live) :
      item.key === "evidence" ? hasEvidence(session, live) :
      item.key === "located" ? hasLocation(session, live) :
      item.key === "archived" ? status === "archived" : false;

    const at =
      item.key === "created" ? stateMap.get("created") :
      item.key === "started" ? startedAt :
      item.key === "captured" ? stateMap.get("collecting_context") ?? stateMap.get("waiting_signal") :
      item.key === "evidence" ? evidenceAt :
      item.key === "located" ? locatedAt :
      item.key === "archived" ? stateMap.get("archived") : undefined;

    return {
      key: item.key,
      label: item.label,
      reached,
      active: currentStageKey === item.key,
      at,
      description: item.description,
    };
  });
}

export function buildPlanFlow(session?: DebugSession | null, live?: DebugLiveSession | null): MonitorViewModel["planFlow"] {
  const liveSteps = (live?.agent_progress ?? []).map((item) => ({ ...item, active: true }));
  const sessionSteps = (session?.agent_progress ?? []).map((item) => ({ ...item, active: false }));
  const items = [...sessionSteps, ...liveSteps]
    .map((item, index) => ({
      at: item.at,
      kind: textValue(item.kind, "stage"),
      title: textValue(item.title, `步骤 ${index + 1}`),
      message: textValue(item.message, "暂无说明"),
      evidence: item.evidence,
      active: item.active,
    }))
    .slice(-12);
  if (items.length > 0) return items;
  return [{ kind: "stage", title: "等待调试会话", message: "发起一次调试会话后，这里会显示智能体步骤流。", active: true }];
}

function buildFocusSummary(frame: DebugFrame | null | undefined, signal?: string): string {
  if (!frame) return signal ? `${signal} 已捕获，但当前还没有解析到可用 frame。` : "尚未捕获有效 frame。";
  const location = `${textValue(frame.function, "unknown")} · ${textValue(frame.file_path || frame.library, "未解析")}${typeof frame.line === "number" ? `:${frame.line}` : ""}`;
  return signal ? `${signal} 首次落在 ${location}` : location;
}

function buildKeyRegisters(registers: DebugRegister[]): DebugRegister[] {
  const byName = new Map(registers.map((item) => [String(item.name ?? "").toLowerCase(), item]));
  const picked = KEY_REGISTER_NAMES.map((name) => byName.get(name)).filter(Boolean) as DebugRegister[];
  return picked.length ? picked : registers.slice(0, 6);
}

export function buildMonitorViewModel(
  session?: DebugSession | null,
  live?: DebugLiveSession | null,
  logItems: LogTailItem[] = [],
): MonitorViewModel {
  const frames = extractFrames(session, live);
  const focusFrame = live?.focus_frame ?? session?.gdb_context?.focus_frame ?? frames[0] ?? null;
  const registers = extractRegisters(session, live);
  const locals = extractLocals(session, live);
  const sharedLibraries = (live?.shared_libraries?.length ? live.shared_libraries : session?.gdb_context?.shared_libraries) ?? [];
  const report = session?.debug_report;
  const location = asRecord(live?.location_result) ?? asRecord(report?.location_result);
  const relatedLibraryFile = textValue(
    live?.related_library_file ??
      session?.current_focus?.related_library_file ??
      session?.gdb_context?.related_library_file ??
      location?.related_library_file,
    "未解析",
  );
  const source = {
    filePath: typeof location?.primary_file_path === "string" ? location.primary_file_path : textValue(focusFrame?.file_path, "").replace(/^未解析$/, ""),
    functionName: typeof location?.primary_function === "string" ? location.primary_function : textValue(focusFrame?.function, "").replace(/^未解析$/, ""),
    line: typeof location?.primary_line === "number" ? location.primary_line : typeof focusFrame?.line === "number" ? focusFrame.line : undefined,
    excerpt: (location?.source_excerpt as MonitorViewModel["source"]["excerpt"]) ?? report?.location_result?.source_excerpt ?? null,
    workspaceRef: typeof location?.source_workspace_ref === "string" ? location.source_workspace_ref : null,
    sourceAvailable: Boolean(location?.source_available ?? report?.location_result?.source_available),
  };

  const output = buildOutput(session, live, logItems);
  const focusSummary = buildFocusSummary(focusFrame, session?.latest_evidence_summary?.signal ?? live?.latest_evidence_summary?.signal);
  const stackText = textValue(report?.stack_summary ?? session?.latest_evidence_summary?.stack_summary ?? session?.gdb_context?.backtrace, "暂无调用栈文本");

  const structured = {
    coarse_type: report?.coarse_type,
    vuln_type: report?.vuln_type,
    cwe: report?.cwe,
    signal: report?.signal ?? session?.latest_evidence_summary?.signal,
    root_cause: report?.root_cause,
    direct_cause: report?.direct_cause,
    stack_summary: report?.stack_summary,
    confidence: report?.confidence,
    fix_suggestion: report?.fix_suggestion,
    poc_concept: report?.poc_concept,
    related_library_file: relatedLibraryFile,
  };

  return {
    header: {
      protocol: textValue(session?.protocol, "未选择协议"),
      crashType: textValue(report?.coarse_type ?? report?.vuln_type ?? report?.error_type, "待识别"),
      focusFrame: formatLocationLabel(focusFrame),
      relatedLibraryFile,
      status: textValue(live?.status ?? session?.status, "created"),
      statusDescription: statusDescription(live?.status ?? session?.status),
      sessionId: session?.session_id,
      operationId: live?.operation_id ?? session?.operation_id,
      updatedAt: (live?.updated_at ?? session?.updated_at) ? formatDateTime(live?.updated_at ?? session?.updated_at) : undefined,
    },
    timeline: buildTimeline(session, live),
    context: {
      artifactPath: textValue(session?.request?.artifact_path, "未提供"),
      binaryPath: textValue(session?.request?.target?.binary_path, "未提供"),
      cwd: textValue(session?.request?.target?.cwd, "未提供"),
      transportType: textValue(session?.request?.target?.transport_type, "stdin"),
      sessionId: session?.session_id,
      operationId: live?.operation_id ?? session?.operation_id,
      sourceAvailable: source.sourceAvailable,
      historyRecordId: live?.history_record_id ?? session?.history_record_id,
      debugReportPath: live?.debug_report_path ?? session?.debug_report_path,
      reportPath: live?.report_path ?? session?.report_path,
      relatedLibraryFile,
    },
    planFlow: buildPlanFlow(session, live),
    source,
    output,
    details: {
      frames,
      focusFrame,
      locals,
      registers,
      sharedLibraries,
      structured,
      stackText,
      focusSummary,
      keyRegisters: buildKeyRegisters(registers),
    },
    live: live ?? null,
    session: session ?? null,
  };
}

export function buildIdleMonitorViewModel(protocol = ""): MonitorViewModel {
  return {
    header: {
      protocol: textValue(protocol, "未选择协议"),
      crashType: "待识别",
      focusFrame: "未定位",
      relatedLibraryFile: "未解析",
      status: "待启动",
      statusDescription: "当前还没有加载具体调试会话；监控页会先把实时检查器骨架全部渲染出来。",
      sessionId: undefined,
      operationId: undefined,
      updatedAt: undefined,
    },
    timeline: TIMELINE_SPECS.map((item, index) => ({
      key: item.key,
      label: item.label,
      reached: index === 0,
      active: index === 0,
      at: undefined,
      description: item.description,
    })),
    context: {
      artifactPath: "未提供",
      binaryPath: "未提供",
      cwd: "未提供",
      transportType: "stdin",
      sessionId: undefined,
      operationId: undefined,
      sourceAvailable: false,
      historyRecordId: undefined,
      debugReportPath: undefined,
      reportPath: undefined,
      relatedLibraryFile: "未解析",
    },
    planFlow: [
      {
        kind: "idle",
        title: "等待调试会话",
        message: "在“启动”页发起定位，或在“记录 / 归档”页回填历史参数后，这里会持续刷新实时步骤流。",
        active: true,
      },
    ],
    source: {
      filePath: undefined,
      functionName: undefined,
      line: undefined,
      excerpt: null,
      workspaceRef: null,
      sourceAvailable: false,
    },
    output: {
      targetOutput: "当前还没有可显示的目标程序 I/O。",
      gdbTranscript: "当前还没有 GDB transcript。",
      argv: [],
      targetOutputAvailable: false,
      targetOutputDisclaimer: "未启动会话前不会展示任何运行输出。",
      streams: null,
    },
    details: {
      frames: [],
      focusFrame: null,
      locals: [],
      registers: [],
      sharedLibraries: [],
      structured: {},
      stackText: "暂无调用栈文本",
      focusSummary: "尚未捕获有效 frame。",
      keyRegisters: [],
    },
    live: null,
    session: null,
  };
}

export function buildKeywordMatcher(keyword: string, target: unknown): boolean {
  const query = keyword.trim().toLowerCase();
  if (!query) return true;
  return JSON.stringify(target ?? "").toLowerCase().includes(query);
}

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Binary,
  Bug,
  FileSearch,
  Play,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Workflow,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FormField } from "@/components/common/form-field";
import { ApiErrorReporter, ApiErrorToast } from "@/components/common/api-error-alert";
import { JsonViewer } from "@/components/common/json-viewer";
import { StatusBadge } from "@/components/common/status-badge";
import { SummaryCard } from "@/components/common/summary-card";
import { jobsApi } from "@/lib/api/services/jobs";
import { debugApi } from "@/lib/api/services/debug";
import { protocolsApi } from "@/lib/api/services/protocols";
import { createOperationId } from "@/lib/api/services/operations";
import { formatDateTime, parseCommandInput, parseJsonObject } from "@/lib/utils/format";
import { useOperationLogDockSync } from "@/hooks/use-operation-log-dock-sync";
import type {
  DebugCandidate,
  DebugReport,
  DebugSession,
  DebugSessionRequest,
} from "@/types/api/debug";

interface DebugSessionStateItem {
  status?: string;
  at?: string;
  data?: unknown;
}

interface DebugFormState {
  artifact_path: string;
  artifact_id: string;
  binary_path: string;
  cwd: string;
  args_text: string;
  env_json: string;
  transport_type: string;
  transport_config_json: string;
  startup_timeout: string;
  ready_check_json: string;
  kb_entry_ids_text: string;
  source_doc_ids_text: string;
}

function reportValue(value?: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function reportNumber(value?: unknown): string {
  if (typeof value === "number") return value.toFixed(2);
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function isLikelyDirectoryPath(path: string): boolean {
  const trimmed = path.trim();
  if (!trimmed) return false;
  return /[\\/]$/.test(trimmed) || /[\\/](inputs?|crashes?|queue|seeds?)[\\/]?$/i.test(trimmed);
}

function candidateRequest(candidate: DebugCandidate): DebugSessionRequest | undefined {
  return candidate.debug_session_request ??
    (candidate.seed_path || candidate.path
      ? {
          protocol: candidate.protocol ?? "",
          artifact_path: candidate.seed_path ?? candidate.path ?? "",
          artifact_id: candidate.artifact_id,
          job_id: candidate.job_id,
          target: candidate.target ?? {},
        }
      : undefined);
}

function splitTextList(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function compactText(value?: string): string {
  return value?.trim() ? value.trim() : "-";
}

function recordField(record: Record<string, unknown> | undefined, key: string): string {
  const value = record?.[key];
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

function detailsSummary(title: string, body: unknown): JSX.Element {
  return (
    <details className="rounded-2xl border border-border/60 bg-background/45 p-4">
      <summary className="cursor-pointer text-sm font-medium">{title}</summary>
      <div className="mt-3">
        <JsonViewer data={body} compact />
      </div>
    </details>
  );
}

export function DebugView(): JSX.Element {
  const [protocol, setProtocol] = useState("");
  const [jobId, setJobId] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState<DebugCandidate | null>(null);
  const [selectedSession, setSelectedSession] = useState<DebugSession | null>(null);
  const [historyProtocol, setHistoryProtocol] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [form, setForm] = useState<DebugFormState>({
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
  });

  const protocolsQuery = useQuery({
    queryKey: ["protocols"],
    queryFn: protocolsApi.listProtocols,
    retry: 0,
  });
  const jobsQuery = useQuery({
    queryKey: ["jobs"],
    queryFn: jobsApi.listJobs,
  });
  const candidatesQuery = useQuery({
    queryKey: ["debug-candidates", jobId],
    queryFn: () => debugApi.listCandidates(jobId),
    enabled: false,
    retry: 0,
  });
  const historyQuery = useQuery({
    queryKey: ["debug-sessions", historyProtocol],
    queryFn: () => debugApi.listProtocolSessions(historyProtocol),
    enabled: Boolean(historyProtocol),
    retry: 0,
  });
  const debugSummaryQuery = useQuery({
    queryKey: ["debug-summary", protocol],
    queryFn: () => debugApi.getProtocolSummary(protocol),
    enabled: Boolean(protocol),
    retry: 0,
  });

  const createMutation = useMutation({
    mutationFn: debugApi.createSession,
    onSuccess: (session) => {
      setSelectedSession(session);
    },
  });
  const sessionQueryMutation = useMutation({
    mutationFn: debugApi.getSession,
    onSuccess: (session) => {
      setSelectedSession(session);
    },
  });

  useOperationLogDockSync(
    [
      {
        operationId: createMutation.data?.operation_id,
        source: "debug",
        label: "GDB 调试",
        enabled: Boolean(createMutation.data?.operation_id),
      },
      {
        operationId: sessionQueryMutation.data?.operation_id,
        source: "debug",
        label: "历史调试会话",
        enabled: Boolean(sessionQueryMutation.data?.operation_id),
      },
      {
        operationId: selectedSession?.operation_id,
        source: "debug",
        label: "调试会话",
        enabled: Boolean(selectedSession?.operation_id),
      },
    ],
    1000,
  );

  const candidates = candidatesQuery.data ?? [];
  const selectedJobOptions = useMemo(() => jobsQuery.data ?? [], [jobsQuery.data]);
  const report: DebugReport | undefined = selectedSession?.debug_report;
  const sessionStateTail = (selectedSession?.states?.slice(-4) ?? []) as DebugSessionStateItem[];
  const currentOperationId =
    createMutation.data?.operation_id ??
    selectedSession?.operation_id ??
    sessionQueryMutation.data?.operation_id;

  const fillFromCandidate = (candidate: DebugCandidate): void => {
    setSelectedCandidate(candidate);
    const request = candidateRequest(candidate);
    if (!request) return;

    setProtocol(request.protocol ?? candidate.protocol ?? protocol);
    setJobId(request.job_id ?? candidate.job_id ?? jobId);
    setForm((state) => ({
      ...state,
      artifact_path: request.artifact_path ?? candidate.seed_path ?? candidate.path ?? "",
      artifact_id: request.artifact_id ?? candidate.artifact_id ?? "",
      binary_path: request.target?.binary_path ? String(request.target.binary_path) : "",
      cwd: request.target?.cwd ? String(request.target.cwd) : "",
      args_text: Array.isArray(request.target?.args) ? request.target.args.join(" ") : "",
      env_json: JSON.stringify(request.target?.env ?? {}, null, 2),
      transport_type: request.target?.transport_type ? String(request.target.transport_type) : "stdin",
      transport_config_json: JSON.stringify(request.target?.transport_config ?? {}, null, 2),
      startup_timeout: request.target?.startup_timeout !== undefined ? String(request.target.startup_timeout) : state.startup_timeout,
      ready_check_json: JSON.stringify(request.target?.ready_check ?? {}, null, 2),
      kb_entry_ids_text: Array.isArray(request.kb_entry_ids) ? request.kb_entry_ids.join("\n") : state.kb_entry_ids_text,
      source_doc_ids_text: Array.isArray(request.source_doc_ids) ? request.source_doc_ids.join("\n") : state.source_doc_ids_text,
    }));
  };

  const startDebug = (): void => {
    const artifactPath = form.artifact_path.trim();
    const binaryPath = form.binary_path.trim();

    if (!artifactPath) {
      setValidationError("artifact_path 必须是后端主机上的单个 crash seed 文件，不能留空。");
      return;
    }
    if (isLikelyDirectoryPath(artifactPath)) {
      setValidationError("artifact_path 看起来是目录。请填写单个 crash seed 文件路径。");
      return;
    }
    if (!binaryPath) {
      setValidationError("binary_path 必须是后端主机上的目标可执行文件。");
      return;
    }
    if (isLikelyDirectoryPath(binaryPath)) {
      setValidationError("binary_path 看起来是目录。请填写目标可执行文件路径。");
      return;
    }

    setValidationError(null);
    const operationId = createOperationId("debug");

    const payload: DebugSessionRequest = {
      operation_id: operationId,
      protocol: protocol.trim(),
      artifact_path: artifactPath,
      artifact_id: form.artifact_id.trim() || selectedCandidate?.artifact_id,
      job_id: jobId.trim() || selectedCandidate?.job_id,
      kb_entry_ids: splitTextList(form.kb_entry_ids_text),
      source_doc_ids: splitTextList(form.source_doc_ids_text),
      target: {
        binary_path: binaryPath,
        cwd: form.cwd.trim() || undefined,
        args: parseCommandInput(form.args_text),
        env: Object.fromEntries(
          Object.entries(parseJsonObject(form.env_json)).map(([key, value]) => [
            key,
            String(value),
          ]),
        ),
        protocol: protocol.trim(),
        transport_type: form.transport_type.trim(),
        transport_config: parseJsonObject(form.transport_config_json),
        startup_timeout: Number(form.startup_timeout || 3),
        ready_check: parseJsonObject(form.ready_check_json),
      },
    };

    createMutation.mutate(payload);
  };

  const highlightCards = [
    {
      title: "Signal",
      value: reportValue(report?.signal),
      hint: compactText(report?.error_type),
      statusColor: "danger" as const,
    },
    {
      title: "CWE",
      value: reportValue(report?.cwe),
      hint: compactText(report?.vuln_type),
      statusColor: "orange" as const,
    },
    {
      title: "Confidence",
      value: reportNumber(report?.confidence),
      hint: compactText(report?.coarse_type),
      statusColor: "violet" as const,
    },
    {
      title: "Artifact",
      value: recordField(report?.artifact, "artifact_id"),
      hint: compactText(selectedSession?.status),
      statusColor: "blue" as const,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-[var(--radius-2xl)] border border-border/55 bg-card/88 p-6 shadow-console">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">GDB 工作台</p>
            <h1 className="text-2xl font-semibold tracking-tight">GDB 调试工作台</h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              左侧选种子与历史会话，中间补齐调试参数，右侧聚焦根因、证据与上下文。调试过程输出已统一进入底部
              GlobalLogDock。
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl border border-border/60 bg-background/45 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">当前会话</p>
              <div className="mt-2 flex items-center gap-2">
                <StatusBadge status={selectedSession?.status ?? "idle"} />
                {currentOperationId ? (
                  <span className="truncate text-xs text-muted-foreground">{currentOperationId}</span>
                ) : (
                  <span className="text-xs text-muted-foreground">等待启动</span>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/45 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Dock Routing</p>
              <p className="mt-2 text-sm text-foreground">
                实时输出、错误与补充详情都写入底部日志栏与全局错误中心。
              </p>
            </div>
          </div>
        </div>
      </div>

      {validationError ? (
        <div className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground">
          {validationError}
        </div>
      ) : null}

      <ApiErrorReporter error={createMutation.error} title="启动 GDB 调试失败" source="debug" />
      <ApiErrorReporter error={candidatesQuery.error} title="加载 crash seed 失败" source="debug" />
      <ApiErrorReporter error={sessionQueryMutation.error} title="读取调试会话失败" source="debug" />
      <ApiErrorReporter error={historyQuery.error} title="加载历史调试会话失败" source="debug" />
      <ApiErrorToast error={createMutation.error} title="启动 GDB 调试失败" />
      <ApiErrorToast error={candidatesQuery.error} title="加载 crash seed 失败" />
      <ApiErrorToast error={sessionQueryMutation.error} title="读取调试会话失败" />
      <ApiErrorToast error={historyQuery.error} title="加载历史调试会话失败" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="调试会话" value={String(debugSummaryQuery.data?.total ?? 0)} hint="debug/summary" statusColor="blue" />
        <SummaryCard title="最近会话" value={String(debugSummaryQuery.data?.recent_sessions?.length ?? 0)} hint="recent sessions" statusColor="teal" />
        <SummaryCard title="候选 Crash" value={String(candidates.length)} hint="当前候选列表" statusColor="rose" />
        <SummaryCard title="汇总协议" value={protocol || "-"} hint="当前 GDB 统计上下文" statusColor="violet" />
      </div>

      <datalist id="debug-protocol-list">
        {(protocolsQuery.data ?? []).map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
      <datalist id="debug-job-list">
        {selectedJobOptions.map((job) => (
          <option key={job.job_id} value={job.job_id}>
            {job.name ?? job.job_id}
          </option>
        ))}
      </datalist>

      <div className="grid gap-4 xl:grid-cols-[0.78fr_1.05fr_1.17fr]">
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bug className="size-4 text-primary" />
                候选 crash / artifact
              </CardTitle>
              <CardDescription>先按 job 加载候选，再将目标种子填入中间调试参数区。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <div className="grid gap-3">
                <FormField label="协议 protocol">
                  <Input list="debug-protocol-list" value={protocol} onChange={(event) => setProtocol(event.target.value)} />
                </FormField>
                <FormField label="Fuzz job">
                  <Input list="debug-job-list" value={jobId} onChange={(event) => setJobId(event.target.value)} />
                </FormField>
              </div>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => void candidatesQuery.refetch()}
                disabled={!jobId.trim() || candidatesQuery.isFetching}
              >
                <RefreshCw className={`size-4 ${candidatesQuery.isFetching ? "animate-spin" : ""}`} />
                加载候选 seed
              </Button>
              <div className="space-y-3">
                {candidates.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-background/35 px-4 py-5 text-sm text-muted-foreground">
                    当前没有候选 crash seed。
                  </div>
                ) : (
                  candidates.map((candidate, index) => {
                    const active =
                      selectedCandidate?.artifact_id === candidate.artifact_id &&
                      selectedCandidate?.seed_path === candidate.seed_path;

                    return (
                      <button
                        key={`${candidate.artifact_id ?? candidate.path ?? index}`}
                        type="button"
                        className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                          active
                            ? "border-primary/45 bg-primary/8"
                            : "border-border/60 bg-background/45 hover:bg-muted/35"
                        }`}
                        onClick={() => fillFromCandidate(candidate)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                              {candidate.name ?? candidate.artifact_id ?? candidate.seed_path ?? candidate.path}
                            </p>
                            <p className="mt-1 break-all text-xs text-muted-foreground">
                              {candidate.seed_path ?? candidate.path}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                              <Badge variant="outline">{candidate.kind ?? "candidate"}</Badge>
                              <span>{candidate.size ?? "-"} bytes</span>
                              <span>{candidate.target?.binary_path ? "已关联 target" : "待补 target"}</span>
                            </div>
                          </div>
                          <StatusBadge status={candidate.kind ?? "crash"} />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border/50">
              <CardTitle className="text-base">历史调试会话</CardTitle>
              <CardDescription>按协议拉取会话历史，点击即可在右侧查看完整报告。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <div className="flex gap-2">
                <Input
                  value={historyProtocol}
                  onChange={(event) => setHistoryProtocol(event.target.value)}
                  placeholder="协议名"
                />
                <Button variant="outline" onClick={() => void historyQuery.refetch()}>
                  刷新
                </Button>
              </div>
              <div className="space-y-3">
                {(historyQuery.data ?? []).length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-background/35 px-4 py-5 text-sm text-muted-foreground">
                    暂无历史调试会话。
                  </div>
                ) : (
                  (historyQuery.data ?? []).map((session) => (
                    <button
                      key={session.session_id}
                      type="button"
                      className="w-full rounded-2xl border border-border/60 bg-background/45 p-4 text-left transition-colors hover:bg-muted/35"
                      onClick={() => sessionQueryMutation.mutate(session.session_id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{session.session_id}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDateTime(String(session.updated_at ?? session.created_at ?? ""))}
                          </p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {session.debug_report?.coarse_type ?? "-"} / {session.debug_report?.cwe ?? "-"}
                          </p>
                        </div>
                        <StatusBadge status={session.status ?? "unknown"} />
                      </div>
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="flex items-center gap-2 text-base">
                <Workflow className="size-4 text-primary" />
                调试参数与动作
              </CardTitle>
              <CardDescription>
                只增强页面层输入能力，不改 API service。后端当前稳定支持 target、kb_entry_ids、source_doc_ids。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <FormField label="crash seed / artifact_path">
                    <Input
                      value={form.artifact_path}
                      onChange={(event) => setForm((state) => ({ ...state, artifact_path: event.target.value }))}
                    />
                  </FormField>
                </div>
                <FormField label="artifact_id">
                  <Input
                    value={form.artifact_id}
                    onChange={(event) => setForm((state) => ({ ...state, artifact_id: event.target.value }))}
                  />
                </FormField>
                <FormField label="job_id">
                  <Input value={jobId} onChange={(event) => setJobId(event.target.value)} />
                </FormField>
                <FormField label="目标程序 executable">
                  <Input
                    value={form.binary_path}
                    onChange={(event) => setForm((state) => ({ ...state, binary_path: event.target.value }))}
                  />
                </FormField>
                <FormField label="working directory">
                  <Input
                    value={form.cwd}
                    onChange={(event) => setForm((state) => ({ ...state, cwd: event.target.value }))}
                  />
                </FormField>
                <div className="md:col-span-2">
                  <FormField label="args / argv">
                    <Textarea
                      value={form.args_text}
                      className="min-h-24"
                      onChange={(event) => setForm((state) => ({ ...state, args_text: event.target.value }))}
                    />
                  </FormField>
                </div>
                <FormField label="transport_type">
                  <Input
                    value={form.transport_type}
                    onChange={(event) => setForm((state) => ({ ...state, transport_type: event.target.value }))}
                  />
                </FormField>
                <FormField label="startup_timeout">
                  <Input
                    type="number"
                    value={form.startup_timeout}
                    onChange={(event) => setForm((state) => ({ ...state, startup_timeout: event.target.value }))}
                  />
                </FormField>
                <FormField label="transport_config JSON">
                  <Textarea
                    value={form.transport_config_json}
                    className="min-h-32"
                    onChange={(event) =>
                      setForm((state) => ({ ...state, transport_config_json: event.target.value }))
                    }
                  />
                </FormField>
                <FormField label="env JSON">
                  <Textarea
                    value={form.env_json}
                    className="min-h-32"
                    onChange={(event) => setForm((state) => ({ ...state, env_json: event.target.value }))}
                  />
                </FormField>
              </div>

              <details className="rounded-2xl border border-border/60 bg-background/40 p-4">
                <summary className="cursor-pointer text-sm font-medium">高级上下文与知识辅助</summary>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <FormField label="ready_check JSON">
                    <Textarea
                      value={form.ready_check_json}
                      className="min-h-28"
                      onChange={(event) =>
                        setForm((state) => ({ ...state, ready_check_json: event.target.value }))
                      }
                    />
                  </FormField>
                  <div className="grid gap-4">
                    <FormField label="kb_entry_ids">
                      <Textarea
                        value={form.kb_entry_ids_text}
                        className="min-h-28"
                        onChange={(event) =>
                          setForm((state) => ({ ...state, kb_entry_ids_text: event.target.value }))
                        }
                      />
                    </FormField>
                    <FormField label="source_doc_ids">
                      <Textarea
                        value={form.source_doc_ids_text}
                        className="min-h-28"
                        onChange={(event) =>
                          setForm((state) => ({ ...state, source_doc_ids_text: event.target.value }))
                        }
                      />
                    </FormField>
                  </div>
                </div>
              </details>

              <div className="rounded-2xl border border-border/60 bg-background/45 px-4 py-3 text-sm text-muted-foreground">
                `artifact_path` 必须指向单个 seed 文件，`binary_path` 必须指向被测程序；调试过程输出不会在页面内展开，而是进入底部
                GlobalLogDock。
              </div>

              <Button
                className="w-full"
                onClick={startDebug}
                disabled={createMutation.isPending || !form.artifact_path.trim() || !form.binary_path.trim()}
              >
                <Play className="size-4" />
                {createMutation.isPending ? "调试中..." : "启动 GDB 调试"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border/50">
              <CardTitle className="text-base">过程与状态出口</CardTitle>
              <CardDescription>页面内不再保留控制台框，改为状态卡 + 全局日志栏。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 p-5">
              <div className="rounded-2xl border border-border/60 bg-background/45 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ShieldAlert className="size-4 text-[hsl(var(--accent-pink))]" />
                  调试输出路由
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {createMutation.isPending
                    ? "调试执行中，请查看底部 GlobalLogDock。"
                    : currentOperationId
                      ? `当前会话已绑定 operation_id: ${currentOperationId}`
                      : "启动调试后，将自动把后端增量日志同步到底部 GlobalLogDock。"}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/60 bg-background/45 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">知识辅助</p>
                  <p className="mt-2 text-sm text-foreground">
                    KB 条目 {splitTextList(form.kb_entry_ids_text).length} 个，文档引用 {splitTextList(form.source_doc_ids_text).length} 个。
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/45 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">回放模式</p>
                  <p className="mt-2 text-sm text-foreground">
                    {form.transport_type || "stdin"} / 超时 {form.startup_timeout || "3"}s
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {highlightCards.map((item) => (
              <SummaryCard
                key={item.title}
                title={item.title}
                value={item.value}
                hint={item.hint}
                statusColor={item.statusColor}
              />
            ))}
          </div>

          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileSearch className="size-4 text-primary" />
                根因与证据
              </CardTitle>
              <CardDescription>主结果突出，堆栈、寄存器、原始上下文折叠到下方详情区。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              {selectedSession && !selectedSession.classification ? (
                <div className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground">
                  调试已完成，但分类信息不完整。你仍可查看原始 GDB 上下文与结构化 JSON。
                </div>
              ) : null}

              {report ? (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">根因</p>
                      <p className="mt-2 text-sm leading-6 text-foreground">{reportValue(report.root_cause)}</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">直接原因</p>
                      <p className="mt-2 text-sm leading-6 text-foreground">{reportValue(report.direct_cause)}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 bg-background/45 p-4 text-sm">
                      <p className="font-medium">函数定位</p>
                      <p className="mt-2 text-muted-foreground">
                        {reportValue(report.vulnerability_location?.function_name)}
                      </p>
                      <p className="mt-1 break-all text-xs text-muted-foreground">
                        {reportValue(report.vulnerability_location?.file_path)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        line {reportValue(report.vulnerability_location?.line)} / range{" "}
                        {reportValue(report.vulnerability_location?.line_start)} -{" "}
                        {reportValue(report.vulnerability_location?.line_end)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/45 p-4 text-sm">
                      <p className="font-medium">利用与修复</p>
                      <p className="mt-2 text-muted-foreground">{reportValue(report.possible_exploitation_description)}</p>
                      <p className="mt-2 text-xs text-muted-foreground">{reportValue(report.fix_suggestion)}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Sparkles className="size-4 text-[hsl(var(--accent-pink))]" />
                      崩溃签名与复现概念
                    </div>
                    <p className="mt-2 break-all text-sm text-foreground">{reportValue(report.crash_signature)}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{reportValue(report.poc_concept)}</p>
                  </div>

                  {detailsSummary("查看 repro_steps / 原始报告", {
                    repro_steps: report.repro_steps ?? [],
                    report,
                  })}
                  {detailsSummary("查看 stack / registers / gdb context", {
                    stack_summary: report.stack_summary,
                    gdb_context_excerpt: report.gdb_context_excerpt,
                    gdb_context: selectedSession?.gdb_context,
                  })}
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 bg-background/35 px-4 py-8 text-center text-sm text-muted-foreground">
                  尚未获取调试报告。
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border/50">
              <CardTitle className="flex items-center gap-2 text-base">
                <Binary className="size-4 text-primary" />
                会话上下文
              </CardTitle>
              <CardDescription>保留紧凑状态流与完整会话 JSON，便于定位分类前后的上下文差异。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <div className="grid gap-3">
                {sessionStateTail.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-background/35 px-4 py-5 text-sm text-muted-foreground">
                    暂无状态流。
                  </div>
                ) : (
                  sessionStateTail.map((item, index) => (
                    <div
                      key={`${item.status ?? "state"}-${String(item.at ?? index)}`}
                      className="rounded-2xl border border-border/60 bg-background/45 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={String(item.status ?? "unknown")} />
                          <span className="text-sm font-medium">{String(item.status ?? "unknown")}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(String(item.at ?? ""))}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        <JsonViewer data={item.data ?? {}} compact />
                      </div>
                    </div>
                  ))
                )}
              </div>
              {detailsSummary("完整会话 JSON", selectedSession ?? { status: "idle" })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

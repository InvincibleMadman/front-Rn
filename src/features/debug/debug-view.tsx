import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ApiErrorAlert, ApiErrorReporter } from "@/components/common/api-error-alert";
import { debugApi } from "@/lib/api/services/debug";
import { protocolsApi } from "@/lib/api/services/protocols";
import { jobsApi } from "@/lib/api/services/jobs";
import { assetsApi } from "@/lib/api/services/assets";
import { buildAssistantApi } from "@/lib/api/services/build-assistant";
import { vulnHistoryApi } from "@/lib/api/services/vuln-history";
import { createOperationId } from "@/lib/api/services/operations";
import { useOperationLogDockSync } from "@/hooks/use-operation-log-dock-sync";
import { DebugPageHeader } from "@/features/debug/components/debug-page-header";
import { DebugSubnav } from "@/features/debug/components/debug-subnav";
import { DebugLaunchPanel } from "@/features/debug/components/debug-launch-panel";
import { DebugMonitorShell } from "@/features/debug/components/debug-monitor-shell";
import { DebugHistoryList } from "@/features/debug/components/debug-history-list";
import { DebugArchiveList } from "@/features/debug/components/debug-archive-list";
import {
  applyFormDraft,
  asRecord,
  buildCreatePayload,
  buildIdleMonitorViewModel,
  buildKeywordMatcher,
  buildMonitorViewModel,
  candidateToRequest,
  formFromRequest,
  initialDebugUiState,
  isTerminalStatus,
  parseWorkspaceRef,
} from "@/features/debug/debug-utils";
import type { DebugCandidate, DebugSession } from "@/types/api/debug";
import type { DebugArchiveListItem, DebugHistoryListItem } from "@/features/debug/debug-types";

function sessionRequest(session?: DebugSession | null) {
  return session?.request;
}

export function DebugView(): JSX.Element {
  const [ui, setUi] = useState(initialDebugUiState());
  const [validationError, setValidationError] = useState<string | null>(null);
  const [historyKeyword, setHistoryKeyword] = useState("");
  const [historyCoarseType, setHistoryCoarseType] = useState("");
  const [archiveKeyword, setArchiveKeyword] = useState("");
  const [archiveCoarseType, setArchiveCoarseType] = useState("");
  const [selectedCandidatePath, setSelectedCandidatePath] = useState<string | undefined>(undefined);

  const protocolsQuery = useQuery({
    queryKey: ["protocols"],
    queryFn: protocolsApi.listProtocols,
    retry: 0,
  });

  useEffect(() => {
    if (!ui.protocol && protocolsQuery.data?.length) {
      setUi((current) => ({ ...current, protocol: protocolsQuery.data?.[0] ?? "" }));
    }
  }, [protocolsQuery.data, ui.protocol]);

  const jobsQuery = useQuery({
    queryKey: ["jobs"],
    queryFn: jobsApi.listJobs,
    retry: 0,
  });

  const candidatesQuery = useQuery({
    queryKey: ["debug-candidates", ui.selectedJobId ?? "__all__"],
    queryFn: () => debugApi.listCandidates(ui.selectedJobId),
    retry: 0,
  });

  const protocolCandidates = useMemo(
    () => (candidatesQuery.data ?? []).filter((item) => !ui.protocol || item.protocol === ui.protocol || (candidateToRequest(item)?.protocol ?? "") === ui.protocol),
    [candidatesQuery.data, ui.protocol],
  );



  const buildTargetsQuery = useQuery({
    queryKey: ["build-targets", ui.protocol],
    queryFn: () => buildAssistantApi.listTargets(ui.protocol),
    enabled: Boolean(ui.protocol),
    retry: 0,
  });

  const buildRunsQuery = useQuery({
    queryKey: ["build-runs", ui.protocol],
    queryFn: () => buildAssistantApi.listRuns(ui.protocol),
    enabled: Boolean(ui.protocol),
    retry: 0,
  });

  const launchProfilesQuery = useQuery({
    queryKey: ["launch-profiles", ui.protocol],
    queryFn: () => buildAssistantApi.listLaunchProfiles(ui.protocol),
    enabled: Boolean(ui.protocol),
    retry: 0,
  });

  const sourceStatusQuery = useQuery({
    queryKey: ["source-status", ui.protocol],
    queryFn: () => assetsApi.getSourceStatus(ui.protocol),
    enabled: Boolean(ui.protocol),
    retry: 0,
  });

  const replayScriptsQuery = useQuery({
    queryKey: ["debug-replay-scripts", ui.protocol],
    queryFn: () => assetsApi.getWorkspaceTree(ui.protocol, "debug_replay_scripts", "/"),
    enabled: Boolean(ui.protocol),
    retry: 0,
  });

  const historyQuery = useQuery({
    queryKey: ["debug-history", ui.protocol],
    queryFn: () => debugApi.listProtocolSessions(ui.protocol),
    enabled: Boolean(ui.protocol),
    retry: 0,
  });

  const archiveQuery = useQuery({
    queryKey: ["debug-archive", ui.protocol, archiveCoarseType],
    queryFn: () => vulnHistoryApi.list(ui.protocol, archiveCoarseType ? { coarse_type: archiveCoarseType, limit: 200 } : { limit: 200 }),
    enabled: Boolean(ui.protocol),
    retry: 0,
  });

  const activeSessionId = ui.activeSessionId;
  const sessionQuery = useQuery({
    queryKey: ["debug-session", activeSessionId],
    queryFn: () => debugApi.getSession(activeSessionId || ""),
    enabled: Boolean(activeSessionId),
    retry: 0,
    refetchInterval: ui.section === "monitor" && activeSessionId ? 3000 : false,
  });

  const liveQuery = useQuery({
    queryKey: ["debug-live", activeSessionId],
    queryFn: () => debugApi.getLiveSession(activeSessionId || ""),
    enabled: Boolean(activeSessionId),
    retry: 0,
    refetchInterval: ui.section === "monitor" && activeSessionId && !isTerminalStatus(sessionQuery.data?.status) ? 1800 : false,
  });

  const logTailQuery = useQuery({
    queryKey: ["debug-log-tail", activeSessionId],
    queryFn: () => debugApi.sessionLogsTail(activeSessionId || "", 0, 200, { kinds: ["event", "gdb", "stream"] }),
    enabled: Boolean(activeSessionId),
    retry: 0,
    refetchInterval: ui.section === "monitor" && activeSessionId ? 1800 : false,
  });

  const currentSession = sessionQuery.data ?? null;
  const currentLive = liveQuery.data ?? null;
  const workspaceRef = useMemo(() => {
    const viewModel = buildMonitorViewModel(currentSession, currentLive, logTailQuery.data?.items?.map((item: Record<string, unknown>) => String(item.message ?? item.payload ?? "")).filter(Boolean) ?? []);
    return viewModel.source.workspaceRef;
  }, [currentLive, currentSession, logTailQuery.data]);

  const sourceRefParts = useMemo(() => parseWorkspaceRef(workspaceRef), [workspaceRef]);

  const sourcePreviewQuery = useQuery({
    queryKey: ["debug-source-preview", sourceRefParts?.protocol, sourceRefParts?.scope, sourceRefParts?.virtualPath],
    queryFn: () => assetsApi.getWorkspacePreview(sourceRefParts?.protocol || ui.protocol, sourceRefParts?.scope || "source", sourceRefParts?.virtualPath || "/"),
    enabled: Boolean(sourceRefParts?.protocol && sourceRefParts?.scope && sourceRefParts?.virtualPath),
    retry: 0,
  });

  useOperationLogDockSync([
    {
      operationId: currentLive?.operation_id ?? currentSession?.operation_id,
      source: "debug",
      label: currentSession?.session_id ? `GDB ${currentSession.session_id}` : "GDB",
      enabled: ui.section === "monitor" && Boolean(activeSessionId),
      kinds: ["event"],
    },
  ]);

  const createMutation = useMutation({
    mutationFn: (body: Parameters<typeof debugApi.createSession>[0]) => debugApi.createSession(body, { async: true }),
    onSuccess: (session) => {
      setValidationError(null);
      setUi((current) => ({
        ...current,
        section: "monitor",
        activeSessionId: session.session_id,
      }));
    },
  });

  const uploadReplayScriptMutation = useMutation({
    mutationFn: ({ file, runtime }: { file: File; runtime: string }) => debugApi.uploadReplayScript(ui.protocol, file, runtime),
    onSuccess: async (payload) => {
      setUi((current) => ({
        ...current,
        launchForm: {
          ...current.launchForm,
          replay_mode: "script",
          replay_script_ref: String(payload.workspace_ref ?? current.launchForm.replay_script_ref),
        },
      }));
      await replayScriptsQuery.refetch();
    },
  });

  const deleteReplayScriptMutation = useMutation({
    mutationFn: (filename: string) => debugApi.deleteReplayScript(ui.protocol, filename),
    onSuccess: async (_, filename) => {
      setUi((current) => ({
        ...current,
        launchForm: current.launchForm.replay_script_ref.includes(filename)
          ? { ...current.launchForm, replay_script_ref: "" }
          : current.launchForm,
      }));
      await replayScriptsQuery.refetch();
    },
  });

  const historyItems = useMemo<DebugHistoryListItem[]>(() => {
    const sessions = historyQuery.data ?? [];
    return sessions
      .filter((session) => {
        const coarse = String(session.debug_report?.coarse_type || session.debug_report?.vuln_type || "");
        return (!historyCoarseType || coarse.includes(historyCoarseType)) && buildKeywordMatcher(historyKeyword, session);
      })
      .map((session) => ({
        session,
        candidateRequest: session.request,
      }));
  }, [historyCoarseType, historyKeyword, historyQuery.data]);

  const archiveItems = useMemo<DebugArchiveListItem[]>(() => {
    const records = archiveQuery.data?.items ?? archiveQuery.data?.records ?? [];
    const bySession = new Map((historyQuery.data ?? []).map((item) => [item.session_id, item]));
    return records
      .filter((record) => (!archiveCoarseType || String(record.coarse_type || record.vuln_type || "").includes(archiveCoarseType)) && buildKeywordMatcher(archiveKeyword, record))
      .map((record) => ({
        record,
        linkedSession: record.debug_session_id ? (bySession.get(String(record.debug_session_id)) ?? null) : null,
      }));
  }, [archiveCoarseType, archiveKeyword, archiveQuery.data, historyQuery.data]);



  function fillFromRequest(request?: ReturnType<typeof sessionRequest>) {
    setUi((current) => ({
      ...current,
      launchForm: applyFormDraft(current.launchForm, formFromRequest(request)),
      protocol: request?.protocol ?? current.protocol,
      section: "launch",
    }));
    if (request?.artifact_path) {
      setSelectedCandidatePath(request.artifact_path);
    }
  }

  function chooseCandidate(candidate: DebugCandidate | null) {
    setSelectedCandidatePath(candidate?.seed_path || candidate?.path || undefined);
    if (!candidate) return;
    const request = candidateToRequest(candidate);
    setUi((current) => ({
      ...current,
      protocol: request?.protocol || candidate.protocol || current.protocol,
      launchForm: applyFormDraft(current.launchForm, formFromRequest(request)),
    }));
  }

  function openSession(sessionId: string) {
    setUi((current) => ({ ...current, activeSessionId: sessionId, section: "monitor" }));
  }

  function refillFromSession(sessionId: string) {
    const session = (historyQuery.data ?? []).find((item) => item.session_id === sessionId) ?? null;
    fillFromRequest(session?.request);
  }

  function refillFromArchive(recordId: string) {
    const recordItem = archiveItems.find((item) => (item.record.record_id || item.record.id || "") === recordId);
    if (recordItem?.linkedSession?.request) {
      fillFromRequest(recordItem.linkedSession.request);
      return;
    }
    const record = recordItem?.record;
    if (!record) return;
    setUi((current) => ({
      ...current,
      protocol: String(record.protocol || current.protocol),
      section: "launch",
      launchForm: {
        ...current.launchForm,
        artifact_id: String(record.artifact_id || ""),
        artifact_path: current.launchForm.artifact_path,
      },
    }));
  }

  const monitorViewModel = useMemo(() => {
    if (!activeSessionId) {
      return buildIdleMonitorViewModel(ui.protocol);
    }
    return buildMonitorViewModel(
      currentSession,
      currentLive,
      (((logTailQuery.data?.items as Array<Record<string, unknown>> | undefined) ?? []) as Array<Record<string, unknown>>).map((item) => ({
        kind: String(item.kind ?? "event"),
        stage: String(item.stage ?? ""),
        message: String(item.message ?? item.line ?? item.payload ?? "").trim(),
        data: (item.data as Record<string, unknown> | undefined) ?? {},
      })),
    );
  }, [activeSessionId, currentLive, currentSession, logTailQuery.data?.items, ui.protocol]);

  const previewExcerpt = useMemo(() => {
    const lines = sourcePreviewQuery.data?.content?.split(/\r?\n/);
    if (!lines?.length || !monitorViewModel.source.line) return undefined;
    const focusLine = monitorViewModel.source.line;
    const startLine = Math.max(1, focusLine - 4);
    const endLine = Math.min(lines.length, focusLine + 4);
    return {
      start_line: startLine,
      highlight_line: focusLine,
      end_line: endLine,
      lines: lines.slice(startLine - 1, endLine).map((text: string, index: number) => ({
        line: startLine + index,
        text,
        highlight: startLine + index === focusLine,
      })),
    };
  }, [monitorViewModel.source.line, sourcePreviewQuery.data?.content]);

  function submit() {
    try {
      const payload = buildCreatePayload(ui.protocol, ui.launchForm, {
        operation_id: createOperationId("debug"),
      });
      setValidationError(null);
      createMutation.mutate(payload);
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "参数校验失败");
    }
  }

  return (
    <div className="space-y-4 pb-8">
      <ApiErrorReporter error={protocolsQuery.error} title="协议列表获取失败" source="debug" />
      <ApiErrorReporter error={candidatesQuery.error} title="调试候选获取失败" source="debug" />
      <ApiErrorReporter error={createMutation.error} title="调试会话创建失败" source="debug" />
      <ApiErrorReporter error={replayScriptsQuery.error} title="Replay 脚本列表读取失败" source="debug" />
      <ApiErrorReporter error={uploadReplayScriptMutation.error} title="Replay 脚本上传失败" source="debug" />
      <ApiErrorReporter error={deleteReplayScriptMutation.error} title="Replay 脚本删除失败" source="debug" />
      <ApiErrorReporter error={sessionQuery.error} title="调试会话读取失败" source="debug" />

      <DebugPageHeader
        title="GDB 调试分析舱"
        subtitle={monitorViewModel.header.statusDescription}
        viewModel={monitorViewModel}
      />

      <DebugSubnav value={ui.section} onChange={(section) => setUi((current) => ({ ...current, section }))} />

      {validationError ? <ApiErrorAlert error={new Error(validationError)} title="表单校验失败" compact /> : null}
      {createMutation.error ? <ApiErrorAlert error={createMutation.error} title="调试会话创建失败" compact onRetry={submit} /> : null}
      {sessionQuery.error ? <ApiErrorAlert error={sessionQuery.error} title="调试会话读取失败" compact onRetry={() => void sessionQuery.refetch()} /> : null}

      {ui.section === "launch" ? (
        <DebugLaunchPanel
          protocol={ui.protocol}
          protocols={protocolsQuery.data ?? []}
          jobs={jobsQuery.data ?? []}
          selectedJobId={ui.selectedJobId}
          onProtocolChange={(value) => setUi((current) => ({ ...current, protocol: value }))}
          onJobChange={(value) => setUi((current) => ({ ...current, selectedJobId: value }))}
          candidates={protocolCandidates}
          selectedCandidatePath={selectedCandidatePath}
          onSelectCandidate={chooseCandidate}
          sourceStatus={asRecord(sourceStatusQuery.data) ?? null}
          buildTargets={buildTargetsQuery.data ?? []}
          buildRuns={buildRunsQuery.data ?? []}
          launchProfiles={launchProfilesQuery.data ?? []}
          replayScripts={(replayScriptsQuery.data?.items ?? [])
            .filter((item) => item.type === "file")
            .map((item) => ({ filename: item.name, workspaceRef: item.workspace_ref || `workspace://${ui.protocol}/debug_replay_scripts${item.virtual_path}`, size: item.size }))}
          form={ui.launchForm}
          onFormChange={(patch) => setUi((current) => ({ ...current, launchForm: { ...current.launchForm, ...patch } }))}
          onSubmit={submit}
          onReloadCandidates={() => void candidatesQuery.refetch()}
          onUploadReplayScript={(file, runtime) => uploadReplayScriptMutation.mutate({ file, runtime })}
          onDeleteReplayScript={(filename) => filename && deleteReplayScriptMutation.mutate(filename)}
          submitting={createMutation.isPending}
          uploadingReplayScript={uploadReplayScriptMutation.isPending}
        />
      ) : null}

      {ui.section === "monitor" ? (
        <DebugMonitorShell
          viewModel={monitorViewModel}
          previewExcerpt={previewExcerpt}
        />
      ) : null}

      {ui.section === "history" ? (
        <DebugHistoryList
          items={historyItems}
          keyword={historyKeyword}
          coarseType={historyCoarseType}
          onKeywordChange={setHistoryKeyword}
          onCoarseTypeChange={setHistoryCoarseType}
          onSelect={openSession}
          onRefill={refillFromSession}
        />
      ) : null}

      {ui.section === "archive" ? (
        <DebugArchiveList
          items={archiveItems}
          keyword={archiveKeyword}
          coarseType={archiveCoarseType}
          onKeywordChange={setArchiveKeyword}
          onCoarseTypeChange={setArchiveCoarseType}
          onOpenSession={openSession}
          onRefill={refillFromArchive}
        />
      ) : null}
    </div>
  );
}

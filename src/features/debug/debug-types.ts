import type {
  DebugAgentProgressItem,
  DebugCandidate,
  DebugFrame,
  DebugLiveSession,
  DebugLocal,
  DebugOutputStreams,
  DebugRegister,
  DebugSession,
  DebugSessionRequest,
  DebugSharedLibrary,
  DebugSourceExcerpt,
} from "@/types/api/debug";
import type { VulnHistoryRecord } from "@/types/api/vuln-history";

export type DebugSection = "launch" | "monitor" | "history" | "archive";

export interface DebugLaunchFormState {
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
  replay_mode: "builtin_transport" | "script";
  replay_script_ref: string;
  replay_runtime: "python3" | "bash" | "native";
  replay_args_text: string;
  replay_env_json: string;
  replay_timeout: string;
  prep_steps_text: string;
}

export interface DebugUiState {
  protocol: string;
  selectedJobId?: string;
  selectedCandidateId?: string;
  activeSessionId?: string;
  activeHistorySessionId?: string;
  activeArchiveRecordId?: string;
  section: DebugSection;
  launchForm: DebugLaunchFormState;
  refillDraft?: Partial<DebugLaunchFormState> | null;
}

export interface DebugOptionItem {
  label: string;
  value: string;
  description?: string;
}

export interface MonitorContextViewModel {
  artifactPath: string;
  binaryPath: string;
  cwd: string;
  transportType: string;
  sessionId?: string;
  operationId?: string;
  sourceAvailable: boolean;
  historyRecordId?: string;
  debugReportPath?: string;
  reportPath?: string;
  relatedLibraryFile: string;
}

export interface MonitorPlanFlowItem {
  at?: string;
  kind: string;
  title: string;
  message: string;
  evidence?: Record<string, unknown>;
  active?: boolean;
}

export interface MonitorSourceViewModel {
  filePath?: string;
  functionName?: string;
  line?: number;
  excerpt?: DebugSourceExcerpt | null;
  workspaceRef?: string | null;
  sourceAvailable: boolean;
}

export interface MonitorOutputViewModel {
  targetOutput: string;
  gdbTranscript: string;
  argv: string[];
  targetOutputAvailable: boolean;
  targetOutputDisclaimer: string;
  streams?: DebugOutputStreams | null;
}

export interface MonitorDetailsViewModel {
  frames: DebugFrame[];
  focusFrame?: DebugFrame | null;
  locals: DebugLocal[];
  registers: DebugRegister[];
  sharedLibraries: DebugSharedLibrary[];
  structured: Record<string, unknown>;
  stackText: string;
  focusSummary: string;
  keyRegisters: DebugRegister[];
}

export interface MonitorViewModel {
  header: {
    protocol: string;
    crashType: string;
    focusFrame: string;
    relatedLibraryFile: string;
    status: string;
    statusDescription: string;
    sessionId?: string;
    operationId?: string;
    updatedAt?: string;
  };
  timeline: Array<{
    key: string;
    label: string;
    reached: boolean;
    active: boolean;
    at?: string;
    description: string;
  }>;
  context: MonitorContextViewModel;
  planFlow: MonitorPlanFlowItem[];
  source: MonitorSourceViewModel;
  output: MonitorOutputViewModel;
  details: MonitorDetailsViewModel;
  live: DebugLiveSession | null;
  session: DebugSession | null;
}

export interface DebugHistoryListItem {
  session: DebugSession;
  candidateRequest?: DebugSessionRequest;
}

export interface DebugArchiveListItem {
  record: VulnHistoryRecord;
  linkedSession?: DebugSession | null;
}

export interface DebugLiveBundle {
  session: DebugSession | null;
  live: DebugLiveSession | null;
  streamLogs: string[];
  eventSteps: DebugAgentProgressItem[];
  selectedCandidate?: DebugCandidate | null;
}

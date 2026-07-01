import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Activity,
  CheckCircle2,
  Database,
  FileJson,
  LibraryBig,
  Network,
  ScanSearch,
  Search,
  ShieldAlert,
  Sparkles,
  Square,
  UploadCloud,
  Wand2,
  ChevronDown,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { FormField } from "@/components/common/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { JsonViewer } from "@/components/common/json-viewer";
import { OperationLogPanel } from "@/components/common/operation-log-panel";
import { RiskAnalysisSummary } from "@/components/common/risk-analysis-summary";
import { InstrumentationReportView } from "@/components/common/instrumentation-report-view";
import { ApiErrorReporter } from "@/components/common/api-error-alert";
import { SummaryCard } from "@/components/common/summary-card";
import { DonutChart } from "@/components/charts/donut-chart";
import { BarChart } from "@/components/charts/bar-chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildAssistantApi } from "@/lib/api/services/build-assistant";
import { assetsApi } from "@/lib/api/services/assets";
import { offlineApi } from "@/lib/api/services/offline";
import { ApiClientError, apiClient } from "@/lib/api/client";
import { protocolsApi } from "@/lib/api/services/protocols";
import { vuldocsApi } from "@/lib/api/services/vuldocs";
import { kbApi } from "@/lib/api/services/kb";
import { createOperationId, operationsApi } from "@/lib/api/services/operations";
import { useOperationLogDockSync } from "@/hooks/use-operation-log-dock-sync";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { cn } from "@/lib/utils/cn";
import { dockLog } from "@/components/layout/dock";
import type {
  BuildPlan,
  BuildProbe,
  BuildRun,
  LaunchProfile,
  TargetCandidate,
} from "@/types/api/build-assistant";
import type {
  InstrumentResponse,
  ProtocolAnalyzeResponse,
  RiskAnalyzeResponse,
  RiskPreviewResponse,
  RiskUploadResponse,
  SeedGenerateResponse,
} from "@/types/api/offline";
import type {
  VulDocDistillResponse,
  VulDocRecord,
  VulDocUploadResponse,
  KbEntry,
} from "@/types/api/vuldocs";
import type { WorkspacePreviewResponse, WorkspaceTreeItem } from "@/types/api/assets";

const FIXED_PROTOCOL_SPEC_NAME = "protocol_spec.json";
const FIXED_RISK_ANALYSIS_NAME = "final_analysis.json";
const FIXED_DICT_FILENAME = "auto.dict";

const protocolSchema = z.object({
  protocol: z.string().min(1, "必填"),
  content: z.string().optional(),
});

const seedsSchema = z.object({
  protocol: z.string().min(1, "必填"),
  keyword: z.string().optional(),
  count: z.coerce.number().int().positive().default(8),
  use_kb_assist: z.boolean().default(true),
  allow_fallback: z.boolean().default(true),
});

const riskAnalyzeSchema = z.object({
  protocol: z.string().min(1, "必填"),
  max_workers: z.coerce.number().int().positive().default(4),
  llm_concurrency: z.coerce.number().int().positive().default(2),
  timeout_sec: z.coerce.number().int().positive().default(1800),
  use_static_prefilter: z.boolean().default(true),
  chunk_strategy: z.string().default("function"),
});

const riskPreviewSchema = z.object({
  protocol: z.string().min(1, "必填"),
});

const instrumentSchema = z.object({
  protocol: z.string().min(1, "必填"),
  in_place: z.boolean().default(false),
  compile_check: z.boolean().default(true),
  strict_ast_validation: z.boolean().default(true),
});

const buildPlanSchema = z.object({
  protocol: z.string().min(1, "必填"),
  compiler: z.string().default("afl-clang-fast"),
  instrumentation_mode: z.string().default("llvm"),
});

const offlineTabOptions = [
  { value: "protocol", label: "协议规范提取" },
  { value: "vuldocs-kb", label: "漏洞知识库" },
  { value: "seeds", label: "初始种子生成" },
  { value: "risk-analyze", label: "风险路径分析" },
  { value: "risk-preview", label: "分析结果预览" },
  { value: "risk-upload", label: "风险JSON上传" },
  { value: "instrument", label: "插桩处理" },
  { value: "build-fuzz", label: "构建 Fuzz 目标" },
] as const;

type OfflineTab = (typeof offlineTabOptions)[number]["value"];

type ScopeName =
  | "source"
  | "specs"
  | "seeds"
  | "risk"
  | "build"
  | "dicts"
  | "debug_replay_scripts";

interface ProtocolAssetBindings {
  protocol: string;
  sourceRef: string;
  sourceDisplay: string;
  specFileRef: string;
  specFileDisplay: string;
  specsDirRef: string;
  specsDirDisplay: string;
  seedsOutputRef: string;
  seedsOutputDisplay: string;
  riskAnalysisRef: string;
  riskAnalysisDisplay: string;
  instrumentedOutputRef: string;
  instrumentedOutputDisplay: string;
  buildSourceRef: string;
  buildSourceDisplay: string;
  buildInputRef: string;
  buildInputDisplay: string;
  dictRef: string;
  dictDisplay: string;
}

function entriesOf(
  record?: Record<string, number>,
): Array<{ name: string; value: number }> {
  return Object.entries(record ?? {}).map(([name, value]) => ({ name, value }));
}

function optionalPath(value?: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function normalizeProtocolText(value?: string | null): string {
  return value?.trim() ?? "";
}

function protocolNameFromResponse(data: ProtocolAnalyzeResponse): string {
  if (typeof data.protocol === "string") return data.protocol;
  return data.protocol?.protocol_name ?? data.protocol?.protocol ?? data.protocol_name ?? "";
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function protocolPrimaryPathFromResponse(data: ProtocolAnalyzeResponse): string {
  const record = data as Record<string, unknown>;

  for (const key of ["path", "output_path", "spec_path", "copied_to", "workspace_path"]) {
    const candidate = stringField(record, key);
    if (candidate) return candidate;
  }

  return "";
}

function protocolRelatedPathsFromResponse(data: ProtocolAnalyzeResponse): string[] {
  const record = data as Record<string, unknown>;

  return Array.from(
    new Set(
      ["path", "output_path", "spec_path", "workspace_path", "copied_to"]
        .map((key) => stringField(record, key))
        .filter(Boolean),
    ),
  );
}

function workspaceRef(protocol: string, scope: ScopeName, relativePath = ""): string {
  const normalizedProtocol = normalizeProtocolText(protocol);
  const cleaned = relativePath.replace(/^\/+/, "").replace(/\\/g, "/");
  return cleaned
    ? `workspace://${normalizedProtocol}/${scope}/${cleaned}`
    : `workspace://${normalizedProtocol}/${scope}/`;
}

function parseWorkspaceRefValue(value?: string | null): { protocol: string; scope: string; virtualPath: string } | null {
  const ref = String(value ?? "").trim();
  const match = /^workspace:\/\/([^/]+)\/([^/]+)(\/.*)?$/.exec(ref);
  if (!match) return null;
  return {
    protocol: match[1],
    scope: match[2],
    virtualPath: match[3] || "/",
  };
}

function parsePreviewContent(preview?: WorkspacePreviewResponse | null): unknown {
  if (!preview?.content) return null;
  if (preview.preview_type === "json") {
    try {
      return JSON.parse(preview.content);
    } catch {
      return preview.content;
    }
  }
  return preview.content;
}

function formatFileSize(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(value >= 10 * 1024 ? 0 : 1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

async function loadWorkspacePreviewByRef(workspaceRefValue?: string | null): Promise<WorkspacePreviewResponse | null> {
  const parts = parseWorkspaceRefValue(workspaceRefValue);
  if (!parts) return null;
  try {
    return await assetsApi.getWorkspacePreview(parts.protocol, parts.scope, parts.virtualPath);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) return null;
    throw error;
  }
}

async function loadWorkspaceTreeItemsByRef(workspaceRefValue?: string | null): Promise<WorkspaceTreeItem[]> {
  const parts = parseWorkspaceRefValue(workspaceRefValue);
  if (!parts) return [];
  try {
    const payload = await assetsApi.getWorkspaceTree(parts.protocol, parts.scope, parts.virtualPath, { refresh: true });
    return (payload.items ?? []).filter((item) => item.type === "file");
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) return [];
    throw error;
  }
}

function scopeDisplay(scope: ScopeName, relativePath = "", trailingSlash = false): string {
  const cleaned = relativePath.replace(/^\/+/, "").replace(/\\/g, "/");
  if (!cleaned) return `${scope}/`;
  return trailingSlash ? `${scope}/${cleaned.replace(/\/+$/, "")}/` : `${scope}/${cleaned}`;
}

function resolveExistingProtocol(value: string, options: string[]): string | null {
  const current = normalizeProtocolText(value).toLowerCase();
  if (!current) return null;
  const matched = options.find((item) => item.trim().toLowerCase() === current);
  return matched ? matched.trim() : null;
}


function buildProtocolAssetBindings(protocol?: string | null): ProtocolAssetBindings | null {
  const normalizedProtocol = normalizeProtocolText(protocol);
  if (!normalizedProtocol) return null;

  return {
    protocol: normalizedProtocol,
    sourceRef: workspaceRef(normalizedProtocol, "source"),
    sourceDisplay: scopeDisplay("source", "", true),
    specFileRef: workspaceRef(normalizedProtocol, "specs", FIXED_PROTOCOL_SPEC_NAME),
    specFileDisplay: scopeDisplay("specs", FIXED_PROTOCOL_SPEC_NAME),
    specsDirRef: workspaceRef(normalizedProtocol, "specs"),
    specsDirDisplay: scopeDisplay("specs", "", true),
    seedsOutputRef: workspaceRef(normalizedProtocol, "seeds", "bin"),
    seedsOutputDisplay: scopeDisplay("seeds", "bin", true),
    riskAnalysisRef: workspaceRef(normalizedProtocol, "risk", `analyses/${FIXED_RISK_ANALYSIS_NAME}`),
    riskAnalysisDisplay: scopeDisplay("risk", `analyses/${FIXED_RISK_ANALYSIS_NAME}`),
    instrumentedOutputRef: workspaceRef(normalizedProtocol, "risk", "instrumented"),
    instrumentedOutputDisplay: scopeDisplay("risk", "instrumented", true),
    buildSourceRef: workspaceRef(normalizedProtocol, "source"),
    buildSourceDisplay: scopeDisplay("source", "", true),
    buildInputRef: workspaceRef(normalizedProtocol, "seeds", "bin"),
    buildInputDisplay: scopeDisplay("seeds", "bin", true),
    dictRef: workspaceRef(normalizedProtocol, "dicts", FIXED_DICT_FILENAME),
    dictDisplay: scopeDisplay("dicts", FIXED_DICT_FILENAME),
  };
}

function riskAnalysisPathFromResponse(data: Record<string, unknown>): string {
  for (const key of ["mirrored_to", "saved_path", "result_path", "output_path", "analysis_path", "path", "copied_to"]) {
    const value = stringField(data, key);
    if (value) return value;
  }
  return "";
}

function countByField(items: Array<Record<string, unknown>> | undefined, key: string, fallback: string): Array<{ name: string; value: number }> {
  const counts = new Map<string, number>();
  for (const item of items ?? []) {
    const raw = item?.[key];
    const name = typeof raw === "string" && raw.trim() ? raw.trim() : fallback;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
}

function topMetricBars(record?: Record<string, number>, limit = 6): Array<{ name: string; value: number }> {
  return entriesOf(record).sort((a, b) => b.value - a.value).slice(0, limit);
}

function kbEntryKey(entry?: KbEntry | null, fallback = "entry"): string {
  if (!entry) return fallback;
  return String(entry.entry_id ?? entry.vuln_id ?? entry.doc_id ?? entry.title ?? entry.file_path ?? fallback);
}

function kbTopEntries(summary?: Record<string, unknown>, entries: KbEntry[] = []): KbEntry[] {
  const top = Array.isArray(summary?.top_entries) ? (summary?.top_entries as KbEntry[]) : [];
  return top.length ? top : entries.slice(0, 6);
}

function previewRawSummary(data?: RiskPreviewResponse | null): Record<string, unknown> {
  if (!data) return {};
  return {
    status: data.status,
    findings: data.findings?.length ?? data.items?.length ?? 0,
    size: data.size ?? 0,
    analysis_path: data.analysis_path ?? "",
  };
}

function previewStatusLabel(status: unknown): string {
  const raw = typeof status === "string" ? status.trim() : "";
  const normalized = raw.toLowerCase();

  switch (normalized) {
    case "":
    case "idle":
      return "待预览";
    case "ready":
    case "done":
    case "success":
    case "ok":
      return "已生成";
    case "running":
    case "processing":
      return "处理中";
    case "failed":
    case "error":
      return "失败";
    default:
      return raw || "待预览";
  }
}

function instrumentCounts(data?: InstrumentResponse | null): { inserted: number; rejected: number; warnings: number } {
  return {
    inserted: data?.inserted_markers ?? data?.applied_insertions?.length ?? 0,
    rejected: data?.rejected_insertions?.length ?? 0,
    warnings: data?.validation_warnings?.length ?? 0,
  };
}

function timelineKinds(events?: Array<Record<string, unknown>>): Array<{ name: string; value: number }> {
  const counts = new Map<string, number>();
  for (const event of events ?? []) {
    const raw = event?.kind;
    const name = typeof raw === "string" && raw.trim() ? raw.trim() : "event";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
}

function resultStatusCard({
  title,
  running,
  operationId,
  note,
}: {
  title: string;
  running: boolean;
  operationId?: string;
  note: string;
}): JSX.Element {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/45 px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Activity className={cn("size-4", running ? "text-primary" : "text-muted-foreground")} />
        {title}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
      <p className="mt-2 text-xs text-muted-foreground">operation_id: {operationId ?? "-"}</p>
    </div>
  );
}
function FixedPathField({
  label,
  description,
  value,
}: {
  label: string;
  description?: string;
  value: string;
}): JSX.Element {
  return (
    <FormField label={label} description={description}>
      <Input value={value} readOnly className="text-sm" />
    </FormField>
  );
}

async function uploadRiskJsonFile({
  protocol,
  file,
  operationId,
}: {
  protocol: string;
  file: File;
  operationId: string;
}): Promise<RiskUploadResponse> {
  const formData = new FormData();
  formData.append("protocol", normalizeProtocolText(protocol) || "");
  formData.append("operation_id", operationId);
  formData.append("file", file);

  const response = await apiClient.requestEnvelope<RiskUploadResponse>(
    "/api/v1/offline/risk/upload",
    {
      method: "POST",
      body: formData,
      operationId,
    },
  );

  return response.data;
}

function ProtocolComboInput({
  value,
  options,
  placeholder = "输入并匹配已有协议名",
  onValueChange,
  onCommit,
  onOpen,
}: {
  value: string;
  options: string[];
  placeholder?: string;
  onValueChange: (value: string) => void;
  onCommit?: (value: string) => void | Promise<void>;
  onOpen?: () => void | Promise<void>;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const current = normalizeProtocolText(value);
  const matched = resolveExistingProtocol(current, options);

  const filtered = useMemo(() => {
    const keyword = current.toLowerCase();
    const source = options.map((item) => item.trim()).filter(Boolean);
    const unique = Array.from(new Set(source));

    if (!keyword) return unique.slice(0, 12);

    return unique
      .filter((item) => item.toLowerCase().includes(keyword))
      .slice(0, 12);
  }, [current, options]);

  const toggleDropdown = (): void => {
    setOpen((prev) => {
      const next = !prev;
      if (next) void onOpen?.();
      return next;
    });
  };

  const openDropdown = (): void => {
    setOpen(true);
    void onOpen?.();
  };

  const commit = async (nextValue?: string): Promise<void> => {
    const normalized = normalizeProtocolText(nextValue ?? current);
    const exact = resolveExistingProtocol(normalized, options);
    if (!exact) {
      setOpen(false);
      return;
    }

    onValueChange(exact);
    setOpen(false);
    await onCommit?.(exact);
  };

  return (
    <div className="relative w-full overflow-visible">
      <Input
        value={value}
        placeholder={placeholder}
        className={cn(
          "pr-10 focus-visible:ring-inset",
          current && !matched && "border-warning/60 text-warning focus-visible:ring-warning/40",
        )}
        onChange={(event) => {
          onValueChange(event.target.value);
          openDropdown();
        }}
        onBlur={() => {
          window.setTimeout(() => {
            setOpen(false);
            void commit();
          }, 120);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void commit(current);
          }

          if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      <button
        type="button"
        className="absolute inset-y-0 right-2 inline-flex items-center justify-center rounded-md px-1 text-muted-foreground hover:text-foreground"
        onMouseDown={(event) => event.preventDefault()}
        onClick={toggleDropdown}
        aria-label="展开协议列表"
      >
        <ChevronDown className="size-4" />
      </button>

      {open ? (
        <div className="absolute inset-x-0 top-[calc(100%+0.25rem)] z-50 max-h-60 w-full overflow-y-auto rounded-[var(--radius-lg)] border border-border bg-popover p-1 shadow-console">
          {filtered.length ? (
            filtered.map((protocol) => (
              <button
                key={protocol}
                type="button"
                className="flex w-full min-w-0 items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void commit(protocol)}
              >
                <span className="min-w-0 truncate">{protocol}</span>
                <span className="shrink-0 text-xs text-muted-foreground">已有</span>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              暂无匹配协议
            </div>
          )}
        </div>
      ) : null}

      {current && !matched ? (
        <p className="mt-2 text-xs text-warning">必须完全匹配已有协议资产名后才能提交。</p>
      ) : null}
    </div>
  );
}

export function OfflineStudioView(): JSX.Element {
  const addReference = useWorkspaceStore((state) => state.addReference);
  const [searchParams, setSearchParams] = useSearchParams();
  const [uploadResult, setUploadResult] = useState<RiskUploadResponse | null>(
    null,
  );
  const [uploadError, setUploadError] = useState<unknown>();
  const [operationIds, setOperationIds] = useState<
    Partial<Record<OfflineTab, string>>
  >({});
  const [vuldocProtocol, setVuldocProtocol] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string>("");
  const [kbKeyword, setKbKeyword] = useState("");
  const [selectedKbEntryId, setSelectedKbEntryId] = useState("");
  const [riskUploadProtocol, setRiskUploadProtocol] = useState("");
  const [riskUploadRunning, setRiskUploadRunning] = useState(false);
  const [cancelRequestedTabs, setCancelRequestedTabs] = useState<Partial<Record<OfflineTab, boolean>>>({});
  const [cancelingOperationId, setCancelingOperationId] = useState<string | null>(null);
  const [protocolPreviewReadyOperationId, setProtocolPreviewReadyOperationId] = useState<string | null>(null);

  const protocolsQuery = useQuery({
    queryKey: ["protocols"],
    queryFn: protocolsApi.listProtocols,
    retry: 0,
  });

  const protocolOptions = useMemo(() => {
    const list = (protocolsQuery.data ?? [])
      .map((item) => String(item).trim())
      .filter(Boolean);

    return Array.from(new Set(list));
  }, [protocolsQuery.data]);

  const selectedVuldocProtocol = resolveExistingProtocol(vuldocProtocol, protocolOptions);

  const kbSummaryQuery = useQuery({
    queryKey: ["kb-summary", selectedVuldocProtocol],
    queryFn: () => kbApi.summary(selectedVuldocProtocol || ""),
    enabled: Boolean(selectedVuldocProtocol),
  });
  const kbGraphQuery = useQuery({
    queryKey: ["kb-graph", selectedVuldocProtocol],
    queryFn: () => kbApi.graph(selectedVuldocProtocol || ""),
    enabled: Boolean(selectedVuldocProtocol),
  });
  const kbTimelineQuery = useQuery({
    queryKey: ["kb-timeline", selectedVuldocProtocol],
    queryFn: () => kbApi.timeline(selectedVuldocProtocol || ""),
    enabled: Boolean(selectedVuldocProtocol),
  });
  const vuldocsQuery = useQuery({
    queryKey: ["vuldocs", selectedVuldocProtocol],
    queryFn: () => vuldocsApi.list(selectedVuldocProtocol || ""),
    enabled: Boolean(selectedVuldocProtocol),
  });
  const kbSearchQuery = useQuery({
    queryKey: ["kb-search", selectedVuldocProtocol, kbKeyword],
    queryFn: () =>
      kbApi.search(selectedVuldocProtocol || "", { keyword: kbKeyword, limit: 50 }),
    enabled: Boolean(selectedVuldocProtocol),
  });

  const protocolForm = useForm<z.infer<typeof protocolSchema>>({
    resolver: zodResolver(protocolSchema),
    defaultValues: {
      protocol: "",
      content: "",
    },
  });
  const seedsForm = useForm<z.infer<typeof seedsSchema>>({
    resolver: zodResolver(seedsSchema),
    defaultValues: {
      protocol: "",
      keyword: "",
      count: 8,
      use_kb_assist: true,
      allow_fallback: true,
    },
  });
  const riskAnalyzeForm = useForm<z.infer<typeof riskAnalyzeSchema>>({
    resolver: zodResolver(riskAnalyzeSchema),
    defaultValues: {
      protocol: "",
      max_workers: 4,
      llm_concurrency: 2,
      timeout_sec: 1800,
      use_static_prefilter: true,
      chunk_strategy: "function",
    },
  });
  const riskPreviewForm = useForm<z.infer<typeof riskPreviewSchema>>({
    resolver: zodResolver(riskPreviewSchema),
    defaultValues: { protocol: "" },
  });
  const instrumentForm = useForm<z.infer<typeof instrumentSchema>>({
    resolver: zodResolver(instrumentSchema),
    defaultValues: {
      protocol: "",
      in_place: false,
      compile_check: true,
      strict_ast_validation: true,
    },
  });
  const buildPlanForm = useForm<z.infer<typeof buildPlanSchema>>({
    resolver: zodResolver(buildPlanSchema),
    defaultValues: {
      protocol: "",
      compiler: "afl-clang-fast",
      instrumentation_mode: "llvm",
    },
  });

  const protocolInputValue = protocolForm.watch("protocol");
  const seedsProtocolInputValue = seedsForm.watch("protocol");
  const riskAnalyzeProtocolInputValue = riskAnalyzeForm.watch("protocol");
  const riskPreviewProtocolInputValue = riskPreviewForm.watch("protocol");
  const instrumentProtocolInputValue = instrumentForm.watch("protocol");
  const buildProtocolInputValue = buildPlanForm.watch("protocol");

  const selectedProtocolForAnalyze = resolveExistingProtocol(protocolInputValue, protocolOptions);
  const selectedProtocolForSeeds = resolveExistingProtocol(seedsProtocolInputValue, protocolOptions);
  const selectedProtocolForRiskAnalyze = resolveExistingProtocol(riskAnalyzeProtocolInputValue, protocolOptions);
  const selectedProtocolForRiskPreview = resolveExistingProtocol(riskPreviewProtocolInputValue, protocolOptions);
  const selectedProtocolForInstrument = resolveExistingProtocol(instrumentProtocolInputValue, protocolOptions);
  const selectedProtocolForRiskUpload = resolveExistingProtocol(riskUploadProtocol, protocolOptions);
  const buildProtocol = resolveExistingProtocol(buildProtocolInputValue, protocolOptions) ?? "";

  const protocolAssets = useMemo(() => buildProtocolAssetBindings(selectedProtocolForAnalyze), [selectedProtocolForAnalyze]);
  const seedsAssets = useMemo(() => buildProtocolAssetBindings(selectedProtocolForSeeds), [selectedProtocolForSeeds]);
  const riskAnalyzeAssets = useMemo(() => buildProtocolAssetBindings(selectedProtocolForRiskAnalyze), [selectedProtocolForRiskAnalyze]);
  const riskPreviewAssets = useMemo(() => buildProtocolAssetBindings(selectedProtocolForRiskPreview), [selectedProtocolForRiskPreview]);
  const instrumentAssets = useMemo(() => buildProtocolAssetBindings(selectedProtocolForInstrument), [selectedProtocolForInstrument]);
  const riskUploadAssets = useMemo(() => buildProtocolAssetBindings(selectedProtocolForRiskUpload), [selectedProtocolForRiskUpload]);
  const buildAssets = useMemo(() => buildProtocolAssetBindings(buildProtocol), [buildProtocol]);

  const buildProbeQuery = useQuery({
    queryKey: ["build-probe", buildProtocol],
    queryFn: () => buildAssistantApi.probe(buildProtocol),
    enabled: Boolean(buildProtocol),
  });
  const buildPlansQuery = useQuery({
    queryKey: ["build-plans", buildProtocol],
    queryFn: () => buildAssistantApi.listPlans(buildProtocol),
    enabled: Boolean(buildProtocol),
  });
  const buildRunsQuery = useQuery({
    queryKey: ["build-runs", buildProtocol],
    queryFn: () => buildAssistantApi.listRuns(buildProtocol),
    enabled: Boolean(buildProtocol),
  });
  const buildTargetsQuery = useQuery({
    queryKey: ["build-targets", buildProtocol],
    queryFn: () => buildAssistantApi.listTargets(buildProtocol),
    enabled: Boolean(buildProtocol),
  });
  const launchProfilesQuery = useQuery({
    queryKey: ["launch-profiles", buildProtocol],
    queryFn: () => buildAssistantApi.listLaunchProfiles(buildProtocol),
    enabled: Boolean(buildProtocol),
  });

  const activeTab = useMemo((): OfflineTab => {
    const tab = searchParams.get("tab");
    return offlineTabOptions.some((item) => item.value === tab)
      ? (tab as OfflineTab)
      : "protocol";
  }, [searchParams]);

  const setActiveTab = (nextTab: OfflineTab): void => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", nextTab);
    setSearchParams(nextParams, { replace: true });
  };

  const setOp = (tab: OfflineTab, id: string): void => {
    setOperationIds((state) => ({ ...state, [tab]: id }));
    setCancelRequestedTabs((state) => ({ ...state, [tab]: false }));
  };

  const cancelOperationMutation = useMutation({
    mutationFn: ({ operationId }: { operationId: string }) =>
      operationsApi.cancelOperation(operationId, "Stopped from offline studio"),
    onMutate: ({ operationId }) => {
      setCancelingOperationId(operationId);
    },
    onSettled: () => {
      setCancelingOperationId(null);
    },
  });

  const requestStop = (tab: OfflineTab, operationId?: string): void => {
    if (!operationId) return;
    cancelOperationMutation.mutate({ operationId }, {
      onSuccess: () => {
        setCancelRequestedTabs((state) => ({ ...state, [tab]: true }));
      },
    });
  };

  const isCancellingOperation = (operationId?: string): boolean =>
    Boolean(operationId) && cancelOperationMutation.isPending && cancelingOperationId === operationId;

  const protocolMutation = useMutation({
    mutationFn: offlineApi.protocolAnalyze,
    onMutate: () => {
      setProtocolPreviewReadyOperationId(null);
    },
    onSuccess: async (data: ProtocolAnalyzeResponse, variables) => {
      const specPath = protocolPrimaryPathFromResponse(data);
      const relatedPaths = protocolRelatedPathsFromResponse(data);
      const protocolValue = protocolNameFromResponse(data) || protocolForm.getValues("protocol");

      addReference({
        type: "protocol",
        label: protocolValue ? `协议规范提取结果 · ${protocolValue}` : "协议规范提取结果",
        primaryPath: specPath,
        relatedPaths,
        data,
      });

      seedsForm.setValue("protocol", protocolValue, { shouldDirty: true, shouldValidate: true });
      riskAnalyzeForm.setValue("protocol", protocolValue, { shouldDirty: true, shouldValidate: true });
      riskPreviewForm.setValue("protocol", protocolValue, { shouldDirty: true, shouldValidate: true });
      instrumentForm.setValue("protocol", protocolValue, { shouldDirty: true, shouldValidate: true });
      buildPlanForm.setValue("protocol", protocolValue, { shouldDirty: true, shouldValidate: true });
      setVuldocProtocol(protocolValue);
      setRiskUploadProtocol(protocolValue);
      setProtocolPreviewReadyOperationId(data.operation_id ?? String(variables.operation_id ?? ""));

      await protocolsQuery.refetch();
    },
  });

  const seedsMutation = useMutation({
    mutationFn: offlineApi.generateSeeds,
    onSuccess: (data: SeedGenerateResponse) =>
      addReference({
        type: "seeds",
        label: `种子结果 · ${data.generation_mode ?? data.mode ?? "spec"}`,
        primaryPath:
          data.output_dir ?? data.text_output_dir ?? data.spec_path ?? "",
        relatedPaths: [
          data.output_dir ?? "",
          data.text_output_dir ?? "",
          data.bin_output_dir ?? "",
        ].filter(Boolean),
        data,
      }),
  });

  const riskAnalyzeMutation = useMutation({
    mutationFn: offlineApi.riskAnalyze,
    onSuccess: (data: RiskAnalyzeResponse) => {
      const analysisPath = riskAnalysisPathFromResponse(data);
      const protocol = normalizeProtocolText(data.protocol) || riskAnalyzeForm.getValues("protocol");

      addReference({
        type: "risk-analysis",
        label: `风险路径分析结果 · ${data.summary?.total_findings ?? data.analysis?.total_findings ?? data.findings?.length ?? data.items?.length ?? 0} 项发现`,
        primaryPath: analysisPath,
        relatedPaths: [
          String(data.analysis_path ?? ""),
          String(data.output_path ?? ""),
          String(data.path ?? ""),
          String(data.result_path ?? ""),
          String(data.copied_to ?? ""),
        ].filter(Boolean),
        data,
      });

      riskPreviewForm.setValue("protocol", protocol, {
        shouldDirty: true,
        shouldValidate: true,
      });
      instrumentForm.setValue("protocol", protocol, {
        shouldDirty: true,
        shouldValidate: true,
      });
      setRiskUploadProtocol(protocol);
    },
  });

  const riskPreviewMutation = useMutation({
    mutationFn: offlineApi.riskPreview,
    onSuccess: (data: RiskPreviewResponse) => {
      const analysisPath = riskAnalysisPathFromResponse(data);

      addReference({
        type: "risk-preview",
        label: `分析结果预览 · ${data.status}`,
        primaryPath: analysisPath,
        relatedPaths: [analysisPath].filter(Boolean),
        data,
      });

    },
  });

  const instrumentMutation = useMutation({
    mutationFn: offlineApi.instrument,
    onSuccess: (data: InstrumentResponse) =>
      addReference({
        type: "instrument",
        label: `插桩结果 · ${data.inserted_markers ?? 0} 处标记`,
        primaryPath: data.output_path ?? data.analysis_path,
        relatedPaths: [
          data.output_path ?? "",
          ...(data.instrumented_files ?? []),
        ].filter(Boolean),
        data,
      }),
  });

  const buildPlanMutation = useMutation({
    mutationFn: ({ operationId, payload }: { operationId: string; payload: z.infer<typeof buildPlanSchema> }) =>
      buildAssistantApi.createPlan(payload.protocol, payload, operationId),
    onSuccess: async (data: BuildPlan) => {
      addReference({
        type: "build-plan",
        label: `BuildPlan · ${data.plan_id}`,
        primaryPath: data.source_ref,
        relatedPaths: [data.build_root_ref ?? "", ...data.steps.map((step) => step.cwd_ref)].filter(Boolean),
        data,
      });
      await buildPlansQuery.refetch();
    },
  });

  const buildRunMutation = useMutation({
    mutationFn: ({ protocol, planId, operationId }: { protocol: string; planId: string; operationId: string }) =>
      buildAssistantApi.runPlan(protocol, planId, operationId),
    onSuccess: async (data: BuildRun) => {
      addReference({
        type: "build-run",
        label: `BuildRun · ${data.build_id}`,
        primaryPath: data.log_ref,
        relatedPaths: [data.log_ref ?? "", ...data.targets.map((item) => item.binary_ref)].filter(Boolean),
        data,
      });
      await Promise.all([buildRunsQuery.refetch(), buildTargetsQuery.refetch(), launchProfilesQuery.refetch()]);
    },
  });

  const launchProfileMutation = useMutation({
    mutationFn: (payload: { protocol: string; target_id: string; build_id?: string; input_ref?: string; dict_ref?: string; operationId: string }) =>
      buildAssistantApi.predictLaunchProfile(payload.protocol, payload, payload.operationId),
    onSuccess: async (data: LaunchProfile) => {
      addReference({
        type: "launch-profile",
        label: `LaunchProfile · ${data.profile_id}`,
        primaryPath: data.binary_ref,
        relatedPaths: [data.binary_ref, data.cwd_ref ?? "", data.input_ref ?? "", data.output_ref ?? ""].filter(Boolean),
        data,
      });
      await launchProfilesQuery.refetch();
    },
  });

  const vuldocUploadMutation = useMutation({
    mutationFn: (input: {
      protocol: string;
      files: File[];
      operationId: string;
    }) => vuldocsApi.upload(input.protocol, input.files, input.operationId),
    onSuccess: async () => {
      await Promise.all([
        vuldocsQuery.refetch(),
        kbSummaryQuery.refetch(),
        kbGraphQuery.refetch(),
        kbTimelineQuery.refetch(),
        kbSearchQuery.refetch(),
      ]);
    },
  });

  const vuldocDistillMutation = useMutation({
    mutationFn: (input: {
      protocol: string;
      operationId: string;
      docIds?: string[];
    }) =>
      vuldocsApi.distill(input.protocol, {
        operation_id: input.operationId,
        doc_ids: input.docIds,
      }),
    onSuccess: async () => {
      await Promise.all([
        vuldocsQuery.refetch(),
        kbSummaryQuery.refetch(),
        kbGraphQuery.refetch(),
        kbTimelineQuery.refetch(),
        kbSearchQuery.refetch(),
      ]);
    },
  });

  const summary = kbSummaryQuery.data;
  const kbEntries = kbSearchQuery.data ?? [];
  const topKbEntries = kbTopEntries(summary, kbEntries);
  const kbNodeKinds = countByField(kbGraphQuery.data?.nodes, "type", "node");
  const kbEdgeKinds = countByField(kbGraphQuery.data?.edges, "type", "edge");
  const topCweBars = topMetricBars(summary?.by_cwe, 6);
  const topCweLabels = topCweBars.map((item) => item.name);
  const topCweValues = topCweBars.map((item) => item.value);
  const allKbEntries = useMemo(() => {
    const merged = [...topKbEntries, ...kbEntries];
    const seen = new Map<string, KbEntry>();

    merged.forEach((entry, index) => {
      seen.set(kbEntryKey(entry, `entry-${index}`), entry);
    });

    return Array.from(seen.values());
  }, [kbEntries, topKbEntries]);
  const selectedKbEntry = useMemo(() => {
    return allKbEntries.find((entry) => kbEntryKey(entry) === selectedKbEntryId) ?? allKbEntries[0] ?? null;
  }, [allKbEntries, selectedKbEntryId]);

  const protocolSpecPreviewQuery = useQuery({
    queryKey: ["offline", "protocol-spec-preview", protocolAssets?.specFileRef, protocolPreviewReadyOperationId],
    queryFn: () => loadWorkspacePreviewByRef(protocolAssets?.specFileRef),
    enabled: Boolean(protocolAssets?.specFileRef) && Boolean(protocolPreviewReadyOperationId),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const seedsOutputFilesQuery = useQuery({
    queryKey: ["offline", "seeds-output-files", seedsAssets?.seedsOutputRef, operationIds.seeds, seedsMutation.data?.output_dir],
    queryFn: () => loadWorkspaceTreeItemsByRef(seedsAssets?.seedsOutputRef),
    enabled: Boolean(seedsAssets?.seedsOutputRef) && (Boolean(operationIds.seeds) || Boolean(seedsMutation.data)),
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: seedsMutation.isPending ? 1200 : false,
  });

  const riskAnalysisPreviewQuery = useQuery({
    queryKey: ["offline", "risk-analysis-preview", riskAnalyzeAssets?.riskAnalysisRef, operationIds["risk-analyze"], riskAnalyzeMutation.data?.analysis_path],
    queryFn: () => loadWorkspacePreviewByRef(riskAnalyzeAssets?.riskAnalysisRef),
    enabled: Boolean(riskAnalyzeAssets?.riskAnalysisRef) && (Boolean(operationIds["risk-analyze"]) || Boolean(riskAnalyzeMutation.data)),
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: riskAnalyzeMutation.isPending ? 1200 : false,
  });

  const protocolPreviewData = useMemo(
    () =>
      parsePreviewContent(protocolSpecPreviewQuery.data) ??
      (protocolMutation.data
        ? {
            ...protocolMutation.data,
            frontend_reference: {
              primaryPath: protocolPrimaryPathFromResponse(protocolMutation.data),
              modelSpecRef: protocolAssets?.specFileRef ?? null,
              relatedPaths: protocolRelatedPathsFromResponse(protocolMutation.data),
            },
          }
        : { status: "idle" }),
    [protocolAssets?.specFileRef, protocolMutation.data, protocolSpecPreviewQuery.data],
  );

  const liveSeedItems = useMemo(
    () =>
      [...(seedsOutputFilesQuery.data ?? [])]
        .filter((item) => item.name !== "generation_metadata.json")
        .sort((left, right) => (right.updated_at ?? 0) - (left.updated_at ?? 0) || String(left.name).localeCompare(String(right.name))),
    [seedsOutputFilesQuery.data],
  );

  const liveRiskAnalyzeData = useMemo<RiskAnalyzeResponse | null>(() => {
    const parsed = parsePreviewContent(riskAnalysisPreviewQuery.data);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as RiskAnalyzeResponse;
  }, [riskAnalysisPreviewQuery.data]);

  useEffect(() => {
    if (!protocolMutation.isPending && cancelRequestedTabs.protocol) {
      setCancelRequestedTabs((state) => ({ ...state, protocol: false }));
    }
  }, [cancelRequestedTabs.protocol, protocolMutation.isPending]);

  useEffect(() => {
    if (!seedsMutation.isPending && cancelRequestedTabs.seeds) {
      setCancelRequestedTabs((state) => ({ ...state, seeds: false }));
    }
  }, [cancelRequestedTabs.seeds, seedsMutation.isPending]);

  useEffect(() => {
    if (!riskAnalyzeMutation.isPending && cancelRequestedTabs["risk-analyze"]) {
      setCancelRequestedTabs((state) => ({ ...state, "risk-analyze": false }));
    }
  }, [cancelRequestedTabs["risk-analyze"], riskAnalyzeMutation.isPending]);

  useOperationLogDockSync(
    [
      { operationId: operationIds.protocol, source: "offline", label: "Protocol analysis", enabled: protocolMutation.isPending && Boolean(operationIds.protocol) },
      { operationId: operationIds.seeds, source: "offline", label: "Seed generation", enabled: seedsMutation.isPending && Boolean(operationIds.seeds) },
      { operationId: operationIds["risk-analyze"], source: "offline", label: "Risk analysis", enabled: riskAnalyzeMutation.isPending && Boolean(operationIds["risk-analyze"]) },
      { operationId: operationIds["risk-preview"], source: "offline", label: "Risk preview", enabled: riskPreviewMutation.isPending && Boolean(operationIds["risk-preview"]) },
      { operationId: operationIds["risk-upload"], source: "offline", label: "Risk upload", enabled: riskUploadRunning && Boolean(operationIds["risk-upload"]) },
      { operationId: operationIds.instrument, source: "offline", label: "Instrumentation", enabled: instrumentMutation.isPending && Boolean(operationIds.instrument) },
      { operationId: operationIds["vuldocs-kb"], source: "offline", label: "Knowledge base", enabled: (vuldocUploadMutation.isPending || vuldocDistillMutation.isPending) && Boolean(operationIds["vuldocs-kb"]) },
      { operationId: operationIds["build-fuzz"], source: "offline", label: "Build fuzz target", enabled: (buildPlanMutation.isPending || buildRunMutation.isPending || launchProfileMutation.isPending) && Boolean(operationIds["build-fuzz"]) },
    ],
    1200,
  );

  const previewData = riskPreviewMutation.data ?? null;
  const previewFindings = previewData?.findings ?? previewData?.items ?? [];
  const previewSummary = previewRawSummary(previewData);
  const instrumentData = instrumentMutation.data ?? null;
  const instrumentSummary = instrumentCounts(instrumentData);
  const graphNodeCount = kbGraphQuery.data?.nodes?.length ?? 0;
  const graphEdgeCount = kbGraphQuery.data?.edges?.length ?? 0;
  const timelineEventCount = kbTimelineQuery.data?.events?.length ?? 0;
  const kbTimelineDonut = timelineKinds(kbTimelineQuery.data?.events);
  const recommendationFlow = [
    "协议源码提取规范",
    "初始种子生成",
    "VulDoc / KB 可选增强",
    "风险路径分析 / 预览 / 上传",
    "执行插桩",
    "创建 Fuzz 任务",
  ];

  return (
    <div className="space-y-6">
      <ApiErrorReporter error={uploadError} title="风险 JSON 上传失败" source="offline" />
      <ApiErrorReporter error={cancelOperationMutation.error} title="停止离线任务失败" source="offline" />
      <ApiErrorReporter error={protocolSpecPreviewQuery.error} title="协议规范实时预览失败" source="offline" />
      <ApiErrorReporter error={seedsOutputFilesQuery.error} title="种子文件列表读取失败" source="offline" />
      <ApiErrorReporter error={riskAnalysisPreviewQuery.error} title="风险分析实时预览失败" source="offline" />
      <ApiErrorReporter error={riskPreviewMutation.error} title="风险结果预览失败" source="offline" />
      <ApiErrorReporter error={instrumentMutation.error} title="插桩处理失败" source="offline" />
      <ApiErrorReporter error={vuldocUploadMutation.error} title="VulDoc 上传失败" source="offline" />
      <ApiErrorReporter error={vuldocDistillMutation.error} title="VulDoc 蒸馏失败" source="offline" />
      <ApiErrorReporter error={kbSummaryQuery.error} title="KB 摘要加载失败" source="offline" />
      <ApiErrorReporter error={kbGraphQuery.error} title="KB 图谱加载失败" source="offline" />
      <ApiErrorReporter error={kbTimelineQuery.error} title="KB 时间线加载失败" source="offline" />
      <ApiErrorReporter error={kbSearchQuery.error} title="KB 搜索失败" source="offline" />

      <PageHeader
        eyebrow="协议准备工作台"
        title="协议准备工作台"
        description="保留离线分析子功能，并新增 BuildPlan、BuildRun、LaunchProfile 的准备链路。"
      />

      <Card>
        <CardHeader>
          <CardTitle>当前准备上下文</CardTitle>
          <CardDescription>推荐优先使用 `workspace://` 引用；旧字段路径仍保持兼容。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Protocol</p>
            <p className="mt-2 text-sm">{buildProtocol || riskAnalyzeForm.watch("protocol") || seedsForm.watch("protocol") || "-"}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Source Ref</p>
            <p className="mt-2 break-all text-sm">{buildAssets?.buildSourceRef || "-"}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Latest LaunchProfile</p>
            <p className="mt-2 break-all text-sm">{launchProfilesQuery.data?.[0]?.profile_id ?? "-"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>离线分析增强的模糊测试流程</CardTitle>
          <CardDescription>每个模块都可以独立进行输入执行</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {recommendationFlow.map((item, index) => (
            <div
              key={item}
              className="flex items-center gap-3 rounded-full border border-border/60 bg-background/60 px-4 py-2 text-sm"
            >
              <span className="flex size-6 items-center justify-center rounded-full bg-primary/15 text-primary">
                {index + 1}
              </span>
              <span>{item}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>当前模块</CardTitle>
          <CardDescription>
            协议准备工作台子功能模块，下方快捷按钮可切换
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          {offlineTabOptions.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={option.value === activeTab ? "default" : "secondary"}
              size="sm"
              onClick={() => setActiveTab(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as OfflineTab)}
      >
        <TabsContent value="protocol">
          <div className="grid items-stretch gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <Card className="flex min-h-[400px] flex-1 flex-col overflow-hidden">
              <CardHeader>
                <CardTitle>协议规范提取</CardTitle>
                <CardDescription>
                  POST /api/v1/offline/protocol/analyze
                </CardDescription>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-y-auto">
                <form
                  className="grid gap-4 md:grid-cols-2"
                  onSubmit={protocolForm.handleSubmit((values) => {
                    const protocol = resolveExistingProtocol(values.protocol, protocolOptions);
                    const assets = buildProtocolAssetBindings(protocol);
                    if (!protocol || !assets) {
                      protocolForm.setError("protocol", { type: "validate", message: "请选择已有协议资产名" });
                      return;
                    }
                    const operation_id = createOperationId("protocol");
                    setOp("protocol", operation_id);
                    protocolMutation.mutate({
                      protocol,
                      source_ref: assets.sourceRef,
                      output_ref: assets.specFileRef,
                      name: FIXED_PROTOCOL_SPEC_NAME,
                      content: values.content?.trim() || undefined,
                      operation_id,
                    });
                  })}
                >
                  <FormField
                    label="协议名称 protocol"
                    description="选择已有协议资产后自动查找绑定资产路径"
                  >
                    <ProtocolComboInput
                      value={protocolForm.watch("protocol")}
                      options={protocolOptions}
                      onOpen={() => void protocolsQuery.refetch()}
                      onValueChange={(value) => {
                        protocolForm.clearErrors("protocol");
                        protocolForm.setValue("protocol", value, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                      }}
                      onCommit={async (value) => {
                        protocolForm.clearErrors("protocol");
                        protocolForm.setValue("protocol", value, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                        await protocolsQuery.refetch();
                      }}
                    />
                  </FormField>
                  <FixedPathField
                    label="源码路径 source_ref"
                    description="引用协议资产目录中的 source/ 路径"
                    value={protocolAssets?.sourceDisplay ?? "选择协议后自动生成"}
                  />
                  <FixedPathField
                    label="规范输出 output_ref"
                    description="输出到协议资产的 specs/ 路径"
                    value={protocolAssets?.specFileDisplay ?? "选择协议后自动生成"}
                  />
                  <FixedPathField
                    label="规范文件名 name"
                    description="规范提取固定的预设文件名"
                    value={FIXED_PROTOCOL_SPEC_NAME}
                  />
                  <div className="md:col-span-2">
                    <FormField label="手动提供规范内容 content" description="可选 | 填写后直接保存到预设规范路径，留空则走默认源码提取链路生成规范">
                      <Textarea {...protocolForm.register("content")} />
                    </FormField>
                  </div>
                  <div className="md:col-span-2 flex flex-wrap gap-3">
                    <Button type="submit" disabled={protocolMutation.isPending || !protocolAssets}>
                      <ScanSearch className="size-4" />
                      {protocolMutation.isPending
                        ? "分析中..."
                        : "开始协议规范提取"}
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      disabled={!protocolMutation.isPending || !operationIds.protocol || cancelRequestedTabs.protocol || isCancellingOperation(operationIds.protocol)}
                      onClick={() => requestStop("protocol", operationIds.protocol)}
                    >
                      <Square className="size-4" />
                      {cancelRequestedTabs.protocol || isCancellingOperation(operationIds.protocol) ? "停止中..." : "停止"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
            <div className="min-h-[400px] flex-1">
              <Card className="flex h-full min-h-0 flex-col overflow-hidden">
                <CardHeader className="shrink-0">
                  <CardTitle>协议提取结果</CardTitle>
                  <CardDescription>实时的后端动作和分析结果预览</CardDescription>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
                  <div className="h-[24vh] min-h-[18vh] max-h-[30vh] shrink-0">
                    <OperationLogPanel
                      operationId={operationIds.protocol}
                      running={protocolMutation.isPending}
                      title="当前动作"
                      maxLines={120}
                      pollIntervalMs={1000}
                      variant="compact"
                      eagerStart={false}
                      note={cancelRequestedTabs.protocol ? "已发送停止请求，当前已写出的规范文件会保留" : "捕获最近一次后端动作回显"}
                      className="h-full min-h-0"
                      logClassName="bg-background/45"
                    />
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border/60 bg-background/45 p-4">
                    <JsonViewer data={protocolPreviewData} compact />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="seeds">
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <Card className="flex min-h-[400px] flex-1 flex-col overflow-hidden">
              <CardHeader>
                <CardTitle>初始种子生成</CardTitle>
                <CardDescription>
                  依托协议源码资产和漏洞知识库的模糊输入初始种子生成
                </CardDescription>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-y-auto">
                <form
                  className="grid gap-4 md:grid-cols-2"
                  onSubmit={seedsForm.handleSubmit((values) => {
                    const protocol = resolveExistingProtocol(values.protocol, protocolOptions);
                    const assets = buildProtocolAssetBindings(protocol);
                    if (!protocol || !assets) {
                      seedsForm.setError("protocol", { type: "validate", message: "请选择已有协议资产名" });
                      return;
                    }
                    const operation_id = createOperationId("seeds");
                    setOp("seeds", operation_id);
                    seedsMutation.mutate({
                      protocol,
                      spec_ref: assets.specFileRef,
                      keyword: values.use_kb_assist ? values.keyword?.trim() ?? "" : "",
                      output_ref: assets.seedsOutputRef,
                      count: values.count,
                      allow_fallback: values.use_kb_assist ? values.allow_fallback : false,
                      use_kb_assist: values.use_kb_assist,
                      operation_id,
                    });
                  })}
                >
                  <FormField
                    label="协议名"
                    description="匹配已有协议资产，相关目录按协议查找结果自动绑定"
                  >
                    <ProtocolComboInput
                      value={seedsForm.watch("protocol")}
                      options={protocolOptions}
                      onOpen={() => void protocolsQuery.refetch()}
                      onValueChange={(value) => {
                        seedsForm.clearErrors("protocol");
                        seedsForm.setValue("protocol", value, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                      }}
                      onCommit={async (value) => {
                        seedsForm.clearErrors("protocol");
                        seedsForm.setValue("protocol", value, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                        await protocolsQuery.refetch();
                      }}
                    />
                  </FormField>
                  <FixedPathField
                    label="规范文件 spec_ref"
                    description="固定读取 specs/protocol_spec.json"
                    value={seedsAssets?.specFileDisplay ?? "选择协议后自动生成"}
                  />
                  <FixedPathField
                    label="规范目录 spec_dir"
                    description="协议规范目录固定为 specs/"
                    value={seedsAssets?.specsDirDisplay ?? "选择协议后自动生成"}
                  />
                  <FixedPathField
                    label="输出目录 output_ref"
                    description="固定写入 seeds/bin/ 目录"
                    value={seedsAssets?.seedsOutputDisplay ?? "选择协议后自动生成"}
                  />
                  <FormField label="关键词">
                    <Input
                      disabled={!seedsForm.watch("use_kb_assist")}
                      {...seedsForm.register("keyword")}
                    />
                  </FormField>
                  <FormField label="生成数量">
                    <Input type="number" {...seedsForm.register("count")} />
                  </FormField>
                  <div className="md:col-span-2 space-y-3 rounded-xl border border-border/60 bg-background/50 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          加入漏洞知识库辅助生成
                        </p>
                        <p className="text-xs text-muted-foreground">
                          会从匹配的协议名知识库中索引知识条目辅助生成
                        </p>
                      </div>
                      <Switch
                        checked={seedsForm.watch("use_kb_assist")}
                        onCheckedChange={(checked) => {
                          seedsForm.setValue("use_kb_assist", checked);
                          seedsForm.setValue("allow_fallback", checked);
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        允许依赖资料不足时降级生成
                      </span>
                      <Switch
                        checked={seedsForm.watch("allow_fallback")}
                        onCheckedChange={(checked) =>
                          seedsForm.setValue("allow_fallback", checked)
                        }
                      />
                    </div>
                  </div>
                  <div className="md:col-span-2 flex flex-wrap gap-3">
                    <Button type="submit" disabled={seedsMutation.isPending}>
                      <Wand2 className="size-4" />
                      {seedsMutation.isPending ? "生成中..." : "生成初始种子"}
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      disabled={!seedsMutation.isPending || !operationIds.seeds || cancelRequestedTabs.seeds || isCancellingOperation(operationIds.seeds)}
                      onClick={() => requestStop("seeds", operationIds.seeds)}
                    >
                      <Square className="size-4" />
                      {cancelRequestedTabs.seeds || isCancellingOperation(operationIds.seeds) ? "停止中..." : "停止"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
            <div className="min-h-[400px] flex-1">
              <Card className="flex h-full min-h-0 flex-col overflow-hidden">
                <CardHeader className="shrink-0">
                  <CardTitle>种子生成结果</CardTitle>
                  <CardDescription>实时后端阶段动作与结构化列表预览</CardDescription>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
                  <div className="h-[24vh] min-h-[18vh] max-h-[30vh] shrink-0">
                    <OperationLogPanel
                      operationId={operationIds.seeds}
                      running={seedsMutation.isPending}
                      title="当前动作"
                      maxLines={120}
                      pollIntervalMs={1000}
                      variant="compact"
                      eagerStart={false}
                      note={cancelRequestedTabs.seeds ? "已发送停止请求，当前已生成的种子文件会保留" : "捕获最近一次后端操作回显"}
                      className="h-full min-h-0"
                      logClassName="bg-background/45"
                    />
                  </div>
                  <div className="console-scrollbar min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border/60 bg-background/45 p-4">
                    {liveSeedItems.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border/70 bg-background/35 px-4 py-6 text-sm text-muted-foreground">
                        当前还没有已写出的种子文件。
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {liveSeedItems.map((item) => (
                          <div key={item.workspace_ref ?? item.virtual_path} className="rounded-2xl border border-border/60 bg-background/60 px-4 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="min-w-0 truncate text-sm font-medium text-foreground">{item.name}</p>
                              <Badge variant="outline">{formatFileSize(item.size)}</Badge>
                            </div>
                            <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{item.virtual_path}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        
        <TabsContent value="risk-analyze">
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <Card className="flex min-h-[400px] flex-1 flex-col overflow-hidden">
              <CardHeader>
                <CardTitle>风险路径分析</CardTitle>
                <CardDescription>
                  POST /api/v1/offline/risk/analyze
                </CardDescription>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-y-auto">
                <form
                  className="grid gap-4 md:grid-cols-2"
                  onSubmit={riskAnalyzeForm.handleSubmit((values) => {
                    const protocol = resolveExistingProtocol(values.protocol, protocolOptions);
                    const assets = buildProtocolAssetBindings(protocol);
                    if (!protocol || !assets) {
                      riskAnalyzeForm.setError("protocol", { type: "validate", message: "请选择已有协议资产名" });
                      return;
                    }
                    const operation_id = createOperationId("risk");
                    setOp("risk-analyze", operation_id);
                    riskAnalyzeMutation.mutate({
                      protocol,
                      source_ref: assets.sourceRef,
                      output_ref: assets.riskAnalysisRef,
                      operation_id,
                      max_workers: values.max_workers,
                      llm_concurrency: values.llm_concurrency,
                      chunk_strategy: values.chunk_strategy,
                      use_static_prefilter: values.use_static_prefilter,
                      timeout_sec: values.timeout_sec,
                    });
                  })}
                >
                  <FormField
                    label="协议名 protocol"
                    description="必须完全匹配已有协议资产，源码与分析输出路径按协议资产模型自动绑定。"
                  >
                    <ProtocolComboInput
                      value={riskAnalyzeForm.watch("protocol")}
                      options={protocolOptions}
                      onOpen={() => void protocolsQuery.refetch()}
                      onValueChange={(value) => {
                        riskAnalyzeForm.clearErrors("protocol");
                        riskAnalyzeForm.setValue("protocol", value, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                      }}
                      onCommit={async (value) => {
                        riskAnalyzeForm.clearErrors("protocol");
                        riskAnalyzeForm.setValue("protocol", value, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                        await protocolsQuery.refetch();
                      }}
                    />
                  </FormField>
                  <FixedPathField
                    label="源码路径 source_ref"
                    description="固定引用协议资产模型中的 source/ 目录。"
                    value={riskAnalyzeAssets?.sourceDisplay ?? "选择协议后自动生成"}
                  />
                  <FixedPathField
                    label="分析输出 output_ref"
                    description="固定写入 risk/analyses/final_analysis.json。"
                    value={riskAnalyzeAssets?.riskAnalysisDisplay ?? "选择协议后自动生成"}
                  />
                  <details className="md:col-span-2 rounded-xl border border-border/60 bg-background/50 p-4">
                    <summary className="cursor-pointer text-sm font-medium">高级选项：并发 pipeline / LLM / chunk</summary>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <FormField label="max_workers"><Input type="number" {...riskAnalyzeForm.register("max_workers")} /></FormField>
                      <FormField label="llm_concurrency"><Input type="number" {...riskAnalyzeForm.register("llm_concurrency")} /></FormField>
                      <FormField label="timeout_sec"><Input type="number" {...riskAnalyzeForm.register("timeout_sec")} /></FormField>
                      <FormField label="chunk_strategy"><Input {...riskAnalyzeForm.register("chunk_strategy")} /></FormField>
                      <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/60 px-4 py-3"><div className="min-w-0"><p className="text-sm font-medium">use_static_prefilter</p><p className="text-xs text-muted-foreground">先用静态预筛降低 LLM 压力</p></div><Switch className="shrink-0" checked={riskAnalyzeForm.watch("use_static_prefilter")} onCheckedChange={(checked) => riskAnalyzeForm.setValue("use_static_prefilter", checked)} /></div>
                    </div>
                  </details>
                  <div className="md:col-span-2 flex flex-wrap gap-3">
                    <Button
                      type="submit"
                      disabled={riskAnalyzeMutation.isPending || !riskAnalyzeAssets}
                    >
                      <ScanSearch className="size-4" />
                      {riskAnalyzeMutation.isPending
                        ? "分析中..."
                        : "运行风险路径分析"}
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      disabled={!riskAnalyzeMutation.isPending || !operationIds["risk-analyze"] || cancelRequestedTabs["risk-analyze"] || isCancellingOperation(operationIds["risk-analyze"])}
                      onClick={() => requestStop("risk-analyze", operationIds["risk-analyze"])}
                    >
                      <Square className="size-4" />
                      {cancelRequestedTabs["risk-analyze"] || isCancellingOperation(operationIds["risk-analyze"]) ? "停止中..." : "停止"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
            <div className="flex min-h-[400px] min-w-0 flex-col gap-4">
              <div className="h-[24vh] min-h-[18vh] max-h-[30vh] shrink-0">
                <OperationLogPanel
                  operationId={operationIds["risk-analyze"]}
                  running={riskAnalyzeMutation.isPending}
                  title="当前动作"
                  maxLines={120}
                  pollIntervalMs={1000}
                  variant="compact"
                  eagerStart={false}
                  note={cancelRequestedTabs["risk-analyze"] ? "已发送停止请求，当前已写出的分析结果会保留" : "仅捕获风险路径分析最近一次后端操作回显。"}
                  className="h-full min-h-0"
                  logClassName="bg-background/45"
                />
              </div>

              <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <CardHeader className="shrink-0">
                  <CardTitle>分析结果</CardTitle>
                  <CardDescription>下方显示 pipeline 的 summary / findings / failed_chunks / warnings。</CardDescription>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col">
                  <div className="console-scrollbar min-h-0 flex-1 overflow-y-auto rounded-xl border border-border/60 bg-card/70 p-4">
                    <RiskAnalysisSummary data={liveRiskAnalyzeData ?? riskAnalyzeMutation.data ?? null} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>


        <TabsContent value="risk-preview">
          <div className="grid gap-4 xl:grid-cols-[0.82fr_1.18fr_0.9fr]">
            <Card className="flex min-h-[30rem] flex-col overflow-hidden">
              <CardHeader className="border-b border-border/50">
                <CardTitle>风险结果预览</CardTitle>
                <CardDescription>读取风险分析输出文件预览详细结果</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 overflow-y-auto p-5">
                <form
                  className="space-y-4"
                  onSubmit={riskPreviewForm.handleSubmit((values) => {
                    const protocol = resolveExistingProtocol(values.protocol, protocolOptions);
                    const assets = buildProtocolAssetBindings(protocol);
                    if (!protocol || !assets) {
                      riskPreviewForm.setError("protocol", { type: "validate", message: "请选择已有协议资产名" });
                      return;
                    }
                    const operation_id = createOperationId("preview");
                    setOp("risk-preview", operation_id);
                    riskPreviewMutation.mutate({
                      protocol,
                      analysis_ref: assets.riskAnalysisRef,
                      operation_id,
                    });
                  })}
                >
                  <FormField
                    label="协议 protocol"
                    description="匹配已有协议资产 | 固定读取 risk/analyses/final_analysis.json"
                  >
                    <ProtocolComboInput
                      value={riskPreviewForm.watch("protocol")}
                      options={protocolOptions}
                      onOpen={() => void protocolsQuery.refetch()}
                      onValueChange={(value) => {
                        riskPreviewForm.clearErrors("protocol");
                        riskPreviewForm.setValue("protocol", value, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                      }}
                      onCommit={async (value) => {
                        riskPreviewForm.clearErrors("protocol");
                        riskPreviewForm.setValue("protocol", value, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                        await protocolsQuery.refetch();
                      }}
                    />
                  </FormField>
                  <FixedPathField
                    label="analysis_ref"
                    description="固定读取 risk/analyses/final_analysis.json"
                    value={riskPreviewAssets?.riskAnalysisDisplay ?? "选择协议后自动生成"}
                  />
                  <Button type="submit" className="w-full" disabled={riskPreviewMutation.isPending || !riskPreviewAssets}>
                    <CheckCircle2 className="size-4" />
                    {riskPreviewMutation.isPending ? "读取中..." : "查看预览"}
                  </Button>
                </form>
                <div className="h-[24vh] min-h-[18vh] max-h-[30vh] shrink-0">
                  <OperationLogPanel
                    operationId={operationIds["risk-preview"]}
                    running={riskPreviewMutation.isPending}
                    title="当前动作"
                    maxLines={120}
                    pollIntervalMs={1000}
                    variant="compact"
                    eagerStart={false}
                    note="仅捕获风险结果预览最近一次后端操作回显。"
                    className="h-full min-h-0"
                    logClassName="bg-background/45"
                  />
                </div>
              </CardContent>
            </Card>

              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <SummaryCard title="预览状态" value={previewStatusLabel(previewSummary.status)} hint="当前分析结果预览状态" valueClassName="text-[1.4rem] sm:text-[1.55rem]" statusColor="indigo" />
                  <SummaryCard title="风险条目" value={String(previewSummary.findings ?? 0)} hint="当前识别出的风险数量" valueClassName="text-[1.4rem] sm:text-[1.55rem]" statusColor="rose" />
                  <SummaryCard title="结果大小" value={String(previewSummary.size ?? 0)} hint="预览结果大小，单位为字节" valueClassName="text-[1.4rem] sm:text-[1.55rem]" statusColor="blue" />
                  <SummaryCard title="结果文件" value={previewSummary.analysis_path ? "已定位" : "缺失"} hint="分析结果文件是否已生成" valueClassName="text-[1.4rem] sm:text-[1.55rem]" statusColor="teal" />
                </div>

              <Card className="overflow-hidden">
                <CardHeader className="border-b border-border/50">
                  <CardTitle className="flex items-center gap-2">
                    <FileJson className="size-4 text-primary" />
                    预览主体
                  </CardTitle>
                  <CardDescription>展示预览文本与路径信息</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 p-5">
                  <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">analysis_path</p>
                    <p className="mt-2 break-all text-sm text-foreground">{typeof previewSummary.analysis_path === "string" && previewSummary.analysis_path.trim() ? previewSummary.analysis_path : typeof riskPreviewAssets?.riskAnalysisDisplay === "string" && riskPreviewAssets.riskAnalysisDisplay.trim() ? riskPreviewAssets.riskAnalysisDisplay : "-"}</p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">preview</p>
                    <pre className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                      {previewData?.preview?.trim() || "暂无预览文本"}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="overflow-hidden">
                <CardHeader className="border-b border-border/50">
                  <CardTitle className="flex items-center gap-2">
                    <Search className="size-4 text-primary" />
                    Findings 摘要
                  </CardTitle>
                  <CardDescription>字段详情</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 p-5">
                  {previewFindings.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-background/35 px-4 py-6 text-sm text-muted-foreground">
                      当前预览没有 findings
                    </div>
                  ) : (
                    previewFindings.slice(0, 6).map((finding, index) => (
                      <div key={`${finding.id ?? finding.file_path ?? index}`} className="rounded-2xl border border-border/60 bg-background/45 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{finding.severity ?? "risk"}</Badge>
                          <span className="text-sm font-medium">{finding.function_name ?? finding.file_path ?? "unknown target"}</span>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{finding.reason ?? finding.risk_type ?? "-"}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {finding.file_path ?? finding.file ?? "-"} / line {finding.line_start ?? finding.line ?? "-"}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <details className="card-surface rounded-2xl border border-border/60 bg-background/45 p-4">
                <summary className="cursor-pointer text-sm font-medium">原始预览 JSON</summary>
                <div className="mt-3">
                  <JsonViewer data={previewData ?? { status: "idle" }} compact />
                </div>
              </details>
            </div>
          </div>
        </TabsContent>

        
        <TabsContent value="risk-upload">
          <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
            <Card className="flex min-h-[400px] flex-1 flex-col overflow-hidden">
              <CardHeader>
                <CardTitle>风险分析结果JSON上传</CardTitle>
                <CardDescription>
                  单一外部风险路径结果文件上传
                </CardDescription>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-y-auto">
                <div className="space-y-4">
                  <FormField
                    label="协议名 protocol"
                    description="匹配已有协议资产 | 上传结果将写入该协议预设风险分析位置"
                  >
                    <ProtocolComboInput
                      value={riskUploadProtocol}
                      options={protocolOptions}
                      onOpen={() => void protocolsQuery.refetch()}
                      onValueChange={setRiskUploadProtocol}
                      onCommit={async (value) => {
                        setRiskUploadProtocol(value);
                        await protocolsQuery.refetch();
                      }}
                    />
                  </FormField>

                  <FixedPathField
                    label="目标分析文件"
                    description="上传结果将镜像到风险分析预设文件"
                    value={riskUploadAssets?.riskAnalysisDisplay ?? "选择协议后自动生成"}
                  />

                  <FormField label="风险结果文件">
                    <Input
                      type="file"
                      accept=".json"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;

                        const operationId = createOperationId("risk-upload");
                        const protocol = selectedProtocolForRiskUpload || "";
                        setOp("risk-upload", operationId);
                        setUploadError(undefined);
                        setRiskUploadRunning(true);

                        if (!protocol) {
                          setRiskUploadRunning(false);
                          setUploadError(new Error("请选择已有协议资产名后再上传风险结果"));
                          return;
                        }

                        try {
                          const response = await uploadRiskJsonFile({
                            protocol,
                            file,
                            operationId,
                          });
                          const analysisPath = riskAnalysisPathFromResponse(response);

                          setUploadResult(response);
                          addReference({
                            type: "risk-upload",
                            label: `风险JSON上传 · ${protocol} · ${file.name}`,
                            primaryPath: analysisPath,
                            relatedPaths: Array.from(
                              new Set([
                                response.saved_path ?? "",
                                response.mirrored_to ?? "",
                                response.path ?? "",
                                analysisPath,
                              ].filter(Boolean)),
                            ),
                            data: response,
                          });

                          riskPreviewForm.setValue("protocol", protocol, {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                          instrumentForm.setValue("protocol", protocol, {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                          await protocolsQuery.refetch();
                        } catch (error) {
                          setUploadError(error);
                        } finally {
                          setRiskUploadRunning(false);
                        }
                      }}
                    />
                  </FormField>
                  <div className="rounded-xl border border-border/60 bg-background/50 p-4 text-sm text-muted-foreground">
                    上传后的风险结果会被保存到兼容目录，并镜像为默认风险结果文件名
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>最近结果</CardTitle>
                <CardDescription>
                  接收外部输入生成的 final_analysis.json
                </CardDescription>
              </CardHeader>
              <CardContent>
                <JsonViewer data={uploadResult ?? { status: "idle" }} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>


        <TabsContent value="instrument">
          <div className="grid gap-4 xl:grid-cols-[0.84fr_1.22fr_0.9fr]">
            <Card className="flex min-h-[30rem] flex-col overflow-hidden">
              <CardHeader className="border-b border-border/50">
                <CardTitle>插桩处理</CardTitle>
                <CardDescription>接收参数启动插桩任务</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 overflow-y-auto p-5">
                <form
                  className="grid gap-4"
                  onSubmit={instrumentForm.handleSubmit((values) => {
                    const protocol = resolveExistingProtocol(values.protocol, protocolOptions);
                    const assets = buildProtocolAssetBindings(protocol);
                    if (!protocol || !assets) {
                      instrumentForm.setError("protocol", { type: "validate", message: "请选择已有协议资产名" });
                      return;
                    }
                    const operation_id = createOperationId("instrument");
                    setOp("instrument", operation_id);
                    instrumentMutation.mutate({
                      protocol,
                      source_ref: assets.sourceRef,
                      analysis_ref: assets.riskAnalysisRef,
                      output_ref: assets.instrumentedOutputRef,
                      in_place: values.in_place,
                      operation_id,
                      compile_check: values.compile_check,
                      strict_ast_validation: values.strict_ast_validation,
                    });
                  })}
                >
                  <FormField
                    label="协议 protocol"
                    description="匹配已有协议资产 | 路径按协议资产模型自动绑定"
                  >
                    <ProtocolComboInput
                      value={instrumentForm.watch("protocol")}
                      options={protocolOptions}
                      onOpen={() => void protocolsQuery.refetch()}
                      onValueChange={(value) => {
                        instrumentForm.clearErrors("protocol");
                        instrumentForm.setValue("protocol", value, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                      }}
                      onCommit={async (value) => {
                        instrumentForm.clearErrors("protocol");
                        instrumentForm.setValue("protocol", value, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                        await protocolsQuery.refetch();
                      }}
                    />
                  </FormField>
                  <FixedPathField
                    label="source_ref"
                    description="固定引用协议资产模型中的 source/ 目录"
                    value={instrumentAssets?.sourceDisplay ?? "选择协议后自动生成"}
                  />
                  <FixedPathField
                    label="analysis_ref"
                    description="固定读取 risk/analyses/final_analysis.json"
                    value={instrumentAssets?.riskAnalysisDisplay ?? "选择协议后自动生成"}
                  />
                  <FixedPathField
                    label="output_ref"
                    description="固定输出到 risk/instrumented/"
                    value={instrumentAssets?.instrumentedOutputDisplay ?? "选择协议后自动生成"}
                  />

                  <div className="grid gap-3">
                    <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/45 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">原地写回</p>
                        <p className="text-xs text-muted-foreground">直接覆盖原源码，通常不建议</p>
                      </div>
                      <Switch
                        checked={instrumentForm.watch("in_place")}
                        onCheckedChange={(checked) => instrumentForm.setValue("in_place", checked)}
                      />
                    </div>
                    <div className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/45 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">compile_check</p>
                        <p className="text-xs text-muted-foreground">要求后端执行编译校验并返回 compile_check 结果</p>
                      </div>
                      <Switch
                        className="shrink-0"
                        checked={instrumentForm.watch("compile_check")}
                        onCheckedChange={(checked) => instrumentForm.setValue("compile_check", checked)}
                      />
                    </div>
                    <div className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/45 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">strict_ast_validation</p>
                        <p className="text-xs text-muted-foreground">拒绝全局区、宏区、函数边界等不安全插桩点</p>
                      </div>
                      <Switch
                        className="shrink-0"
                        checked={instrumentForm.watch("strict_ast_validation")}
                        onCheckedChange={(checked) => instrumentForm.setValue("strict_ast_validation", checked)}
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={instrumentMutation.isPending || !instrumentAssets}>
                    <Wand2 className="size-4" />
                    {instrumentMutation.isPending ? "插桩中..." : "执行插桩"}
                  </Button>
                </form>
                <div className="h-[24vh] min-h-[18vh] max-h-[30vh] shrink-0">
                  <OperationLogPanel
                    operationId={operationIds.instrument}
                    running={instrumentMutation.isPending}
                    title="当前动作"
                    maxLines={120}
                    pollIntervalMs={1000}
                    variant="compact"
                    eagerStart={false}
                    note="捕获最近一次后端操作回显"
                    className="h-full min-h-0"
                    logClassName="bg-background/45"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="border-b border-border/50">
                <CardTitle>插桩主结果</CardTitle>
                <CardDescription>结构化结果和 compile_check 摘要</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-5">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <SummaryCard title="标记点" value={String(instrumentSummary.inserted)} hint="已插入的探针标记数量" valueClassName="text-[1.4rem] sm:text-[1.55rem]" statusColor="blue" />
                  <SummaryCard title="拒绝点" value={String(instrumentSummary.rejected)} hint="安全校验后拒绝的插桩点" valueClassName="text-[1.4rem] sm:text-[1.55rem]" statusColor="orange" />
                  <SummaryCard title="警告数" value={String(instrumentSummary.warnings)} hint="插桩校验产生的告警数量" valueClassName="text-[1.4rem] sm:text-[1.55rem]" statusColor="amber" />
                  <SummaryCard
                    title="编译检查"
                    value={instrumentData?.compile_check?.enabled ? (instrumentData?.compile_check?.passed ? "通过" : "失败") : "未启用"}
                    hint="插桩后编译校验结果"
                    valueClassName="text-[1.4rem] sm:text-[1.55rem]"
                    statusColor={instrumentData?.compile_check?.passed ? "emerald" : "danger"}
                  />
                </div>

                <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">output_path</p>
                      <p className="mt-2 break-all text-sm text-foreground">{instrumentData?.output_path ?? instrumentAssets?.instrumentedOutputDisplay ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">plan_path</p>
                      <p className="mt-2 break-all text-sm text-foreground">{instrumentData?.plan_path ?? "-"}</p>
                    </div>
                  </div>
                </div>

                <div className="console-scrollbar max-h-[18rem] overflow-y-auto rounded-2xl border border-border/60 bg-background/45 p-4">
                  <JsonViewer data={instrumentData ?? { status: "idle" }} compact />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="overflow-hidden">
                <CardHeader className="border-b border-border/50">
                  <CardTitle>插桩详情</CardTitle>
                  <CardDescription>详情字段渲染</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 p-5">
                  <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
                    <p className="font-medium">applied_insertions</p>
                    <p className="mt-2 text-xs text-muted-foreground">共 {instrumentData?.applied_insertions?.length ?? 0} 条</p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
                    <p className="font-medium">rejected_insertions</p>
                    <p className="mt-2 text-xs text-muted-foreground">共 {instrumentData?.rejected_insertions?.length ?? 0} 条</p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
                    <p className="font-medium">output_path</p>
                    <p className="mt-2 break-all text-muted-foreground">{instrumentData?.output_path ?? instrumentAssets?.instrumentedOutputDisplay ?? "-"}</p>
                  </div>
                </CardContent>
              </Card>

              <details className="card-surface rounded-2xl border border-border/60 bg-background/45 p-4">
                <summary className="cursor-pointer text-sm font-medium">原始插桩 JSON</summary>
                <div className="mt-3">
                  <JsonViewer data={instrumentData ?? { status: "idle" }} compact />
                </div>
              </details>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="vuldocs-kb">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard title="知识条目" value={String(summary?.total ?? 0)} hint="kb/summary" statusColor="violet" />
              <SummaryCard title="原始文档" value={String(vuldocsQuery.data?.length ?? 0)} hint="vuldocs" statusColor="indigo" />
              <SummaryCard title="图谱节点" value={String(graphNodeCount)} hint={`${graphEdgeCount} edges`} statusColor="cyan" />
              <SummaryCard title="时间线事件" value={String(timelineEventCount)} hint="kb/timeline" statusColor="blue" />
            </div>

            <div className="grid gap-4 xl:grid-cols-[0.78fr_1.22fr_0.92fr]">
              <Card className="flex min-h-[34rem] flex-col overflow-hidden">
                <CardHeader className="border-b border-border/50">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <UploadCloud className="size-4 text-primary" />
                    漏洞文档源
                  </CardTitle>
                  <CardDescription>提供上传、蒸馏和搜索参数入口</CardDescription>
                </CardHeader>
                <CardContent className="console-scrollbar flex-1 space-y-4 overflow-y-auto p-5">
                  <FormField
                    label="协议名"
                    description="选择已有协议资产，VulDoc / KB 将写入对应预设目录"
                  >
                    <ProtocolComboInput
                      value={vuldocProtocol}
                      options={protocolOptions}
                      onOpen={() => void protocolsQuery.refetch()}
                      onValueChange={setVuldocProtocol}
                      onCommit={async (value) => {
                        setVuldocProtocol(value);
                        await protocolsQuery.refetch();
                      }}
                    />
                  </FormField>

                  <FormField
                    label="漏洞文档"
                    description="支持多文件批量上传，按协议 workspace 归档"
                  >
                    <Input
                      type="file"
                      multiple
                      onChange={(event) => setSelectedFiles(Array.from(event.target.files ?? []))}
                    />
                  </FormField>

                  <Button
                    className="w-full"
                    disabled={!selectedFiles.length || vuldocUploadMutation.isPending || !selectedVuldocProtocol}
                    onClick={() => {
                      const operationId = createOperationId("vuldoc-upload");
                      setOp("vuldocs-kb", operationId);
                      if (!selectedVuldocProtocol) {
                        dockLog("warn", "offline", "VulDoc 上传需要先精确匹配一个已有协议资产名");
                        return;
                      }
                      vuldocUploadMutation.mutate({
                        protocol: selectedVuldocProtocol,
                        files: selectedFiles,
                        operationId,
                      });
                    }}
                  >
                    <UploadCloud className="size-4" />
                    上传文档
                  </Button>

                  <FormField
                    label="指定 doc_ids 蒸馏"
                    description="逗号或换行分隔 | 留空表示蒸馏该协议下全部文档。"
                  >
                    <Textarea
                      className="min-h-[7.5rem] resize-y"
                      value={selectedDocIds}
                      onChange={(event) => setSelectedDocIds(event.target.value)}
                    />
                  </FormField>

                  <Button
                    variant="secondary"
                    className="w-full"
                    disabled={vuldocDistillMutation.isPending || !selectedVuldocProtocol}
                    onClick={() => {
                      const operationId = createOperationId("vuldoc-distill");
                      setOp("vuldocs-kb", operationId);
                      const docIds = selectedDocIds
                        .split(/\r?\n|,/)
                        .map((x) => x.trim())
                        .filter(Boolean);

                      vuldocDistillMutation.mutate({
                        protocol: selectedVuldocProtocol || "",
                        operationId,
                        docIds: docIds.length ? docIds : undefined,
                      });
                    }}
                  >
                    <Wand2 className="size-4" />
                    蒸馏到知识库
                  </Button>

                  <div className="rounded-2xl border border-border/60 bg-background/45 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <ScanSearch className="size-4 text-primary" />
                      知识条目搜索
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Input
                        value={kbKeyword}
                        onChange={(event) => setKbKeyword(event.target.value)}
                        placeholder="输入关键词、CWE 或函数名"
                      />
                      <Button variant="outline" onClick={() => void kbSearchQuery.refetch()}>
                        搜索
                      </Button>
                    </div>
                  </div>

                  <div className="h-[24vh] min-h-[18vh] max-h-[30vh] shrink-0">
                    <OperationLogPanel
                      operationId={operationIds["vuldocs-kb"]}
                      running={vuldocUploadMutation.isPending || vuldocDistillMutation.isPending}
                      title="当前动作"
                      maxLines={120}
                      pollIntervalMs={1000}
                      variant="compact"
                      eagerStart={false}
                      note="捕获最近一次后端操作回显"
                      className="h-full min-h-0"
                      logClassName="bg-background/45"
                    />
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-background/45 px-4 py-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <LibraryBig className="size-4 text-primary" />
                      最近上传文档
                    </div>
                    <div className="mt-3 space-y-2">
                      {(vuldocsQuery.data ?? []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">当前协议下暂无文档归档。</p>
                      ) : (
                        (vuldocsQuery.data ?? []).slice(0, 6).map((doc: VulDocRecord) => (
                          <div key={doc.doc_id} className="rounded-xl border border-border/60 bg-background/55 px-3 py-3">
                            <p className="truncate text-sm font-medium">{doc.filename ?? doc.doc_id}</p>
                            <p className="mt-1 break-all text-xs text-muted-foreground">{doc.doc_id}</p>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {doc.size ?? 0} bytes
                              {doc.sha256 ? ` · ${String(doc.sha256).slice(0, 12)}...` : ""}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid min-h-[34rem] gap-4">
                <Card className="overflow-hidden">
                  <CardHeader className="border-b border-border/50">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Database className="size-4 text-primary" />
                      知识摘要与搜索命中
                    </CardTitle>
                    <CardDescription>上传结果 | 漏洞知识库记录字段摘要 | 热门条目、搜索命中和结构化字段</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 p-5 lg:grid-cols-[0.94fr_1.06fr]">
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Top entries</p>
                        <div className="mt-3 space-y-3">
                          {topKbEntries.length === 0 ? (
                            <p className="text-sm text-muted-foreground">当前无结构化知识条目。</p>
                          ) : (
                            topKbEntries.map((entry, index) => {
                              const key = kbEntryKey(entry, `top-${index}`);
                              const isActive = kbEntryKey(selectedKbEntry) === key;

                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => setSelectedKbEntryId(key)}
                                  className={cn(
                                    "w-full rounded-2xl border p-4 text-left transition-colors",
                                    isActive
                                      ? "border-[hsl(271_76%_58%/0.34)] bg-[hsl(278_100%_98%/0.88)] dark:border-[hsl(272_88%_76%/0.32)] dark:bg-[hsl(268_38%_24%/0.78)]"
                                      : "border-border/60 bg-background/45 hover:bg-background/65",
                                  )}
                                >
                                  <p className="text-sm font-semibold">{entry.title ?? entry.entry_id ?? entry.vuln_id}</p>
                                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{entry.summary ?? "-"}</p>
                                  <p className="mt-3 text-xs text-muted-foreground">
                                    {entry.coarse_type ?? "-"} / {entry.vuln_type ?? "-"} / {entry.cwe ?? "-"}
                                  </p>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">CWE Top</p>
                        <div className="mt-3">
                          <BarChart title="CWE Top" labels={topCweLabels} values={topCweValues} height={244} />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">搜索结果</p>
                          <span className="text-xs text-muted-foreground">{kbEntries.length} 条</span>
                        </div>
                        <div className="console-scrollbar mt-3 max-h-[30rem] space-y-3 overflow-y-auto pr-1">
                          {kbEntries.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-border/70 bg-background/35 px-4 py-8 text-sm text-muted-foreground">
                              当前没有搜索结果。请先选择协议，再输入关键词触发检索。
                            </div>
                          ) : (
                            kbEntries.map((entry, index) => {
                              const key = kbEntryKey(entry, `search-${index}`);
                              const isActive = kbEntryKey(selectedKbEntry) === key;

                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => setSelectedKbEntryId(key)}
                                  className={cn(
                                    "w-full rounded-2xl border p-4 text-left transition-colors",
                                    isActive
                                      ? "border-[hsl(var(--accent-blue)/0.28)] bg-[hsl(var(--accent-blue-light)/0.62)] dark:border-[hsl(216_90%_76%/0.24)] dark:bg-[hsl(223_34%_24%/0.74)]"
                                      : "border-border/60 bg-background/45 hover:bg-background/65",
                                  )}
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <p className="font-semibold">{entry.title ?? entry.entry_id ?? entry.vuln_id}</p>
                                    <span className="rounded-full border border-border/70 px-2.5 py-1 text-[11px] text-muted-foreground">
                                      置信度 {entry.confidence ?? "-"}
                                    </span>
                                  </div>
                                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{entry.summary ?? "暂无摘要"}</p>
                                  <p className="mt-3 text-xs text-muted-foreground">
                                    {entry.coarse_type ?? "-"} / {entry.vuln_type ?? "-"} / {entry.cwe ?? "-"} / {entry.function_name ?? entry.sink_function ?? "-"}
                                  </p>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid min-h-[34rem] gap-4 content-start">
                <Card className="overflow-hidden">
                  <CardHeader className="border-b border-border/50">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Network className="size-4 text-primary" />
                      图谱与状态摘要
                    </CardTitle>
                    <CardDescription>统计、引用和已选条目证据</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 p-5">
                    <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">coarse_type</p>
                      <div className="mt-3">
                        <DonutChart title="coarse_type" data={entriesOf(summary?.by_coarse_type)} height={260} legendItemsPerPage={6} />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">timeline kinds</p>
                      <div className="mt-3">
                        <DonutChart title="timeline" data={kbTimelineDonut} height={240} legendItemsPerPage={6} />
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">图谱节点类型</p>
                        <div className="mt-3">
                          <DonutChart title="graph nodes" data={kbNodeKinds} height={220} legendItemsPerPage={4} />
                        </div>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">图谱边关系</p>
                        <div className="mt-3">
                          <DonutChart title="graph edges" data={kbEdgeKinds} height={220} legendItemsPerPage={4} />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden">
                  <CardHeader className="border-b border-border/50">
                    <CardTitle className="text-base">条目证据与引用</CardTitle>
                    <CardDescription>摘要之外的详情</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 p-5">
                    {!selectedKbEntry ? (
                      <p className="text-sm text-muted-foreground">请选择一条知识条目查看详细证据</p>
                    ) : (
                      <>
                        <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
                          <p className="text-base font-semibold">{selectedKbEntry.title ?? selectedKbEntry.entry_id ?? selectedKbEntry.vuln_id}</p>
                          <p className="mt-2 text-sm text-muted-foreground">{selectedKbEntry.summary ?? "暂无摘要"}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {[
                              selectedKbEntry.coarse_type,
                              selectedKbEntry.vuln_type,
                              selectedKbEntry.cwe,
                            ]
                              .filter(Boolean)
                              .map((item) => (
                                <span key={item} className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-xs text-muted-foreground">
                                  {item}
                                </span>
                              ))}
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
                            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">定位</p>
                            <p className="mt-2 text-sm font-medium">{selectedKbEntry.function_name ?? selectedKbEntry.sink_function ?? "-"}</p>
                            <p className="mt-2 break-all text-xs text-muted-foreground">{selectedKbEntry.file_path ?? "-"}</p>
                          </div>
                          <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
                            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">输入与触发</p>
                            <p className="mt-2 text-sm text-foreground">{selectedKbEntry.trigger_condition ?? "暂无触发条件"}</p>
                            <p className="mt-2 text-xs text-muted-foreground">{selectedKbEntry.input_shape ?? "暂无输入形态"}</p>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">修复建议 / PoC</p>
                          <p className="mt-2 text-sm text-foreground">{selectedKbEntry.fix_hint ?? "暂无修复建议"}</p>
                          <p className="mt-3 text-sm text-muted-foreground">{selectedKbEntry.poc_hint ?? "暂无 PoC 提示"}</p>
                        </div>

                        <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">证据池</p>
                          <div className="console-scrollbar mt-3 max-h-[12rem] overflow-y-auto pr-1">
                            <JsonViewer data={selectedKbEntry.evidence ?? []} compact />
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card className="overflow-hidden">
                  <CardHeader className="border-b border-border/50">
                    <CardTitle className="text-base">原始返回快照</CardTitle>
                    <CardDescription>用于调试查看返回的JSON字段</CardDescription>
                  </CardHeader>
                  <CardContent className="p-5">
                    <div className="console-scrollbar max-h-[16rem] overflow-y-auto rounded-2xl border border-border/60 bg-background/45 p-4">
                      <JsonViewer
                        data={{
                          graph: kbGraphQuery.data ?? { nodes: [], edges: [] },
                          timeline: kbTimelineQuery.data?.events ?? [],
                          upload: vuldocUploadMutation.data as VulDocUploadResponse | undefined,
                          distill: vuldocDistillMutation.data as VulDocDistillResponse | undefined,
                        }}
                        compact
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </TabsContent>

        
        <TabsContent value="build-fuzz">
          <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>构建 Fuzz 目标</CardTitle>
                <CardDescription>BuildPlan / BuildRun 模块分别负责生成 / 执行计划</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form
                  className="grid gap-4"
                  onSubmit={buildPlanForm.handleSubmit((values) => {
                    if (!buildProtocol || !buildAssets) {
                      buildPlanForm.setError("protocol", { type: "validate", message: "请选择已有协议资产名" });
                      return;
                    }
                    const operationId = createOperationId("build-fuzz");
                    setOp("build-fuzz", operationId);
                    buildPlanMutation.mutate({
                      operationId,
                      payload: {
                        ...values,
                        protocol: buildProtocol,
                        source_ref: buildAssets.buildSourceRef,
                        input_ref: buildAssets.buildInputRef,
                        dict_ref: buildAssets.dictRef,
                      } as z.infer<typeof buildPlanSchema>,
                    });
                  })}
                >
                  <FormField label="协议名" description="匹配已有协议资产 | 引用按资产模型自动绑定">
                    <ProtocolComboInput
                      value={buildPlanForm.watch("protocol")}
                      options={protocolOptions}
                      onOpen={() => void protocolsQuery.refetch()}
                      onValueChange={(value) => {
                        buildPlanForm.clearErrors("protocol");
                        buildPlanForm.setValue("protocol", value, { shouldDirty: true, shouldValidate: true });
                      }}
                      onCommit={async (value) => {
                        buildPlanForm.clearErrors("protocol");
                        buildPlanForm.setValue("protocol", value, { shouldDirty: true, shouldValidate: true });
                        await Promise.all([
                          protocolsQuery.refetch(),
                          buildProbeQuery.refetch(),
                          buildPlansQuery.refetch(),
                          buildRunsQuery.refetch(),
                          buildTargetsQuery.refetch(),
                          launchProfilesQuery.refetch(),
                        ]);
                      }}
                    />
                  </FormField>
                  <FixedPathField label="source_ref" value={buildAssets?.buildSourceDisplay ?? "选择协议后自动生成"} description="固定引用协议源码目录 source/。" />
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField label="compiler">
                      <Input {...buildPlanForm.register("compiler")} placeholder="afl-clang-fast" />
                    </FormField>
                    <FormField label="instrumentation_mode">
                      <Input {...buildPlanForm.register("instrumentation_mode")} placeholder="llvm" />
                    </FormField>
                  </div>
                  <FixedPathField label="input_ref" description="固定引用种子目录 seeds/bin/" value={buildAssets?.buildInputDisplay ?? "选择协议后自动生成"} />
                  <FixedPathField label="dict_ref" description="固定引用协议字典 dicts/auto.dict" value={buildAssets?.dictDisplay ?? "选择协议后自动生成"} />
                  <div className="flex flex-wrap gap-3">
                    <Button type="submit" disabled={buildPlanMutation.isPending || !buildAssets}>
                      <Wand2 className="size-4" />
                      生成 BuildPlan
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={!buildPlansQuery.data?.[0]?.plan_id || buildRunMutation.isPending || !buildProtocol}
                      onClick={() => {
                        const latest = buildPlansQuery.data?.[0];
                        if (!latest || !buildProtocol) return;
                        const operationId = createOperationId("build-fuzz-run");
                        setOp("build-fuzz", operationId);
                        buildRunMutation.mutate({ protocol: buildProtocol, planId: latest.plan_id, operationId });
                      }}
                    >
                      <CheckCircle2 className="size-4" />
                      执行最新 BuildPlan
                    </Button>
                  </div>
                </form>

                <div className="h-[24vh] min-h-[18vh] max-h-[30vh] shrink-0">
                  <OperationLogPanel
                    operationId={operationIds["build-fuzz"]}
                    running={buildPlanMutation.isPending || buildRunMutation.isPending || launchProfileMutation.isPending}
                    title="当前动作"
                    maxLines={120}
                    pollIntervalMs={1000}
                    variant="compact"
                    eagerStart={false}
                    note="BuildPlan 生成、BuildRun 执行与 LaunchProfile 预测最近一次后端操作回显"
                    className="h-full min-h-0"
                    logClassName="bg-background/45"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <SummaryCard title="源码探测" value={buildProbeQuery.data ? "就绪" : "等待"} hint="构建前源码探测状态" statusColor="blue" />
                <SummaryCard title="构建计划" value={String(buildPlansQuery.data?.length ?? 0)} hint="后端已生成的构建计划数量" statusColor="emerald" />
                <SummaryCard title="目标产物" value={String(buildTargetsQuery.data?.length ?? 0)} hint="当前可用的构建目标数量" statusColor="amber" />
              </div>

              <Card className="overflow-hidden">
                <CardHeader>
                  <CardTitle>Probe / BuildPlan 预览</CardTitle>
                  <CardDescription>查看源目录探测结果、编译器选择和最新构建计划</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
                    <JsonViewer data={(buildProbeQuery.data as BuildProbe | undefined) ?? { status: "idle" }} compact />
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
                    <JsonViewer data={(buildPlansQuery.data?.[0] as BuildPlan | undefined) ?? { status: "idle" }} compact />
                  </div>
                </CardContent>
              </Card>

              <Card className="overflow-hidden">
                <CardHeader>
                  <CardTitle>BuildRun Targets / LaunchProfiles</CardTitle>
                  <CardDescription>从 BuildRun target 生成 LaunchProfile，并传递到任务创建页使用</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Target</TableHead>
                        <TableHead>Binary Ref</TableHead>
                        <TableHead className="w-[140px]">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(buildTargetsQuery.data ?? []).map((target: TargetCandidate) => (
                        <TableRow key={target.target_id}>
                          <TableCell>{target.name}</TableCell>
                          <TableCell className="max-w-[24rem] truncate">{target.binary_ref}</TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={!buildProtocol || !buildAssets}
                              onClick={() => {
                                const operationId = createOperationId("build-fuzz-profile");
                                setOp("build-fuzz", operationId);
                                launchProfileMutation.mutate({
                                  protocol: buildProtocol,
                                  target_id: target.target_id,
                                  build_id: buildRunsQuery.data?.[0]?.build_id,
                                  input_ref: buildAssets?.buildInputRef || undefined,
                                  dict_ref: buildAssets?.dictRef || undefined,
                                  operationId,
                                });
                              }}
                            >
                              预测 Profile
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
                    <JsonViewer
                      data={{
                        latestRun: buildRunsQuery.data?.[0] as BuildRun | undefined,
                        launchProfiles: launchProfilesQuery.data as LaunchProfile[] | undefined,
                      }}
                      compact
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

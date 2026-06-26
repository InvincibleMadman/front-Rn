import { useMemo, useState } from "react";
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
import { RiskAnalysisSummary } from "@/components/common/risk-analysis-summary";
import { InstrumentationReportView } from "@/components/common/instrumentation-report-view";
import { ApiErrorReporter } from "@/components/common/api-error-alert";
import { SummaryCard } from "@/components/common/summary-card";
import { DonutChart } from "@/components/charts/donut-chart";
import { BarChart } from "@/components/charts/bar-chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildAssistantApi } from "@/lib/api/services/build-assistant";
import { offlineApi } from "@/lib/api/services/offline";
import { apiClient } from "@/lib/api/client";
import { protocolsApi } from "@/lib/api/services/protocols";
import { vuldocsApi } from "@/lib/api/services/vuldocs";
import { kbApi } from "@/lib/api/services/kb";
import { createOperationId } from "@/lib/api/services/operations";
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

const FIXED_PROTOCOL_SPEC_NAME = "protocol_spec.json";
const FIXED_RISK_ANALYSIS_NAME = "final_analysis.json";
const FIXED_DICT_FILENAME = "auto.dict";

const protocolSchema = z.object({
  protocol: z.string().min(1, "必填"),
  content: z.string().optional(),
  use_llm: z.boolean().default(true),
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
  use_llm: z.boolean().default(true),
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
  use_llm: z.boolean().default(false),
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
  const [distillUseLlm, setDistillUseLlm] = useState(true);
  const [kbKeyword, setKbKeyword] = useState("");
  const [selectedKbEntryId, setSelectedKbEntryId] = useState("");
  const [riskUploadProtocol, setRiskUploadProtocol] = useState("");

  useOperationLogDockSync(
    [
      { operationId: operationIds.protocol, source: "offline", label: "Protocol analysis", enabled: Boolean(operationIds.protocol) },
      { operationId: operationIds.seeds, source: "offline", label: "Seed generation", enabled: Boolean(operationIds.seeds) },
      { operationId: operationIds["risk-analyze"], source: "offline", label: "Risk analysis", enabled: Boolean(operationIds["risk-analyze"]) },
      { operationId: operationIds["risk-preview"], source: "offline", label: "Risk preview", enabled: Boolean(operationIds["risk-preview"]) },
      { operationId: operationIds["risk-upload"], source: "offline", label: "Risk upload", enabled: Boolean(operationIds["risk-upload"]) },
      { operationId: operationIds.instrument, source: "offline", label: "Instrumentation", enabled: Boolean(operationIds.instrument) },
      { operationId: operationIds["vuldocs-kb"], source: "offline", label: "Knowledge base", enabled: Boolean(operationIds["vuldocs-kb"]) },
      { operationId: operationIds["build-fuzz"], source: "offline", label: "Build fuzz target", enabled: Boolean(operationIds["build-fuzz"]) },
    ],
    1200,
  );

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
      use_llm: true,
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
      use_llm: true,
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
      use_llm: false,
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

  const setOp = (tab: OfflineTab, id: string): void =>
    setOperationIds((state) => ({ ...state, [tab]: id }));

  const protocolMutation = useMutation({
    mutationFn: offlineApi.protocolAnalyze,
    onSuccess: async (data: ProtocolAnalyzeResponse) => {
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
    mutationFn: (payload: z.infer<typeof buildPlanSchema>) => buildAssistantApi.createPlan(payload.protocol, payload),
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
    mutationFn: ({ protocol, planId }: { protocol: string; planId: string }) => buildAssistantApi.runPlan(protocol, planId),
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
    mutationFn: (payload: { protocol: string; target_id: string; build_id?: string; input_ref?: string; dict_ref?: string }) =>
      buildAssistantApi.predictLaunchProfile(payload.protocol, payload),
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
      useLlm: boolean;
    }) =>
      vuldocsApi.distill(input.protocol, {
        operation_id: input.operationId,
        doc_ids: input.docIds,
        use_llm: input.useLlm,
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
                      use_llm: values.use_llm,
                    });
                  })}
                >
                  <FormField
                    label="协议名称 protocol"
                    description="仅允许选择已有协议资产，确定后自动绑定 source/ 与 specs/ 预设路径。"
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
                    description="固定引用协议资产模型中的 source/ 虚拟目录。"
                    value={protocolAssets?.sourceDisplay ?? "选择协议后自动生成"}
                  />
                  <FixedPathField
                    label="规范输出 output_ref"
                    description="固定保存到 specs/protocol_spec.json。"
                    value={protocolAssets?.specFileDisplay ?? "选择协议后自动生成"}
                  />
                  <FixedPathField
                    label="规范文件名 name"
                    description="协议规范提取固定使用预设文件名。"
                    value={FIXED_PROTOCOL_SPEC_NAME}
                  />
                  <div className="md:col-span-2">
                    <FormField label="手动提供规范内容 content" description="可选；填写后后端会直接保存到预设规范路径，留空时后端按 source/ 扫描源码生成规范。">
                      <Textarea {...protocolForm.register("content")} />
                    </FormField>
                  </div>
                  <div className="md:col-span-2 flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/50 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">use_llm</p>
                      <p className="text-xs text-muted-foreground">是否允许后端按 config.yaml 中的 LLM 配置进行协议分析；前端不传 base_url/api_key/model。</p>
                    </div>
                    <Switch
                      className="shrink-0"
                      checked={protocolForm.watch("use_llm")}
                      onCheckedChange={(checked) => protocolForm.setValue("use_llm", checked)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Button type="submit" disabled={protocolMutation.isPending || !protocolAssets}>
                      <ScanSearch className="size-4" />
                      {protocolMutation.isPending
                        ? "分析中..."
                        : "开始协议规范提取"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
            <div className="min-h-[400px] flex-1">
              <Card className="flex h-full min-h-0 flex-col overflow-hidden">
                <CardHeader className="shrink-0">
                  <CardTitle>协议提取结果</CardTitle>
                  <CardDescription>只保留结构化结果预览，过程输出与错误详情统一进入底部 GlobalLogDock。</CardDescription>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
                  {resultStatusCard({
                    title: "日志出口",
                    running: protocolMutation.isPending,
                    operationId: operationIds.protocol,
                    note: "协议提取过程输出已进入 GlobalLogDock。",
                  })}
                  <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border/60 bg-background/45 p-4">
                    <JsonViewer
                      data={
                        protocolMutation.data
                          ? {
                              ...protocolMutation.data,
                              frontend_reference: {
                                primaryPath: protocolPrimaryPathFromResponse(protocolMutation.data),
                                modelSpecRef: protocolAssets?.specFileRef ?? null,
                                relatedPaths: protocolRelatedPathsFromResponse(protocolMutation.data),
                              },
                            }
                          : { status: "idle" }
                      }
                      compact
                    />
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
                  规范输入与种子输出均固定绑定到协议资产模型预设路径。
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
                    description="必须完全匹配已有协议资产，规范与输出目录按协议资产模型自动绑定。"
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
                    description="固定读取 specs/protocol_spec.json。"
                    value={seedsAssets?.specFileDisplay ?? "选择协议后自动生成"}
                  />
                  <FixedPathField
                    label="规范目录 spec_dir"
                    description="协议规范目录固定为 specs/。"
                    value={seedsAssets?.specsDirDisplay ?? "选择协议后自动生成"}
                  />
                  <FixedPathField
                    label="输出目录 output_ref"
                    description="固定写入 seeds/bin/ 目录。"
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
                  <div className="md:col-span-2">
                    <Button type="submit" disabled={seedsMutation.isPending}>
                      <Wand2 className="size-4" />
                      {seedsMutation.isPending ? "生成中..." : "生成初始种子"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
            <div className="min-h-[400px] flex-1">
              <Card className="flex h-full min-h-0 flex-col overflow-hidden">
                <CardHeader className="shrink-0">
                  <CardTitle>种子生成结果</CardTitle>
                  <CardDescription>结构化结果保留在此，生成过程输出统一写入底部 GlobalLogDock。</CardDescription>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
                  {resultStatusCard({
                    title: "日志出口",
                    running: seedsMutation.isPending,
                    operationId: operationIds.seeds,
                    note: "种子生成过程输出与错误详情已进入 GlobalLogDock。",
                  })}
                  <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border/60 bg-background/45 p-4">
                    <JsonViewer data={seedsMutation.data ?? { status: "idle" }} compact />
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
                      use_llm: values.use_llm,
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
                      <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/60 px-4 py-3"><div className="min-w-0"><p className="text-sm font-medium">use_llm</p><p className="text-xs text-muted-foreground">是否启用 LLM 风险识别</p></div><Switch className="shrink-0" checked={riskAnalyzeForm.watch("use_llm")} onCheckedChange={(checked) => riskAnalyzeForm.setValue("use_llm", checked)} /></div>
                      <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/60 px-4 py-3"><div className="min-w-0"><p className="text-sm font-medium">use_static_prefilter</p><p className="text-xs text-muted-foreground">先用静态预筛降低 LLM 压力</p></div><Switch className="shrink-0" checked={riskAnalyzeForm.watch("use_static_prefilter")} onCheckedChange={(checked) => riskAnalyzeForm.setValue("use_static_prefilter", checked)} /></div>
                    </div>
                  </details>
                  <div className="md:col-span-2">
                    <Button
                      type="submit"
                      disabled={riskAnalyzeMutation.isPending || !riskAnalyzeAssets}
                    >
                      <ScanSearch className="size-4" />
                      {riskAnalyzeMutation.isPending
                        ? "分析中..."
                        : "运行风险路径分析"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
            <div className="grid min-h-[400px] min-w-0 grid-rows-[minmax(0,1fr)_200px] gap-4">

              <Card className="flex min-h-0 flex-col overflow-hidden">
                <CardHeader className="shrink-0">
                  <CardTitle>分析结果</CardTitle>
                  <CardDescription>结构化键值对渲染 pipeline 的 summary / findings / failed_chunks / warnings。</CardDescription>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col">
                  <div className="console-scrollbar min-h-0 flex-1 overflow-y-auto rounded-xl border border-border/60 bg-card/70 p-4">
                    <RiskAnalysisSummary data={riskAnalyzeMutation.data ?? null} />
                  </div>
                </CardContent>
              </Card>

              {riskAnalyzeMutation.isPending && (
                <div className="rounded-lg border border-[hsl(var(--accent-blue)/0.2)] bg-[hsl(var(--accent-blue)/0.05)] px-3 py-2 text-xs text-[hsl(var(--accent-blue))]">
                  分析执行中，请查看底部日志栏...
                </div>
              )}
            </div>
          </div>
        </TabsContent>


        <TabsContent value="risk-preview">
          <div className="grid gap-4 xl:grid-cols-[0.82fr_1.18fr_0.9fr]">
            <Card className="flex min-h-[30rem] flex-col overflow-hidden">
              <CardHeader className="border-b border-border/50">
                <CardTitle>风险结果预览</CardTitle>
                <CardDescription>读取风险分析输出，不再在页面内展示增量执行输出。</CardDescription>
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
                    description="必须完全匹配已有协议资产，分析结果固定读取 risk/analyses/final_analysis.json。"
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
                    description="固定读取 risk/analyses/final_analysis.json。"
                    value={riskPreviewAssets?.riskAnalysisDisplay ?? "选择协议后自动生成"}
                  />
                  <Button type="submit" className="w-full" disabled={riskPreviewMutation.isPending || !riskPreviewAssets}>
                    <CheckCircle2 className="size-4" />
                    {riskPreviewMutation.isPending ? "读取中..." : "查看预览"}
                  </Button>
                </form>

                {resultStatusCard({
                  title: "日志出口",
                  running: riskPreviewMutation.isPending,
                  operationId: operationIds["risk-preview"],
                  note: "预览只显示结构化结果，过程输出已进入 GlobalLogDock。",
                })}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard title="Status" value={String(previewSummary.status ?? "idle")} hint="preview status" statusColor="violet" />
                <SummaryCard title="Findings" value={String(previewSummary.findings ?? 0)} hint="risk items" statusColor="orange" />
                <SummaryCard title="Bytes" value={String(previewSummary.size ?? 0)} hint="preview size" statusColor="blue" />
                <SummaryCard title="Path" value={previewSummary.analysis_path ? "ready" : "missing"} hint={String(previewSummary.analysis_path || "-")} statusColor="teal" />
              </div>

              <Card className="overflow-hidden">
                <CardHeader className="border-b border-border/50">
                  <CardTitle className="flex items-center gap-2">
                    <FileJson className="size-4 text-primary" />
                    预览主体
                  </CardTitle>
                  <CardDescription>主结果优先展示 preview 文本与路径信息。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 p-5">
                  <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">analysis_path</p>
                    <p className="mt-2 break-all text-sm text-foreground">{typeof previewSummary.analysis_path === "string" && previewSummary.analysis_path.trim() ? previewSummary.analysis_path : typeof riskPreviewAssets?.riskAnalysisDisplay === "string" && riskPreviewAssets.riskAnalysisDisplay.trim() ? riskPreviewAssets.riskAnalysisDisplay : "-"}</p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">preview</p>
                    <pre className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                      {previewData?.preview?.trim() || "暂无预览文本。"}
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
                  <CardDescription>详情折到右侧，保持中间主结果突出。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 p-5">
                  {previewFindings.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-background/35 px-4 py-6 text-sm text-muted-foreground">
                      当前预览没有 findings。
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
                <CardTitle>风险JSON上传</CardTitle>
                <CardDescription>
                  单一风险路径文件上传，利用已有结果
                </CardDescription>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-y-auto">
                <div className="space-y-4">
                  <FormField
                    label="协议名 protocol"
                    description="必须完全匹配已有协议资产；上传结果将写入该协议预设风险分析位置。"
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
                    description="上传结果将镜像到风险分析预设文件。"
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

                        if (!protocol) {
                          setUploadError(new Error("请选择已有协议资产名后再上传风险结果。"));
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
                        }
                      }}
                    />
                  </FormField>
                  <div className="rounded-xl border border-border/60 bg-background/50 p-4 text-sm text-muted-foreground">
                    上传后的风险结果会被保存到兼容目录，并镜像为默认风险结果文件名。
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>最近结果</CardTitle>
                <CardDescription>
                  适合接收外部生成的 final_analysis.json。
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
                <CardDescription>参数在左，主插桩报告在中间，详情折叠到右侧。</CardDescription>
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
                    description="必须完全匹配已有协议资产，插桩输入输出路径按协议资产模型自动绑定。"
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
                    description="固定引用协议资产模型中的 source/ 目录。"
                    value={instrumentAssets?.sourceDisplay ?? "选择协议后自动生成"}
                  />
                  <FixedPathField
                    label="analysis_ref"
                    description="固定读取 risk/analyses/final_analysis.json。"
                    value={instrumentAssets?.riskAnalysisDisplay ?? "选择协议后自动生成"}
                  />
                  <FixedPathField
                    label="output_ref"
                    description="固定输出到 risk/instrumented/。"
                    value={instrumentAssets?.instrumentedOutputDisplay ?? "选择协议后自动生成"}
                  />

                  <div className="grid gap-3">
                    <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/45 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">原地写回</p>
                        <p className="text-xs text-muted-foreground">直接覆盖原源码，通常不建议。</p>
                      </div>
                      <Switch
                        checked={instrumentForm.watch("in_place")}
                        onCheckedChange={(checked) => instrumentForm.setValue("in_place", checked)}
                      />
                    </div>
                    <div className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/45 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">compile_check</p>
                        <p className="text-xs text-muted-foreground">要求后端执行编译校验并返回 compile_check 结果。</p>
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
                        <p className="text-xs text-muted-foreground">拒绝全局区、宏区、函数边界等不安全插桩点。</p>
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

                {resultStatusCard({
                  title: "日志出口",
                  running: instrumentMutation.isPending,
                  operationId: operationIds.instrument,
                  note: "插桩过程输出与失败详情已统一进入 GlobalLogDock。",
                })}
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="border-b border-border/50">
                <CardTitle>插桩主结果</CardTitle>
                <CardDescription>中间主栏显示结构化结果和 compile_check 摘要。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-5">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <SummaryCard title="Markers" value={String(instrumentSummary.inserted)} hint="inserted_markers" statusColor="violet" />
                  <SummaryCard title="Rejected" value={String(instrumentSummary.rejected)} hint="rejected_insertions" statusColor="orange" />
                  <SummaryCard title="Warnings" value={String(instrumentSummary.warnings)} hint="validation_warnings" statusColor="gold" />
                  <SummaryCard
                    title="Compile"
                    value={instrumentData?.compile_check?.enabled ? (instrumentData?.compile_check?.passed ? "passed" : "failed") : "n/a"}
                    hint="compile_check"
                    statusColor={instrumentData?.compile_check?.passed ? "teal" : "coral"}
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
                  <CardDescription>将大体量详情折叠到右侧，不影响主结果阅读。</CardDescription>
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
              <SummaryCard title="原始文档" value={String(vuldocsQuery.data?.length ?? 0)} hint="vuldocs" statusColor="teal" />
              <SummaryCard title="图谱节点" value={String(graphNodeCount)} hint={`${graphEdgeCount} edges`} statusColor="gold" />
              <SummaryCard title="时间线事件" value={String(timelineEventCount)} hint="kb/timeline" statusColor="coral" />
            </div>

            <div className="grid gap-4 xl:grid-cols-[0.78fr_1.22fr_0.92fr]">
              <Card className="flex min-h-[34rem] flex-col overflow-hidden">
                <CardHeader className="border-b border-border/50">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <UploadCloud className="size-4 text-primary" />
                    漏洞文档源
                  </CardTitle>
                  <CardDescription>左侧保持上传、蒸馏和搜索参数，执行输出统一进入底部 GlobalLogDock。</CardDescription>
                </CardHeader>
                <CardContent className="console-scrollbar flex-1 space-y-4 overflow-y-auto p-5">
                  <FormField
                    label="协议名"
                    description="仅允许选择已有协议资产，VulDoc / KB 将写入对应协议预设目录。"
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
                    description="支持多文件批量上传，按协议 workspace 归档。"
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
                    description="逗号或换行分隔；留空表示蒸馏该协议下全部文档。"
                  >
                    <Textarea
                      className="min-h-[7.5rem] resize-y"
                      value={selectedDocIds}
                      onChange={(event) => setSelectedDocIds(event.target.value)}
                    />
                  </FormField>

                  <div className="rounded-2xl border border-border/60 bg-background/45 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">启用 LLM 蒸馏</p>
                        <p className="mt-1 text-xs text-muted-foreground">是否使用后端配置中的 LLM 流程增强漏洞文档蒸馏。</p>
                      </div>
                      <Switch className="shrink-0" checked={distillUseLlm} onCheckedChange={setDistillUseLlm} />
                    </div>
                  </div>

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
                        useLlm: distillUseLlm,
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

                  {resultStatusCard({
                    title: "日志出口",
                    running: vuldocUploadMutation.isPending || vuldocDistillMutation.isPending,
                    operationId: operationIds["vuldocs-kb"],
                    note: "上传、蒸馏和检索输出都进入 GlobalLogDock。",
                  })}

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
                    <CardDescription>中列突出可操作结果：热门条目、搜索命中和结构化字段，不再使用拉长整页的展开块。</CardDescription>
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
                                      ? "border-[hsl(var(--accent-blue)/0.34)] bg-[hsl(var(--accent-blue-light)/0.72)] dark:border-[hsl(var(--accent-pink)/0.28)] dark:bg-[hsl(var(--accent-pink-soft)/0.22)]"
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
                                      ? "border-[hsl(var(--accent-orange)/0.34)] bg-[hsl(var(--accent-orange-light)/0.66)] dark:border-[hsl(var(--accent-pink)/0.28)] dark:bg-[hsl(var(--accent-pink-soft)/0.24)]"
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
                    <CardDescription>右列负责统计、引用和已选条目证据，不再把原始 JSON 大面积铺在页面里。</CardDescription>
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
                    <CardDescription>主结果之外的详情集中到右侧卡片，并限制为卡片内滚动。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 p-5">
                    {!selectedKbEntry ? (
                      <p className="text-sm text-muted-foreground">请选择一条知识条目查看详细证据。</p>
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
                    <CardDescription>保留调试入口，但限制在独立小卡片中内联滚动。</CardDescription>
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
                <CardDescription>BuildPlan 由后端生成并保存，BuildRun 只能执行已保存的计划。</CardDescription>
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
                      ...values,
                      protocol: buildProtocol,
                      source_ref: buildAssets.buildSourceRef,
                      input_ref: buildAssets.buildInputRef,
                      dict_ref: buildAssets.dictRef,
                    } as z.infer<typeof buildPlanSchema> & { source_ref: string; input_ref: string; dict_ref: string });
                  })}
                >
                  <FormField label="协议名" description="必须完全匹配已有协议资产，构建输入引用按资产模型自动绑定。">
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
                  <FixedPathField label="input_ref" description="固定引用种子目录 seeds/bin/。" value={buildAssets?.buildInputDisplay ?? "选择协议后自动生成"} />
                  <FixedPathField label="dict_ref" description="固定引用协议字典 dicts/auto.dict。" value={buildAssets?.dictDisplay ?? "选择协议后自动生成"} />
                  <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/45 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">LLM 辅助</p>
                      <p className="text-xs text-muted-foreground">仅生成建议候选，最终 BuildPlan 仍由后端本地规则主导。</p>
                    </div>
                    <Switch checked={buildPlanForm.watch("use_llm")} onCheckedChange={(checked) => buildPlanForm.setValue("use_llm", checked)} />
                  </div>
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
                        buildRunMutation.mutate({ protocol: buildProtocol, planId: latest.plan_id });
                      }}
                    >
                      <CheckCircle2 className="size-4" />
                      执行最新 BuildPlan
                    </Button>
                  </div>
                </form>

                {resultStatusCard({
                  title: "日志出口",
                  running: buildPlanMutation.isPending || buildRunMutation.isPending || launchProfileMutation.isPending,
                  operationId: operationIds["build-fuzz"],
                  note: "构建规划与启动参数预测过程统一进入 GlobalLogDock。",
                })}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <SummaryCard title="Probe" value={buildProbeQuery.data ? "ready" : "idle"} hint={buildProbeQuery.data?.source_ref ?? "等待协议"} statusColor="teal" />
                <SummaryCard title="Plans" value={String(buildPlansQuery.data?.length ?? 0)} hint="server generated" statusColor="violet" />
                <SummaryCard title="Targets" value={String(buildTargetsQuery.data?.length ?? 0)} hint="build outputs" statusColor="gold" />
              </div>

              <Card className="overflow-hidden">
                <CardHeader>
                  <CardTitle>Probe / BuildPlan 预览</CardTitle>
                  <CardDescription>查看源目录探测结果、编译器选择和最新构建计划。</CardDescription>
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
                  <CardDescription>从 BuildRun target 生成 LaunchProfile，并传递到任务创建页使用。</CardDescription>
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
                              onClick={() =>
                                launchProfileMutation.mutate({
                                  protocol: buildProtocol,
                                  target_id: target.target_id,
                                  build_id: buildRunsQuery.data?.[0]?.build_id,
                                  input_ref: buildAssets?.buildInputRef || undefined,
                                  dict_ref: buildAssets?.dictRef || undefined,
                                })
                              }
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

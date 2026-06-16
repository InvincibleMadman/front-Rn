import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  BrainCircuit,
  ChevronRight,
  Hammer,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Network,
  Save,
  Server,
  Settings2,
  ShieldEllipsis,
  UserCircle2,
  Users,
  Wrench,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { FormField } from "@/components/common/form-field";
import { JsonViewer } from "@/components/common/json-viewer";
import { SummaryCard } from "@/components/common/summary-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { authApi } from "@/lib/api/services/auth";
import { nodesApi } from "@/lib/api/services/nodes";
import { systemApi } from "@/lib/api/services/system";
import { usersApi } from "@/lib/api/services/users";
import { cn } from "@/lib/utils/cn";
import { useAuthStore } from "@/stores/auth-store";
import { useUiStore } from "@/stores/ui-store";
import type { AppConfigResponse, ConfigPatchRequest, SystemCapabilitiesResponse, SystemInfoResponse } from "@/types/api/config";
import type { ManagedUser } from "@/types/api/users";

const settingsSchema = z.object({
  workspace_root: z.string().optional(),
  workspace_default_protocol: z.string().optional(),
  server_host: z.string().optional(),
  server_port: z.coerce.number().int().positive().default(18000),
  cors_enabled: z.boolean().default(true),
  cors_allow_origins_text: z.string().optional(),
  cors_allow_origin_regex: z.string().optional(),
  cors_allow_credentials: z.boolean().default(true),
  llm_provider: z.string().optional(),
  llm_model: z.string().optional(),
  llm_base_url: z.string().optional(),
  llm_api_key: z.string().optional(),
  llm_api_key_env: z.string().optional(),
  llm_timeout_sec: z.coerce.number().int().positive().default(120),
  paths_afl_fuzz: z.string().optional(),
  paths_afl_showmap: z.string().optional(),
  paths_afl_cc: z.string().optional(),
  paths_afl_clang_fast: z.string().optional(),
  paths_cmake: z.string().optional(),
  paths_make: z.string().optional(),
  paths_ninja: z.string().optional(),
  paths_git: z.string().optional(),
  debugger_gdb_path: z.string().optional(),
  debugger_timeout_sec: z.coerce.number().int().positive().default(20),
  debugger_allow_network_replay: z.boolean().default(false),
  build_enabled: z.boolean().default(true),
  build_allow_llm_assist: z.boolean().default(true),
  build_default_compiler: z.string().optional(),
  build_allowed_compilers_text: z.string().optional(),
  build_allowed_tools_text: z.string().optional(),
  build_allow_shell_scripts: z.boolean().default(false),
});

const accountSchema = z.object({
  current_password: z.string().min(1, "请输入当前密码"),
  new_password: z.string().min(8, "新密码至少 8 位").max(128, "新密码最多 128 位"),
});

const createUserSchema = z.object({
  username: z.string().trim().min(1, "请输入用户名"),
  password: z.string().min(8, "密码至少 8 位").max(128, "密码最多 128 位"),
  role: z.enum(["admin", "user"]),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;
type AccountFormValues = z.infer<typeof accountSchema>;
type CreateUserFormValues = z.infer<typeof createUserSchema>;

type SettingsTab =
  | "overview"
  | "backend"
  | "security"
  | "llm"
  | "toolchain"
  | "build"
  | "account"
  | "users";

type Tone = "default" | "success" | "warning" | "danger" | "info";

interface SettingsTabMeta {
  id: SettingsTab;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const SETTINGS_TABS: SettingsTabMeta[] = [
  { id: "overview", label: "总览", description: "BFF 认证、控制面与结构边界", icon: LayoutDashboard },
  { id: "backend", label: "后端", description: "workspace、host/port、CORS", icon: Server },
  { id: "security", label: "安全", description: "session、CSRF、节流与 control plane", icon: ShieldEllipsis },
  { id: "llm", label: "LLM", description: "provider、model、base_url、key", icon: BrainCircuit },
  { id: "toolchain", label: "工具链", description: "AFL 与构建工具路径", icon: Wrench },
  { id: "build", label: "构建", description: "构建助手与调试配置", icon: Hammer },
  { id: "account", label: "用户中心", description: "账号信息、改密、退出登录", icon: UserCircle2 },
  { id: "users", label: "用户管理", description: "仅管理员可见", icon: Users, adminOnly: true },
];

const CONFIG_TABS = new Set<SettingsTab>(["backend", "llm", "toolchain", "build"]);
const COMPAT_REMOVED_TEXT = "系统仅保留 /api/v1/*；legacy compat routes: removed";

function splitLines(value?: string): string[] {
  return (value ?? "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function text(value?: string): string {
  return value?.trim() ?? "";
}

function isSettingsTab(value: string | null): value is SettingsTab {
  return SETTINGS_TABS.some((item) => item.id === value);
}

function roleLabel(role?: "admin" | "user"): string {
  return role === "admin" ? "管理员" : "普通用户";
}

function yesNo(value?: boolean, unknown = "未确认"): string {
  if (value === true) return "是";
  if (value === false) return "否";
  return unknown;
}

function enabledDisabled(value?: boolean, unknown = "未确认"): string {
  if (value === true) return "已启用";
  if (value === false) return "已关闭";
  return unknown;
}

function passwordSourceLabel(value?: "env" | "default"): string {
  if (value === "env") return "环境变量";
  if (value === "default") return "默认密码";
  return "未确认";
}

function safeText(value: unknown, fallback = "未设置"): string {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return fallback;
}

function formatSeconds(value?: number): string {
  return typeof value === "number" ? `${value}s` : "未设置";
}

function formatDateTime(value?: string): string {
  if (!value) return "未记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function configToForm(config?: AppConfigResponse): SettingsFormValues {
  const build = (config?.build ?? {}) as Record<string, unknown>;

  return {
    workspace_root: config?.workspace?.root ?? "./workspace",
    workspace_default_protocol: config?.workspace?.default_protocol ?? "",
    server_host: config?.server?.host ?? config?.server?.http?.host ?? "0.0.0.0",
    server_port: config?.server?.port ?? config?.server?.http?.port ?? 18000,
    cors_enabled: config?.server?.cors?.enabled ?? true,
    cors_allow_origins_text: (config?.server?.cors?.allow_origins ?? []).join("\n"),
    cors_allow_origin_regex: config?.server?.cors?.allow_origin_regex ?? "",
    cors_allow_credentials: config?.server?.cors?.allow_credentials ?? true,
    llm_provider: config?.llm?.provider ?? "",
    llm_model: config?.llm?.model ?? "",
    llm_base_url: config?.llm?.base_url ?? "",
    llm_api_key: config?.llm?.api_key ?? "",
    llm_api_key_env: config?.llm?.api_key_env ?? "FUZZ_CORE_LLM_API_KEY",
    llm_timeout_sec: config?.llm?.timeout_sec ?? 120,
    paths_afl_fuzz: config?.paths?.afl_fuzz ?? "afl-fuzz",
    paths_afl_showmap: config?.paths?.afl_showmap ?? "afl-showmap",
    paths_afl_cc: config?.paths?.afl_cc ?? "afl-cc",
    paths_afl_clang_fast: config?.paths?.afl_clang_fast ?? "afl-clang-fast",
    paths_cmake: config?.paths?.cmake ?? "cmake",
    paths_make: config?.paths?.make ?? "make",
    paths_ninja: config?.paths?.ninja ?? "ninja",
    paths_git: config?.paths?.git ?? "git",
    debugger_gdb_path: config?.debugger?.gdb_path ?? "gdb",
    debugger_timeout_sec: config?.debugger?.timeout_sec ?? 20,
    debugger_allow_network_replay: config?.debugger?.allow_network_replay ?? false,
    build_enabled: Boolean(build.enabled ?? true),
    build_allow_llm_assist: Boolean(build.allow_llm_assist ?? true),
    build_default_compiler: String(build.default_compiler ?? "afl-clang-fast"),
    build_allowed_compilers_text: ((build.allowed_compilers as string[] | undefined) ?? []).join("\n"),
    build_allowed_tools_text: ((build.allowed_tools as string[] | undefined) ?? []).join("\n"),
    build_allow_shell_scripts: Boolean(build.allow_shell_scripts ?? false),
  };
}

function buildPatch(values: SettingsFormValues): ConfigPatchRequest {
  return {
    workspace: {
      root: text(values.workspace_root),
      default_protocol: text(values.workspace_default_protocol),
    },
    server: {
      host: text(values.server_host),
      port: values.server_port,
      cors: {
        enabled: values.cors_enabled,
        allow_origins: splitLines(values.cors_allow_origins_text),
        allow_origin_regex: text(values.cors_allow_origin_regex) || null,
        allow_credentials: values.cors_allow_credentials,
      },
    },
    llm: {
      provider: text(values.llm_provider),
      model: text(values.llm_model),
      base_url: text(values.llm_base_url),
      api_key: text(values.llm_api_key),
      api_key_env: text(values.llm_api_key_env),
      timeout_sec: values.llm_timeout_sec,
    },
    paths: {
      afl_fuzz: text(values.paths_afl_fuzz),
      afl_showmap: text(values.paths_afl_showmap),
      afl_cc: text(values.paths_afl_cc),
      afl_clang_fast: text(values.paths_afl_clang_fast),
      cmake: text(values.paths_cmake),
      make: text(values.paths_make),
      ninja: text(values.paths_ninja),
      git: text(values.paths_git),
    },
    debugger: {
      gdb_path: text(values.debugger_gdb_path),
      timeout_sec: values.debugger_timeout_sec,
      allow_network_replay: values.debugger_allow_network_replay,
    },
    build: {
      enabled: values.build_enabled,
      allow_llm_assist: values.build_allow_llm_assist,
      default_compiler: text(values.build_default_compiler),
      allowed_compilers: splitLines(values.build_allowed_compilers_text),
      allowed_tools: splitLines(values.build_allowed_tools_text),
      allow_shell_scripts: values.build_allow_shell_scripts,
    },
  };
}

function SwitchRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}): JSX.Element {
  return (
    <div className="flex min-w-0 items-center justify-between gap-4 rounded-xl border border-border/60 bg-background/50 px-4 py-3">
      <div className="min-w-0">
        <p className="break-words text-sm font-medium">{title}</p>
        {description ? <p className="break-words text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <Switch className="shrink-0" checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function DetailGrid({
  items,
}: {
  items: Array<{ label: string; value: string; tone?: Tone; mono?: boolean }>;
}): JSX.Element {
  const toneClassMap: Record<Tone, string> = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
    info: "text-primary",
  };

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-border/60 bg-background/50 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{item.label}</p>
          <p
            className={cn(
              "mt-2 text-sm font-medium",
              toneClassMap[item.tone ?? "default"],
              item.mono && "break-all font-mono text-[12px]",
            )}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function HighlightPanel({
  title,
  description,
  tone = "info",
}: {
  title: string;
  description: string;
  tone?: Tone;
}): JSX.Element {
  const toneClassMap: Record<Tone, string> = {
    default: "border-border/70 bg-background/60 text-foreground",
    success: "border-success/30 bg-success/10 text-foreground",
    warning: "border-warning/30 bg-warning/10 text-foreground",
    danger: "border-danger/30 bg-danger/10 text-foreground",
    info: "border-primary/25 bg-primary/10 text-foreground",
  };

  return (
    <div className={cn("rounded-[var(--radius-xl)] border px-4 py-4", toneClassMap[tone])}>
      <div className="flex items-start gap-3">
        <AlertTriangle className={cn("mt-0.5 size-4 shrink-0", tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-primary")} />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}

function NavCard({
  activeTab,
  onChange,
  isAdmin,
}: {
  activeTab: SettingsTab;
  onChange: (tab: SettingsTab) => void;
  isAdmin: boolean;
}): JSX.Element {
  const items = SETTINGS_TABS.filter((item) => (item.adminOnly ? isAdmin : true));

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle>设置分区</CardTitle>
        <CardDescription>仍使用 `/settings?tab=...` 切换子页，不新增顶级路由。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => {
          const active = item.id === activeTab;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={cn(
                "flex w-full items-start gap-3 rounded-[var(--radius-lg)] border px-3 py-3 text-left transition-colors",
                active
                  ? "border-primary/35 bg-primary/10 shadow-console"
                  : "border-border/60 bg-background/50 hover:bg-secondary/70",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border",
                  active
                    ? "border-primary/25 bg-primary/10 text-primary"
                    : "border-border/70 bg-background text-muted-foreground",
                )}
              >
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{item.label}</span>
                  <ChevronRight className={cn("size-4 shrink-0 transition-transform", active && "translate-x-0.5 text-primary")} />
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">{item.description}</span>
              </span>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

function MissingNodeNotice(): JSX.Element {
  return (
    <HighlightPanel
      title="尚未选择后端节点"
      description="顶栏节点选择器尚未绑定目标节点。BFF 认证摘要仍可查看，但 /api/v1/config、/api/v1/system/info 等节点配置页需要先选择节点。"
      tone="warning"
    />
  );
}

function ConfigSubmitBar({
  disabled,
  pending,
  selectedNodeName,
  submitMessage,
}: {
  disabled: boolean;
  pending: boolean;
  selectedNodeName: string;
  submitMessage: string | null;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-xl)] border border-border/70 bg-background/60 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-semibold">保存当前节点配置</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {disabled
            ? "请先在顶栏选择后端节点，然后再将表单提交到所选节点的 /api/v1/config。"
            : `当前目标节点：${selectedNodeName}。提交路径与 envelope 风格保持不变。`}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {submitMessage ? <span className="text-sm text-muted-foreground">{submitMessage}</span> : null}
        <Button type="submit" disabled={disabled || pending}>
          <Save className="size-4" />
          {pending ? "保存中..." : "保存配置"}
        </Button>
      </div>
    </div>
  );
}

export function SettingsView(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const selectedNodeId = useUiStore((state) => state.selectedApiNodeId);
  const currentUser = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);
  const isAdmin = currentUser?.role === "admin";
  const hasSelectedNode = Boolean(selectedNodeId);

  const configQuery = useQuery({
    queryKey: ["config", selectedNodeId || "none"],
    queryFn: systemApi.getConfig,
    enabled: hasSelectedNode,
  });
  const systemInfoQuery = useQuery({
    queryKey: ["system-info", selectedNodeId || "none"],
    queryFn: systemApi.getSystemInfo,
    enabled: hasSelectedNode,
    refetchInterval: 15_000,
  });
  const capabilitiesQuery = useQuery({
    queryKey: ["capabilities", selectedNodeId || "none"],
    queryFn: systemApi.getSystemCapabilities,
    enabled: hasSelectedNode,
  });
  const securitySummaryQuery = useQuery({
    queryKey: ["auth-security-summary"],
    queryFn: authApi.getSecuritySummary,
  });
  const nodesQuery = useQuery({
    queryKey: ["api-nodes", "settings"],
    queryFn: nodesApi.loadAllNodes,
  });
  const usersQuery = useQuery({
    queryKey: ["managed-users"],
    queryFn: usersApi.list,
    enabled: isAdmin,
  });

  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [usersMessage, setUsersMessage] = useState<string | null>(null);

  const requestedTab = searchParams.get("tab");
  const activeTab = useMemo<SettingsTab>(() => {
    if (!isSettingsTab(requestedTab)) return "overview";
    if (requestedTab === "users" && hydrated && !isAdmin) {
      return currentUser ? "account" : "overview";
    }
    return requestedTab;
  }, [currentUser, hydrated, isAdmin, requestedTab]);

  useEffect(() => {
    if (!hydrated) return;

    let nextTab: SettingsTab | null = null;

    if (!isSettingsTab(requestedTab)) {
      nextTab = "overview";
    } else if (requestedTab === "users" && !isAdmin) {
      nextTab = currentUser ? "account" : "overview";
    }

    if (!nextTab) return;

    const next = new URLSearchParams(searchParams);
    next.set("tab", nextTab);
    setSearchParams(next, { replace: true });
  }, [currentUser, hydrated, isAdmin, requestedTab, searchParams, setSearchParams]);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: configToForm(),
  });
  const accountForm = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: { current_password: "", new_password: "" },
  });
  const createUserForm = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { username: "", password: "", role: "user" },
  });

  useEffect(() => {
    if (configQuery.data) form.reset(configToForm(configQuery.data));
  }, [configQuery.data, form]);

  const patchMutation = useMutation({
    mutationFn: systemApi.patchConfig,
    onSuccess: async (saved) => {
      form.reset(configToForm(saved));
      setSubmitMessage("配置已更新到当前节点。");
      await Promise.all([configQuery.refetch(), systemInfoQuery.refetch(), capabilitiesQuery.refetch()]);
    },
    onError: () => setSubmitMessage(null),
  });

  const changePasswordMutation = useMutation({
    mutationFn: (values: AccountFormValues) => authApi.changePassword(values.current_password, values.new_password),
    onSuccess: () => {
      accountForm.reset();
      setAccountMessage("密码已更新，当前会话已重新签发。");
    },
    onError: () => setAccountMessage(null),
  });

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      navigate("/login", { replace: true });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: (values: CreateUserFormValues) => usersApi.create(values),
    onSuccess: async () => {
      createUserForm.reset({ username: "", password: "", role: "user" });
      setUsersMessage("用户已创建。");
      await usersQuery.refetch();
    },
    onError: () => setUsersMessage(null),
  });

  const deleteUserMutation = useMutation({
    mutationFn: (username: string) => usersApi.remove(username),
    onSuccess: async (_data, username) => {
      setUsersMessage(`已删除用户 ${username}。`);
      await usersQuery.refetch();
    },
    onError: () => setUsersMessage(null),
  });

  const handleTabChange = (tab: SettingsTab): void => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next);
  };

  const submitConfig = form.handleSubmit((values) => {
    setSubmitMessage(null);
    patchMutation.mutate(buildPatch(values));
  });
  const submitPassword = accountForm.handleSubmit((values) => {
    setAccountMessage(null);
    changePasswordMutation.mutate(values);
  });
  const submitCreateUser = createUserForm.handleSubmit((values) => {
    setUsersMessage(null);
    createUserMutation.mutate(values);
  });

  const selectedNode = useMemo(
    () => nodesQuery.data?.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodesQuery.data?.nodes, selectedNodeId],
  );

  const securitySummary = securitySummaryQuery.data;
  const systemInfo = systemInfoQuery.data;
  const capabilities = capabilitiesQuery.data;
  const controlPlane = systemInfo?.control_plane ?? configQuery.data?.control_plane;
  const runtimeSecurity = configQuery.data?.runtime_info?.security ?? systemInfo?.runtime_info?.security;
  const resolvedTools = useMemo(
    () => configQuery.data?.runtime_info?.resolved_afl_tools ?? systemInfo?.afl?.resolved_tools ?? {},
    [configQuery.data?.runtime_info?.resolved_afl_tools, systemInfo?.afl?.resolved_tools],
  );
  const resolvedToolEntries = useMemo(
    () => Object.entries(resolvedTools).sort(([left], [right]) => left.localeCompare(right)),
    [resolvedTools],
  );
  const managedUsers = usersQuery.data ?? [];
  const adminCount = managedUsers.filter((item) => item.role === "admin").length;
  const regularUserCount = managedUsers.filter((item) => item.role === "user").length;

  const buildEnabled = form.watch("build_enabled");
  const buildAllowLlmAssist = form.watch("build_allow_llm_assist");
  const buildDefaultCompiler = form.watch("build_default_compiler");
  const llmProvider = form.watch("llm_provider");
  const llmModel = form.watch("llm_model");
  const llmBaseUrl = form.watch("llm_base_url");
  const serverHost = form.watch("server_host");
  const serverPort = form.watch("server_port");

  const currentNodeStatus = !hasSelectedNode
    ? "未选择"
    : systemInfoQuery.data
      ? "在线"
      : systemInfoQuery.isError
        ? "离线"
        : "检测中";

  const currentNodeStatusColor =
    !hasSelectedNode
      ? "secondary"
      : systemInfoQuery.data
        ? "success"
        : systemInfoQuery.isError
          ? "danger"
          : "warning";

  const hasDefaultSecretRisk =
    securitySummary?.default_node?.using_default_secret === true || runtimeSecurity?.using_default_secret === true;
  const hasDefaultBootstrapPassword = securitySummary?.bootstrap_admin?.password_source === "default";
  const securityStatusValue = hasDefaultSecretRisk
    ? "高风险"
    : hasDefaultBootstrapPassword
      ? "需处理"
      : securitySummary?.session?.http_only
        ? "正常"
        : "待确认";
  const securityStatusColor = hasDefaultSecretRisk
    ? "danger"
    : hasDefaultBootstrapPassword
      ? "warning"
      : securitySummary?.session?.http_only
        ? "success"
        : "secondary";

  const configuredToolCount = resolvedToolEntries.filter(([, value]) => Boolean(value)).length;
  const offlineCapabilityCount = capabilities?.offline?.length ?? 0;
  const debugCapabilityCount = capabilities?.debug?.length ?? 0;
  const jobsCapabilityCount = capabilities?.jobs?.length ?? 0;

  const renderOverviewTab = (): JSX.Element => (
    <div className="space-y-5">
      {securitySummaryQuery.error ? <ApiErrorAlert error={securitySummaryQuery.error} title="加载 BFF 安全摘要失败" /> : null}
      {nodesQuery.error ? <ApiErrorAlert error={nodesQuery.error} title="加载节点列表失败" /> : null}
      {systemInfoQuery.error && hasSelectedNode ? <ApiErrorAlert error={systemInfoQuery.error} title="读取当前节点控制面摘要失败" /> : null}
      {!hasSelectedNode ? <MissingNodeNotice /> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>BFF 认证摘要</CardTitle>
            <CardDescription>保持 scrypt + HttpOnly session + CSRF，不引入额外认证系统。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <DetailGrid
              items={[
                { label: "session cookie", value: safeText(securitySummary?.session?.cookie_name), mono: true },
                { label: "http_only", value: yesNo(securitySummary?.session?.http_only) },
                { label: "same_site", value: safeText(securitySummary?.session?.same_site) },
                { label: "csrf header", value: safeText(securitySummary?.csrf?.header_name), mono: true },
                { label: "csrf cookie", value: safeText(securitySummary?.csrf?.cookie_name), mono: true },
                {
                  label: "登录失败节流",
                  value: securitySummary?.login_protection
                    ? `${securitySummary.login_protection.max_failures ?? 5} 次 / ${securitySummary.login_protection.window_seconds ?? 600}s，封禁 ${securitySummary.login_protection.block_seconds ?? 600}s`
                    : "未确认",
                },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>当前节点控制面摘要</CardTitle>
            <CardDescription>展示所选节点的 control plane 只读安全状态，不暴露真实 secret。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <DetailGrid
              items={[
                { label: "节点", value: selectedNode?.name ?? "未选择节点" },
                { label: "control_plane.enabled", value: enabledDisabled(controlPlane?.enabled) },
                { label: "node_id", value: safeText(controlPlane?.node_id), mono: true },
                { label: "issuer", value: safeText(controlPlane?.issuer), mono: true },
                { label: "token_expire_seconds", value: formatSeconds(controlPlane?.token_expire_seconds) },
                { label: "secret_configured", value: yesNo(controlPlane?.secret_configured) },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>结构边界说明</CardTitle>
            <CardDescription>显式展示 compat 已移除后的系统边界。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">/api/v1/* only</Badge>
              <Badge variant="outline">legacy compat routes: removed</Badge>
              <Badge variant="outline">BFF session + CSRF</Badge>
              <Badge variant="outline">node signature auth</Badge>
            </div>
            <HighlightPanel
              title="系统已无 compat 旁路"
              description="前端业务请求通过 Web BFF 进入所选节点的 /api/v1/*。历史 compat 路由已经删除，不再作为可访问边界保留。"
              tone="success"
            />
            <DetailGrid
              items={[
                { label: "api_contract", value: safeText(systemInfo?.api_contract, "api_v1_only"), mono: true, tone: "info" },
                { label: "compat", value: "removed", tone: "success" },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>LLM / 工具链概览</CardTitle>
            <CardDescription>快速查看当前节点上的 LLM、工具链与能力摘要。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <DetailGrid
              items={[
                { label: "LLM provider", value: llmProvider || "未配置" },
                { label: "LLM model", value: llmModel || "未配置" },
                { label: "resolved tools", value: `${configuredToolCount} / ${resolvedToolEntries.length}` },
                { label: "offline capabilities", value: String(offlineCapabilityCount) },
                { label: "jobs capabilities", value: String(jobsCapabilityCount) },
                { label: "debug capabilities", value: String(debugCapabilityCount) },
              ]}
            />
            <div className="rounded-xl border border-border/60 bg-background/50 p-4 text-sm text-muted-foreground">
              当前角色：<span className="font-medium text-foreground">{roleLabel(currentUser?.role)}</span>
              {isAdmin ? "。管理员仅额外开放“用户管理”子页。" : "。普通用户不会看到“用户管理”子页。"}
            </div>
          </CardContent>
        </Card>
      </div>

      {hasDefaultSecretRisk ? (
        <HighlightPanel
          title="默认 node secret 风险仍存在"
          description="BFF 默认节点或当前节点 control plane 仍在使用默认 secret。请尽快更新 node secret，避免保留默认密钥。"
          tone="danger"
        />
      ) : null}
    </div>
  );

  const renderBackendTab = (): JSX.Element => (
    <form className="space-y-5" onSubmit={submitConfig}>
      {patchMutation.error ? <ApiErrorAlert error={patchMutation.error} title="保存节点配置失败" /> : null}
      {configQuery.error ? <ApiErrorAlert error={configQuery.error} title="加载节点配置失败" /> : null}
      {!hasSelectedNode ? <MissingNodeNotice /> : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>workspace / server</CardTitle>
          <CardDescription>整理当前节点的工作区、默认协议与监听地址配置。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField label="workspace.root">
            <Input {...form.register("workspace_root")} />
          </FormField>
          <FormField label="workspace.default_protocol">
            <Input {...form.register("workspace_default_protocol")} />
          </FormField>
          <FormField label="server.host">
            <Input {...form.register("server_host")} />
          </FormField>
          <FormField label="server.port">
            <Input type="number" {...form.register("server_port")} />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>CORS</CardTitle>
          <CardDescription>布尔项保持直观开关，高级字段收纳在独立区域。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <SwitchRow
            title="server.cors.enabled"
            description="控制当前节点是否接受跨域请求。"
            checked={form.watch("cors_enabled")}
            onChange={(checked) => form.setValue("cors_enabled", checked)}
          />
          <SwitchRow
            title="server.cors.allow_credentials"
            description="保持 cookie/认证头是否允许跨域携带。"
            checked={form.watch("cors_allow_credentials")}
            onChange={(checked) => form.setValue("cors_allow_credentials", checked)}
          />
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <FormField label="allow_origins">
              <Textarea {...form.register("cors_allow_origins_text")} />
            </FormField>
            <FormField label="allow_origin_regex">
              <Input {...form.register("cors_allow_origin_regex")} />
            </FormField>
          </div>
        </CardContent>
      </Card>

      <ConfigSubmitBar
        disabled={!hasSelectedNode}
        pending={patchMutation.isPending}
        selectedNodeName={selectedNode?.name ?? "未选择节点"}
        submitMessage={submitMessage}
      />
    </form>
  );

  const renderSecurityTab = (): JSX.Element => (
    <div className="space-y-5">
      {securitySummaryQuery.error ? <ApiErrorAlert error={securitySummaryQuery.error} title="加载 BFF 安全摘要失败" /> : null}
      {systemInfoQuery.error && hasSelectedNode ? <ApiErrorAlert error={systemInfoQuery.error} title="读取节点安全摘要失败" /> : null}
      {!hasSelectedNode ? <MissingNodeNotice /> : null}

      {hasDefaultSecretRisk ? (
        <HighlightPanel
          title="using_default_secret = true"
          description="当前摘要显示默认 node secret 仍在使用。请尽快更新默认节点或 control plane secret，避免把默认密钥暴露在运行环境中。"
          tone="danger"
        />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Session / CSRF</CardTitle>
            <CardDescription>BFF 登录边界保持 HttpOnly session 与 CSRF 双重约束。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <DetailGrid
              items={[
                { label: "session cookie", value: safeText(securitySummary?.session?.cookie_name), mono: true },
                { label: "session secure", value: yesNo(securitySummary?.session?.secure) },
                { label: "session same_site", value: safeText(securitySummary?.session?.same_site) },
                { label: "csrf cookie", value: safeText(securitySummary?.csrf?.cookie_name), mono: true },
                { label: "csrf header", value: safeText(securitySummary?.csrf?.header_name), mono: true },
                { label: "csrf secure", value: yesNo(securitySummary?.csrf?.secure) },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>登录保护 / 初始账号</CardTitle>
            <CardDescription>新增基础失败节流，不区分用户名不存在和密码错误。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <DetailGrid
              items={[
                {
                  label: "登录失败节流",
                  value: securitySummary?.login_protection
                    ? `${securitySummary.login_protection.max_failures ?? 5} 次 / ${securitySummary.login_protection.window_seconds ?? 600}s`
                    : "未确认",
                },
                {
                  label: "封禁时长",
                  value: securitySummary?.login_protection
                    ? `${securitySummary.login_protection.block_seconds ?? 600}s`
                    : "未确认",
                },
                { label: "bootstrap admin", value: safeText(securitySummary?.bootstrap_admin?.username) },
                {
                  label: "password_source",
                  value: passwordSourceLabel(securitySummary?.bootstrap_admin?.password_source),
                  tone: securitySummary?.bootstrap_admin?.password_source === "default" ? "warning" : "success",
                },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Control Plane</CardTitle>
            <CardDescription>只读展示后端 control plane 安全状态与 token 过期策略。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <DetailGrid
              items={[
                { label: "control_plane.enabled", value: enabledDisabled(controlPlane?.enabled) },
                { label: "node_id", value: safeText(controlPlane?.node_id), mono: true },
                { label: "issuer", value: safeText(controlPlane?.issuer), mono: true },
                { label: "token_expire_seconds", value: formatSeconds(controlPlane?.token_expire_seconds) },
                { label: "secret_configured", value: yesNo(controlPlane?.secret_configured) },
                {
                  label: "runtime using_default_secret",
                  value: yesNo(runtimeSecurity?.using_default_secret),
                  tone: runtimeSecurity?.using_default_secret ? "danger" : "success",
                },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>边界声明</CardTitle>
            <CardDescription>安全页明确展示 compat 旁路已删除，只保留 /api/v1/* 主链路。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">legacy compat routes: removed</Badge>
              <Badge variant="outline">/api/v1/* only</Badge>
              <Badge variant="outline">BFF redirect + session</Badge>
              <Badge variant="outline">node signature auth</Badge>
            </div>
            <DetailGrid
              items={[
                { label: "compat", value: "removed", tone: "success" },
                { label: "api_contract", value: safeText(systemInfo?.api_contract, "api_v1_only"), mono: true },
                {
                  label: "default node using_default_secret",
                  value: yesNo(securitySummary?.default_node?.using_default_secret),
                  tone: securitySummary?.default_node?.using_default_secret ? "danger" : "success",
                },
                { label: "default node_id", value: safeText(securitySummary?.default_node?.node_id), mono: true },
              ]}
            />
            <HighlightPanel title="结构结论" description={COMPAT_REMOVED_TEXT} tone="success" />
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderLlmTab = (): JSX.Element => (
    <form className="space-y-5" onSubmit={submitConfig}>
      {patchMutation.error ? <ApiErrorAlert error={patchMutation.error} title="保存 LLM 配置失败" /> : null}
      {configQuery.error ? <ApiErrorAlert error={configQuery.error} title="加载 LLM 配置失败" /> : null}
      {!hasSelectedNode ? <MissingNodeNotice /> : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>模型接入</CardTitle>
          <CardDescription>整理 provider、model、base_url 与超时，不改变 PATCH 结构。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField label="llm.provider">
            <Input {...form.register("llm_provider")} />
          </FormField>
          <FormField label="llm.model">
            <Input {...form.register("llm_model")} />
          </FormField>
          <div className="md:col-span-2">
            <FormField label="llm.base_url">
              <Input {...form.register("llm_base_url")} />
            </FormField>
          </div>
          <div className="md:col-span-2">
            <FormField label="llm.api_key">
              <Input type="password" {...form.register("llm_api_key")} />
            </FormField>
          </div>
          <FormField label="llm.api_key_env">
            <Input {...form.register("llm_api_key_env")} />
          </FormField>
          <FormField label="llm.timeout_sec">
            <Input type="number" {...form.register("llm_timeout_sec")} />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>只读摘要</CardTitle>
          <CardDescription>当前页面只整理输入，不改变既有 envelope 与节点权限边界。</CardDescription>
        </CardHeader>
        <CardContent>
          <DetailGrid
            items={[
              { label: "provider", value: llmProvider || "未配置" },
              { label: "model", value: llmModel || "未配置" },
              { label: "base_url", value: llmBaseUrl || "未配置", mono: true },
              { label: "compat", value: "removed", tone: "success" },
            ]}
          />
        </CardContent>
      </Card>

      <ConfigSubmitBar
        disabled={!hasSelectedNode}
        pending={patchMutation.isPending}
        selectedNodeName={selectedNode?.name ?? "未选择节点"}
        submitMessage={submitMessage}
      />
    </form>
  );

  const renderToolchainTab = (): JSX.Element => (
    <form className="space-y-5" onSubmit={submitConfig}>
      {patchMutation.error ? <ApiErrorAlert error={patchMutation.error} title="保存工具链配置失败" /> : null}
      {configQuery.error ? <ApiErrorAlert error={configQuery.error} title="加载工具链配置失败" /> : null}
      {!hasSelectedNode ? <MissingNodeNotice /> : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>工具路径</CardTitle>
          <CardDescription>保留 AFL 与常用构建工具路径字段，便于当前节点集中维护。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField label="paths.afl_fuzz">
            <Input {...form.register("paths_afl_fuzz")} />
          </FormField>
          <FormField label="paths.afl_showmap">
            <Input {...form.register("paths_afl_showmap")} />
          </FormField>
          <FormField label="paths.afl_cc">
            <Input {...form.register("paths_afl_cc")} />
          </FormField>
          <FormField label="paths.afl_clang_fast">
            <Input {...form.register("paths_afl_clang_fast")} />
          </FormField>
          <FormField label="paths.cmake">
            <Input {...form.register("paths_cmake")} />
          </FormField>
          <FormField label="paths.make">
            <Input {...form.register("paths_make")} />
          </FormField>
          <FormField label="paths.ninja">
            <Input {...form.register("paths_ninja")} />
          </FormField>
          <FormField label="paths.git">
            <Input {...form.register("paths_git")} />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>已解析工具</CardTitle>
          <CardDescription>来自当前节点运行时摘要，帮助可视化确认路径是否真正生效。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DetailGrid
            items={resolvedToolEntries.length
              ? resolvedToolEntries.map(([key, value]) => ({
                  label: key,
                  value: safeText(value),
                  mono: true,
                  tone: value ? "success" : "warning",
                }))
              : [{ label: "resolved_tools", value: "暂无解析结果" }]}
          />
          <div className="rounded-xl border border-border/60 bg-background/50 p-4">
            <p className="text-sm font-medium">Raw Resolved Tools</p>
            <div className="mt-3 text-xs text-muted-foreground">
              <JsonViewer data={resolvedTools} compact />
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfigSubmitBar
        disabled={!hasSelectedNode}
        pending={patchMutation.isPending}
        selectedNodeName={selectedNode?.name ?? "未选择节点"}
        submitMessage={submitMessage}
      />
    </form>
  );

  const renderBuildTab = (): JSX.Element => (
    <form className="space-y-5" onSubmit={submitConfig}>
      {patchMutation.error ? <ApiErrorAlert error={patchMutation.error} title="保存构建配置失败" /> : null}
      {configQuery.error ? <ApiErrorAlert error={configQuery.error} title="加载构建配置失败" /> : null}
      {!hasSelectedNode ? <MissingNodeNotice /> : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>构建助手开关</CardTitle>
          <CardDescription>继续保留原有权限模型，不把浏览器权限边界放宽到任意命令执行。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <SwitchRow
            title="build.enabled"
            checked={form.watch("build_enabled")}
            onChange={(checked) => form.setValue("build_enabled", checked)}
          />
          <SwitchRow
            title="build.allow_llm_assist"
            checked={form.watch("build_allow_llm_assist")}
            onChange={(checked) => form.setValue("build_allow_llm_assist", checked)}
          />
          <SwitchRow
            title="build.allow_shell_scripts"
            description="默认建议关闭，保持安全边界清晰。"
            checked={form.watch("build_allow_shell_scripts")}
            onChange={(checked) => form.setValue("build_allow_shell_scripts", checked)}
          />
          <SwitchRow
            title="debugger.allow_network_replay"
            description="仅修改节点配置，不在前端放宽调试执行边界。"
            checked={form.watch("debugger_allow_network_replay")}
            onChange={(checked) => form.setValue("debugger_allow_network_replay", checked)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>高级构建 / 调试字段</CardTitle>
          <CardDescription>保留默认 compiler、gdb 与白名单工具列表。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField label="build.default_compiler">
            <Input {...form.register("build_default_compiler")} />
          </FormField>
          <FormField label="debugger.gdb_path">
            <Input {...form.register("debugger_gdb_path")} />
          </FormField>
          <FormField label="debugger.timeout_sec">
            <Input type="number" {...form.register("debugger_timeout_sec")} />
          </FormField>
          <div className="md:col-span-2">
            <FormField label="build.allowed_compilers">
              <Textarea {...form.register("build_allowed_compilers_text")} />
            </FormField>
          </div>
          <div className="md:col-span-2">
            <FormField label="build.allowed_tools">
              <Textarea {...form.register("build_allowed_tools_text")} />
            </FormField>
          </div>
        </CardContent>
      </Card>

      <HighlightPanel
        title="边界保持不变"
        description="设置页只调整当前节点配置；浏览器仍通过 BFF 代理访问节点，system info 公开，其余 /api/v1/* 继续保持签名鉴权。"
        tone="info"
      />

      <ConfigSubmitBar
        disabled={!hasSelectedNode}
        pending={patchMutation.isPending}
        selectedNodeName={selectedNode?.name ?? "未选择节点"}
        submitMessage={submitMessage}
      />
    </form>
  );

  const renderAccountTab = (): JSX.Element => (
    <div className="space-y-5">
      {changePasswordMutation.error ? <ApiErrorAlert error={changePasswordMutation.error} title="修改密码失败" /> : null}
      {logoutMutation.error ? <ApiErrorAlert error={logoutMutation.error} title="退出登录失败" /> : null}
      {securitySummaryQuery.error ? <ApiErrorAlert error={securitySummaryQuery.error} title="加载用户中心安全摘要失败" /> : null}

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>当前账号信息</CardTitle>
            <CardDescription>`/settings?tab=account` 直接作为用户中心入口使用。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <DetailGrid
              items={[
                { label: "username", value: currentUser?.username ?? "未加载" },
                { label: "role", value: roleLabel(currentUser?.role) },
                { label: "user_id", value: currentUser?.user_id ?? "未加载", mono: true },
                { label: "session cookie", value: safeText(securitySummary?.session?.cookie_name), mono: true },
              ]}
            />
            <div className="rounded-xl border border-border/60 bg-background/50 p-4 text-sm text-muted-foreground">
              用户菜单中的“用户中心”会直接跳转到当前子页；管理员仅额外多出“用户管理”分区。
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>修改密码</CardTitle>
            <CardDescription>服务端继续使用 scrypt 校验与 session 续签，不改权限模型。</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submitPassword}>
              <FormField label="current_password">
                <Input type="password" autoComplete="current-password" {...accountForm.register("current_password")} />
              </FormField>
              {accountForm.formState.errors.current_password?.message ? (
                <p className="text-xs text-danger">{accountForm.formState.errors.current_password.message}</p>
              ) : null}

              <FormField label="new_password">
                <Input type="password" autoComplete="new-password" {...accountForm.register("new_password")} />
              </FormField>
              {accountForm.formState.errors.new_password?.message ? (
                <p className="text-xs text-danger">{accountForm.formState.errors.new_password.message}</p>
              ) : null}

              {accountMessage ? <p className="text-sm text-muted-foreground">{accountMessage}</p> : null}

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={changePasswordMutation.isPending}>
                  <KeyRound className="size-4" />
                  {changePasswordMutation.isPending ? "提交中..." : "更新密码"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    accountForm.reset();
                    setAccountMessage(null);
                  }}
                >
                  重置表单
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>退出登录</CardTitle>
          <CardDescription>退出后返回 `/login`，保持 HttpOnly session + CSRF 的 Web BFF 登录边界。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-sm text-muted-foreground">
            当前会话不会暴露真实 secret；退出后用户菜单与受保护业务页都会回到登录入口。
          </div>
          <Button type="button" variant="danger" onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending}>
            <LogOut className="size-4" />
            {logoutMutation.isPending ? "退出中..." : "退出登录"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderUsersTab = (): JSX.Element => (
    <div className="space-y-5">
      {usersQuery.error ? <ApiErrorAlert error={usersQuery.error} title="加载用户列表失败" /> : null}
      {createUserMutation.error ? <ApiErrorAlert error={createUserMutation.error} title="创建用户失败" /> : null}
      {deleteUserMutation.error ? <ApiErrorAlert error={deleteUserMutation.error} title="删除用户失败" /> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard title="用户总数" value={String(managedUsers.length)} hint="BFF users 表" statusColor="blue" />
        <SummaryCard title="管理员" value={String(adminCount)} hint="权限模型不变" statusColor="amber" />
        <SummaryCard title="普通用户" value={String(regularUserCount)} hint="仅多用户管理子页" statusColor="teal" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>新增用户</CardTitle>
            <CardDescription>继续使用既有 `/web-api/users`，不引入复杂认证系统。</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submitCreateUser}>
              <FormField label="username">
                <Input autoComplete="username" {...createUserForm.register("username")} />
              </FormField>
              {createUserForm.formState.errors.username?.message ? (
                <p className="text-xs text-danger">{createUserForm.formState.errors.username.message}</p>
              ) : null}

              <FormField label="password">
                <Input type="password" autoComplete="new-password" {...createUserForm.register("password")} />
              </FormField>
              {createUserForm.formState.errors.password?.message ? (
                <p className="text-xs text-danger">{createUserForm.formState.errors.password.message}</p>
              ) : null}

              <FormField label="role">
                <Select
                  value={createUserForm.watch("role")}
                  onValueChange={(value) => createUserForm.setValue("role", value as "admin" | "user", { shouldValidate: true, shouldDirty: true })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">普通用户</SelectItem>
                    <SelectItem value="admin">管理员</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>

              {usersMessage ? <p className="text-sm text-muted-foreground">{usersMessage}</p> : null}

              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={createUserMutation.isPending}>
                  {createUserMutation.isPending ? "创建中..." : "创建用户"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    createUserForm.reset({ username: "", password: "", role: "user" });
                    setUsersMessage(null);
                  }}
                >
                  清空
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>用户列表</CardTitle>
            <CardDescription>管理员在系统设置内完成最小用户管理；普通用户不会看到该分区。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {usersQuery.isLoading ? (
              <div className="rounded-xl border border-border/60 bg-background/50 px-4 py-6 text-sm text-muted-foreground">正在加载用户列表...</div>
            ) : managedUsers.length === 0 ? (
              <div className="rounded-xl border border-border/60 bg-background/50 px-4 py-6 text-sm text-muted-foreground">暂无用户记录。</div>
            ) : (
              <Table>
                <TableHeader className="table-header-row">
                  <TableRow>
                    <TableHead>用户名</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead>更新时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {managedUsers.map((item: ManagedUser) => {
                    const deleting = deleteUserMutation.isPending && deleteUserMutation.variables === item.username;

                    return (
                      <TableRow key={item.user_id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{item.username}</span>
                            {item.username === currentUser?.username ? <Badge variant="outline">当前账号</Badge> : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.role === "admin" ? "warning" : "secondary"}>{roleLabel(item.role)}</Badge>
                        </TableCell>
                        <TableCell>{formatDateTime(item.created_at)}</TableCell>
                        <TableCell>{formatDateTime(item.updated_at)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            onClick={() => deleteUserMutation.mutate(item.username)}
                            disabled={deleting}
                          >
                            {deleting ? "删除中..." : "删除"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderCurrentTab = (): JSX.Element => {
    switch (activeTab) {
      case "overview":
        return renderOverviewTab();
      case "backend":
        return renderBackendTab();
      case "security":
        return renderSecurityTab();
      case "llm":
        return renderLlmTab();
      case "toolchain":
        return renderToolchainTab();
      case "build":
        return renderBuildTab();
      case "account":
        return renderAccountTab();
      case "users":
        return renderUsersTab();
      default:
        return renderOverviewTab();
    }
  };

  const controlPlaneSummaryValue = controlPlane?.enabled === true ? "已启用" : controlPlane?.enabled === false ? "未启用" : "待确认";
  const llmSummaryValue = llmModel || llmProvider || "未配置";
  const buildSummaryValue = buildEnabled ? "已启用" : "已关闭";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="系统设置"
        title="系统设置"
        description="将用户中心并入设置页，通过 /settings?tab=... 组织 Web BFF 认证、当前节点配置与安全摘要。"
        actions={
          <Button asChild variant="secondary">
            <Link to="/nodes">
              <Network className="size-4" />
              进入节点管理
            </Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          title="控制面状态"
          value={controlPlaneSummaryValue}
          hint={[
            safeText(controlPlane?.node_id, selectedNode?.name ?? "未选择节点"),
            safeText(controlPlane?.issuer, "issuer 未确认"),
          ].join(" · ")}
          statusColor={controlPlane?.enabled ? "blue" : "gray"}
        />
        <SummaryCard
          title="当前节点状态"
          value={currentNodeStatus}
          hint={[selectedNode?.name ?? "未选择节点", selectedNode?.baseUrl ?? "通过 Web BFF 代理"].join(" · ")}
          statusColor={currentNodeStatusColor}
        />
        <SummaryCard
          title="安全状态"
          value={securityStatusValue}
          hint={hasDefaultSecretRisk ? "默认 node secret 仍在使用" : "compat 旁路已移除，仅保留 /api/v1/*"}
          statusColor={securityStatusColor}
        />
        <SummaryCard
          title="LLM 状态"
          value={llmSummaryValue}
          hint={[llmProvider || "provider 未设置", llmBaseUrl || "base_url 未设置"].join(" · ")}
          statusColor={llmProvider || llmModel ? "violet" : "slate"}
        />
        <SummaryCard
          title="构建助手状态"
          value={buildSummaryValue}
          hint={[
            buildDefaultCompiler || "compiler 未设置",
            buildAllowLlmAssist ? "LLM 辅助开启" : "LLM 辅助关闭",
          ].join(" · ")}
          statusColor={buildEnabled ? "gold" : "gray"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[16.75rem_minmax(0,1fr)]">
        <aside className="self-start xl:sticky xl:top-[calc(var(--topbar-h)+1rem)]">
          <div className="space-y-4">
            <NavCard activeTab={activeTab} onChange={handleTabChange} isAdmin={isAdmin} />
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>当前分区</CardTitle>
                <CardDescription>页面底部 JSON 折叠区保留，便于对照当前分区的原始返回。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="rounded-xl border border-border/60 bg-background/50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Settings2 className="size-4 text-primary" />
                    <span className="font-medium">{SETTINGS_TABS.find((item) => item.id === activeTab)?.label ?? "总览"}</span>
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    {SETTINGS_TABS.find((item) => item.id === activeTab)?.description ?? "BFF 认证、控制面与结构边界"}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/50 px-4 py-3 text-muted-foreground">
                  <p className="font-medium text-foreground">结构说明</p>
                  <p className="mt-1">{COMPAT_REMOVED_TEXT}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </aside>

        <div className="min-w-0 space-y-6">{renderCurrentTab()}</div>
      </div>

      <Card>
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-5">
            <div>
              <CardTitle>当前配置 JSON / 调试信息</CardTitle>
              <CardDescription className="mt-1">保留底部折叠区，用于对照节点配置、system info、capabilities 与 BFF 安全摘要原始返回。</CardDescription>
            </div>
            <span className="rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs text-muted-foreground transition-colors group-open:bg-primary/10 group-open:text-primary">
              <span className="group-open:hidden">展开</span>
              <span className="hidden group-open:inline">收起</span>
            </span>
          </summary>
          <CardContent className="space-y-4 pt-0">
            <div className="rounded-xl border border-border/60 bg-background/50 p-4">
              <p className="text-sm font-medium">/api/v1/config</p>
              <div className="mt-3 text-xs text-muted-foreground">
                <JsonViewer data={configQuery.data as AppConfigResponse | undefined} />
              </div>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/50 p-4">
              <p className="text-sm font-medium">/api/v1/system/info</p>
              <div className="mt-3 text-xs text-muted-foreground">
                <JsonViewer data={systemInfo as SystemInfoResponse | undefined} compact />
              </div>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/50 p-4">
              <p className="text-sm font-medium">/api/v1/system/capabilities</p>
              <div className="mt-3 text-xs text-muted-foreground">
                <JsonViewer data={capabilities as SystemCapabilitiesResponse | undefined} compact />
              </div>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/50 p-4">
              <p className="text-sm font-medium">/web-api/auth/security-summary</p>
              <div className="mt-3 text-xs text-muted-foreground">
                <JsonViewer data={securitySummary ?? {}} compact />
              </div>
            </div>
          </CardContent>
        </details>
      </Card>
    </div>
  );
}

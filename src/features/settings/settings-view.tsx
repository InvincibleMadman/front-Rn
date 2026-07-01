import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Hammer, LayoutDashboard, Network, RefreshCw, Save, Server, ShieldCheck, Sparkles, UserCircle2, Users, Wrench } from "lucide-react";
import { useForm } from "react-hook-form";
import { ApiErrorReporter } from "@/components/common/api-error-alert";
import { JsonViewer } from "@/components/common/json-viewer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { authApi } from "@/lib/api/services/auth";
import { nodesApi } from "@/lib/api/services/nodes";
import { systemApi } from "@/lib/api/services/system";
import { usersApi } from "@/lib/api/services/users";
import { useAuthStore } from "@/stores/auth-store";
import { useUiStore } from "@/stores/ui-store";
import type { AppConfigResponse, SystemCapabilitiesResponse, SystemInfoResponse, ToolchainItemSummary } from "@/types/api/config";
import type { SettingsCapabilityItem } from "@/features/settings/settings-capability-grid";
import {
  SettingsHeroBoard,
  type SettingsHeroChip,
  type SettingsHeroSignalPanel,
} from "@/features/settings/settings-hero-board";
import type { SettingsSecurityCheck } from "@/features/settings/settings-security-posture";
import { accountSchema, buildPatch, configToForm, CONFIG_TABS, countAvailableTools, createUserSchema, formatSeconds, isSettingsTab, safeText, settingsSchema, toolchainSummaryTone, toolchainSummaryValue, yesNo, type AccountFormValues, type CreateUserFormValues, type NormalizedAuthSecuritySummary, type SettingsFormValues, type SettingsTab, type SettingsTabMeta } from "@/features/settings/settings-shared";
import { SettingsAccountSection } from "@/features/settings/settings-account-section";
import { SettingsBackendSection } from "@/features/settings/settings-backend-section";
import { SettingsBuildSection } from "@/features/settings/settings-build-section";
import { SettingsLlmSection } from "@/features/settings/settings-llm-section";
import { SettingsOverviewSection } from "@/features/settings/settings-overview-section";
import { SettingsSecuritySection } from "@/features/settings/settings-security-section";
import {
  SettingsTabsBar,
  type SettingsTabsBarItem,
} from "@/features/settings/settings-tabs-bar";
import { SettingsToolchainSection } from "@/features/settings/settings-toolchain-section";
import { SettingsUsersSection } from "@/features/settings/settings-users-section";

const SETTINGS_TABS: SettingsTabMeta[] = [
  { id: "overview", label: "概览", description: "BFF 认证、控制面与系统边界总览", icon: LayoutDashboard },
  { id: "backend", label: "节点与服务", description: "workspace、服务监听与 CORS 配置", icon: Server },
  { id: "security", label: "安全", description: "session、CSRF、登录节流与 control plane", icon: ShieldCheck },
  { id: "llm", label: "LLM", description: "provider、model、base_url 与密钥来源", icon: Sparkles },
  { id: "toolchain", label: "工具链", description: "AFL、构建工具与运行时解析结果", icon: Wrench },
  { id: "build", label: "构建与调试", description: "构建助手、编译器与调试开关", icon: Hammer },
  { id: "account", label: "用户中心", description: "当前账号、修改密码与退出登录", icon: UserCircle2 },
  { id: "users", label: "用户管理", description: "仅管理员可见", icon: Users, adminOnly: true },
];

function statusLabel(status: "ready" | "partial" | "unavailable"): string {
  if (status === "ready") return "Ready";
  if (status === "partial") return "Partial";
  return "Unavailable";
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
    if (!isSettingsTab(requestedTab, SETTINGS_TABS)) return "overview";
    if (requestedTab === "users" && hydrated && !isAdmin) {
      return currentUser ? "account" : "overview";
    }
    return requestedTab;
  }, [currentUser, hydrated, isAdmin, requestedTab]);

  useEffect(() => {
    if (!hydrated) return;

    let nextTab: SettingsTab | null = null;

    if (!isSettingsTab(requestedTab, SETTINGS_TABS)) {
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
    if (configQuery.data) {
      form.reset(configToForm(configQuery.data));
    }
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

  const rawSecuritySummary = securitySummaryQuery.data;
  const securitySummary = useMemo<NormalizedAuthSecuritySummary | undefined>(() => {
    if (!rawSecuritySummary) return undefined;

    return {
      ...rawSecuritySummary,
      session: {
        ...rawSecuritySummary.session,
        enabled: Boolean(rawSecuritySummary.session?.cookie_name),
      },
      csrf: {
        ...rawSecuritySummary.csrf,
        enabled: Boolean(rawSecuritySummary.csrf?.cookie_name && rawSecuritySummary.csrf?.header_name),
      },
    };
  }, [rawSecuritySummary]);

  const systemInfo = systemInfoQuery.data;
  const capabilities = capabilitiesQuery.data;
  const controlPlane = systemInfo?.control_plane ?? configQuery.data?.control_plane;
  const runtimeSecurity = configQuery.data?.runtime_info?.security ?? systemInfo?.runtime_info?.security;
  const toolchainSummary = useMemo<Record<string, ToolchainItemSummary>>(
    () => configQuery.data?.runtime_info?.toolchain_summary ?? systemInfo?.runtime_info?.toolchain_summary ?? {},
    [configQuery.data?.runtime_info?.toolchain_summary, systemInfo?.runtime_info?.toolchain_summary],
  );
  const toolchainEntries = useMemo(
    () => Object.entries(toolchainSummary).sort(([left], [right]) => left.localeCompare(right)),
    [toolchainSummary],
  );

  const managedUsers = usersQuery.data ?? [];
  const adminCount = managedUsers.filter((item) => item.role === "admin").length;
  const regularUserCount = managedUsers.filter((item) => item.role === "user").length;

  const buildEnabled = form.watch("build_enabled");
  const buildAllowLlmAssist = form.watch("build_allow_llm_assist");
  const llmProvider = form.watch("llm_provider");
  const llmModel = form.watch("llm_model");
  const llmBaseUrl = form.watch("llm_base_url");
  const debuggerGdbPath = form.watch("debugger_gdb_path");

  const currentNodeStatus = !hasSelectedNode
    ? "未选择节点"
    : systemInfoQuery.data
      ? "节点在线"
      : systemInfoQuery.isError
        ? "节点离线"
        : "节点检测中";

  const nodeTone = !hasSelectedNode
    ? "default"
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
  const securityTone = hasDefaultSecretRisk
    ? "danger"
    : hasDefaultBootstrapPassword
      ? "warning"
      : securitySummary?.session?.http_only
        ? "success"
        : "default";

  const configuredToolCount = countAvailableTools(toolchainSummary);
  const offlineCapabilityCount = capabilities?.offline?.length ?? 0;
  const jobsCapabilityCount = capabilities?.jobs?.length ?? 0;
  const debugCapabilityCount = capabilities?.debug?.length ?? 0;
  const hasDirtyConfig = form.formState.isDirty;
  const hasSecurityInputs =
    Boolean(securitySummary)
    || Boolean(systemInfo?.control_plane)
    || Boolean(controlPlane)
    || Boolean(runtimeSecurity);

  const securityChecks = useMemo<SettingsSecurityCheck[]>(() => {
    if (!hasSecurityInputs) {
      return [
        { label: "Non-default node secret", passed: false },
        { label: "CSRF enabled", passed: false },
        { label: "HttpOnly session", passed: false },
        { label: "Login throttling", passed: false },
        { label: "Control plane enabled", passed: false },
      ];
    }

    const checks = [
      !securitySummary?.default_node?.using_default_secret,
      Boolean(securitySummary?.csrf?.enabled),
      Boolean(securitySummary?.session?.http_only),
      (securitySummary?.login_protection?.max_failures ?? 0) > 0,
      Boolean(systemInfo?.control_plane?.enabled),
    ];

    return [
      { label: "Non-default node secret", passed: checks[0] },
      { label: "CSRF enabled", passed: checks[1] },
      { label: "HttpOnly session", passed: checks[2] },
      { label: "Login throttling", passed: checks[3] },
      { label: "Control plane enabled", passed: checks[4] },
    ];
  }, [hasSecurityInputs, securitySummary, systemInfo?.control_plane?.enabled]);
  const passedSecurityChecks = securityChecks.filter((item) => item.passed).length;
  const securityPostureScore = hasSecurityInputs
    ? Math.round((passedSecurityChecks / securityChecks.length) * 100)
    : 0;

  const controlPlaneSummaryValue = controlPlane?.enabled === true
    ? "已启用"
    : controlPlane?.enabled === false
      ? "未启用"
      : "待确认";
  const llmConfiguredStatus: "ready" | "partial" | "unavailable" =
    llmProvider && llmModel ? "ready" : llmProvider || llmModel || llmBaseUrl ? "partial" : "unavailable";
  const toolchainReadiness: "ready" | "partial" | "unavailable" =
    !toolchainEntries.length ? "unavailable" : configuredToolCount === toolchainEntries.length ? "ready" : "partial";
  const buildAssistantStatus: "ready" | "partial" | "unavailable" =
    buildEnabled ? (buildAllowLlmAssist ? "ready" : "partial") : "unavailable";
  const llmTone = llmConfiguredStatus === "ready" ? "success" : llmConfiguredStatus === "partial" ? "warning" : "default";
  const toolchainTone = toolchainReadiness === "ready" ? "success" : toolchainReadiness === "partial" ? "warning" : "default";

  const heroChips = useMemo<SettingsHeroChip[]>(() => [
    { label: "Node", value: currentNodeStatus, tone: nodeTone },
    { label: "Control plane", value: controlPlaneSummaryValue, tone: controlPlane?.enabled ? "success" : "warning" },
    { label: "Security posture", value: hasSecurityInputs ? `${securityPostureScore}%` : "Unavailable", tone: hasSecurityInputs ? securityTone : "default" },
    { label: "LLM", value: statusLabel(llmConfiguredStatus), tone: llmTone },
    { label: "Toolchain", value: statusLabel(toolchainReadiness), tone: toolchainTone },
  ], [
    controlPlane?.enabled,
    controlPlaneSummaryValue,
    currentNodeStatus,
    hasSecurityInputs,
    llmConfiguredStatus,
    llmTone,
    nodeTone,
    securityPostureScore,
    securityTone,
    toolchainReadiness,
    toolchainTone,
  ]);

  const signalPanels = useMemo<SettingsHeroSignalPanel[]>(() => [
    {
      id: "node-control-plane",
      eyebrow: "Current node / control plane",
      title: selectedNode?.name ?? "未选择节点",
      value: currentNodeStatus,
      description: "聚合当前节点的 control plane、node_id 与现代 `/api/v1/*` 链路状态。",
      tone: nodeTone,
      items: [
        { label: "node_id", value: safeText(controlPlane?.node_id, selectedNodeId || "未选择节点"), mono: true },
        { label: "issuer", value: safeText(controlPlane?.issuer), mono: true },
        { label: "token ttl", value: formatSeconds(controlPlane?.token_expire_seconds) },
        { label: "base url", value: selectedNode?.baseUrl ?? "通过 Web BFF 代理", mono: true },
      ],
    },
    {
      id: "bff-security",
      eyebrow: "Web BFF security",
      title: "Session + CSRF",
      value: hasSecurityInputs ? `${securityPostureScore}%` : "Unavailable",
      description: "基于 BFF 会话、CSRF、登录节流与默认 secret 风险计算安全姿态。",
      tone: hasSecurityInputs ? securityTone : "default",
      items: [
        { label: "http_only", value: yesNo(securitySummary?.session?.http_only), tone: securitySummary?.session?.http_only ? "success" : "warning" },
        { label: "csrf", value: securitySummary?.csrf?.enabled ? "enabled" : "not ready", tone: securitySummary?.csrf?.enabled ? "success" : "warning" },
        {
          label: "login guard",
          value: securitySummary?.login_protection
            ? `${securitySummary.login_protection.max_failures ?? 0} / ${securitySummary.login_protection.window_seconds ?? 0}s`
            : "未确认",
        },
        {
          label: "default secret",
          value: securitySummary?.default_node?.using_default_secret ? "in use" : "removed",
          tone: securitySummary?.default_node?.using_default_secret ? "danger" : "success",
        },
      ],
    },
    {
      id: "llm-build",
      eyebrow: "LLM / build",
      title: llmProvider || "LLM not configured",
      value: buildEnabled ? "已启用" : "已关闭",
      description: "聚合 provider、model、构建助手开关与 LLM 辅助状态。",
      tone: llmTone,
      items: [
        { label: "model", value: llmModel || "未配置" },
        { label: "base url", value: llmBaseUrl || "未配置", mono: true },
        { label: "build", value: buildEnabled ? "enabled" : "disabled", tone: buildEnabled ? "success" : "warning" },
        { label: "llm assist", value: buildAllowLlmAssist ? "enabled" : "disabled", tone: buildAllowLlmAssist ? "success" : "default" },
      ],
    },
    {
      id: "toolchain",
      eyebrow: "Toolchain readiness",
      title: `${configuredToolCount} / ${toolchainEntries.length || 0}`,
      value: statusLabel(toolchainReadiness),
      description: "根据已解析工具数量判断 AFL 与构建工具链是否就绪。",
      tone: toolchainTone,
      items: [
        { label: "afl_fuzz", value: toolchainSummaryValue(toolchainSummary.afl_fuzz), tone: toolchainSummaryTone(toolchainSummary.afl_fuzz) },
        { label: "afl_showmap", value: toolchainSummaryValue(toolchainSummary.afl_showmap), tone: toolchainSummaryTone(toolchainSummary.afl_showmap) },
        { label: "cmake", value: toolchainSummaryValue(toolchainSummary.cmake), tone: toolchainSummaryTone(toolchainSummary.cmake) },
        { label: "gdb", value: toolchainSummaryValue(toolchainSummary.gdb), tone: toolchainSummaryTone(toolchainSummary.gdb) },
      ],
    },
  ], [
    buildAllowLlmAssist,
    buildEnabled,
    configuredToolCount,
    controlPlane?.issuer,
    controlPlane?.node_id,
    controlPlane?.token_expire_seconds,
    currentNodeStatus,
    llmBaseUrl,
    llmModel,
    llmProvider,
    hasSecurityInputs,
    llmTone,
    nodeTone,
    toolchainEntries.length,
    toolchainSummary.afl_fuzz,
    toolchainSummary.afl_showmap,
    toolchainSummary.cmake,
    toolchainSummary.gdb,
    securityPostureScore,
    securitySummary?.csrf?.enabled,
    securitySummary?.default_node?.using_default_secret,
    securitySummary?.login_protection,
    securitySummary?.session?.http_only,
    securityTone,
    selectedNode?.baseUrl,
    selectedNode?.name,
    selectedNodeId,
    toolchainReadiness,
    toolchainTone,
  ]);

  const capabilityItems = useMemo<SettingsCapabilityItem[]>(() => [
    {
      id: "offline",
      label: "offline",
      description: `${offlineCapabilityCount} offline capabilities`,
      status: offlineCapabilityCount > 0 ? "ready" : "unavailable",
    },
    {
      id: "jobs",
      label: "jobs",
      description: `${jobsCapabilityCount} job capabilities`,
      status: jobsCapabilityCount > 0 ? "ready" : "unavailable",
    },
    {
      id: "debug",
      label: "debug",
      description: `${debugCapabilityCount} debug capabilities`,
      status: debugCapabilityCount > 0 ? "ready" : "unavailable",
    },
    {
      id: "reports",
      label: "reports",
      description: "通过现代 `/api/v1/*` 主链路进入报告能力",
      status: hasSelectedNode && systemInfo
        ? safeText(systemInfo.api_contract, "api_v1_only") === "api_v1_only" ? "partial" : "unavailable"
        : "unavailable",
    },
    {
      id: "build-assistant",
      label: "build assistant",
      description: buildAllowLlmAssist ? "LLM 辅助构建已开启" : "仅保留基础构建助手",
      status: buildAssistantStatus,
    },
    {
      id: "llm-configured",
      label: "llm configured",
      description: llmProvider && llmModel ? `${llmProvider} / ${llmModel}` : "provider 或 model 未完整配置",
      status: llmConfiguredStatus,
    },
    {
      id: "toolchain-resolved",
      label: "toolchain resolved",
      description: `${configuredToolCount} / ${toolchainEntries.length || 0} tools resolved`,
      status: toolchainReadiness,
    },
  ], [
    buildAllowLlmAssist,
    buildAssistantStatus,
    configuredToolCount,
    debugCapabilityCount,
    hasSelectedNode,
    jobsCapabilityCount,
    llmConfiguredStatus,
    llmModel,
    llmProvider,
    offlineCapabilityCount,
    toolchainEntries.length,
    systemInfo?.api_contract,
    toolchainReadiness,
  ]);

  const tabItems = useMemo<SettingsTabsBarItem[]>(
    () => SETTINGS_TABS
      .filter((item) => (item.adminOnly ? isAdmin : true))
      .map((item) => ({
        id: item.id,
        label: item.label,
        description: item.description,
        icon: item.icon,
        badge:
          item.id === "security" && hasDefaultSecretRisk
            ? { tone: "warning" as const, label: "默认 secret 风险" }
            : item.id === "toolchain" && toolchainEntries.length > configuredToolCount
              ? { tone: "partial" as const, label: "工具链未完全就绪" }
              : undefined,
      })),
    [configuredToolCount, hasDefaultSecretRisk, isAdmin, toolchainEntries.length],
  );

  const refreshSettingsView = async (): Promise<void> => {
    const tasks: Array<Promise<unknown>> = [nodesQuery.refetch(), securitySummaryQuery.refetch()];

    if (hasSelectedNode) {
      tasks.push(configQuery.refetch(), systemInfoQuery.refetch(), capabilitiesQuery.refetch());
    }
    if (isAdmin) {
      tasks.push(usersQuery.refetch());
    }

    await Promise.all(tasks);
  };

  const handleTabChange = (tab: SettingsTab): void => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next);
  };

  const saveConfigFromHero = (): void => {
    void submitConfig();
  };

  const canSaveFromHero = hasDirtyConfig && CONFIG_TABS.has(activeTab);

  return (
    <div className="settings-page-shell">
      <div className="settings-page-stack">
        <ApiErrorReporter error={securitySummaryQuery.error} title="加载 BFF 安全摘要失败" source="settings" />
        <ApiErrorReporter error={nodesQuery.error} title="加载节点列表失败" source="settings" />
        <ApiErrorReporter error={systemInfoQuery.error} title="读取当前节点 system info 失败" source="settings" />
        <ApiErrorReporter error={configQuery.error} title="读取当前节点配置失败" source="settings" />
        <ApiErrorReporter error={capabilitiesQuery.error} title="读取节点能力摘要失败" source="settings" />
        <ApiErrorReporter error={patchMutation.error} title="保存节点配置失败" source="settings" />
        <ApiErrorReporter error={changePasswordMutation.error} title="修改密码失败" source="settings" />
        <ApiErrorReporter error={logoutMutation.error} title="退出登录失败" source="settings" />
        <ApiErrorReporter error={usersQuery.error} title="加载用户列表失败" source="settings" />
        <ApiErrorReporter error={createUserMutation.error} title="创建用户失败" source="settings" />
        <ApiErrorReporter error={deleteUserMutation.error} title="删除用户失败" source="settings" />

        <div className="space-y-4">
          <SettingsHeroBoard
            eyebrow="Control plane · settings"
            title="系统设置"
            description="集中总览当前节点、控制面、安全、LLM、工具链与构建助手状态，并在保持 `/settings?tab=...` 的前提下重排各个设置子页。"
            chips={heroChips}
            actions={(
              <>
                <Button asChild variant="outline">
                  <Link to="/nodes">
                    <Network className="size-4" />
                    进入节点管理
                  </Link>
                </Button>
                <Button type="button" variant="secondary" onClick={() => void refreshSettingsView()}>
                  <RefreshCw className="size-4" />
                  刷新
                </Button>
                {canSaveFromHero ? (
                  <Button type="button" onClick={saveConfigFromHero} disabled={patchMutation.isPending || !hasSelectedNode}>
                    <Save className="size-4" />
                    {patchMutation.isPending ? "保存中..." : "保存变更"}
                  </Button>
                ) : null}
              </>
            )}
            signalPanels={signalPanels}
            securityPosture={{
              score: securityPostureScore,
              passed: passedSecurityChecks,
              total: securityChecks.length,
              available: hasSecurityInputs,
              checks: securityChecks,
              highlightDefaultSecretWarning: hasDefaultSecretRisk,
            }}
            capabilities={capabilityItems}
          />

          <SettingsTabsBar items={tabItems} activeTab={activeTab} onChange={(tab) => handleTabChange(tab as SettingsTab)} />
        </div>

      <section className="settings-page-content">
        {activeTab === "overview" ? (
          <SettingsOverviewSection
            hasSelectedNode={hasSelectedNode}
            selectedNode={selectedNode}
            currentNodeStatus={currentNodeStatus}
            controlPlane={controlPlane}
            securitySummary={securitySummary}
            currentUser={currentUser}
            isAdmin={isAdmin}
            llmProvider={llmProvider ?? ""}
            llmModel={llmModel ?? ""}
            buildEnabled={buildEnabled}
            buildAllowLlmAssist={buildAllowLlmAssist}
            configuredToolCount={configuredToolCount}
            resolvedToolCount={toolchainEntries.length}
            offlineCapabilityCount={offlineCapabilityCount}
            jobsCapabilityCount={jobsCapabilityCount}
            debugCapabilityCount={debugCapabilityCount}
            hasDefaultSecretRisk={hasDefaultSecretRisk}
            systemInfo={systemInfo}
            securitySummaryError={securitySummaryQuery.error}
            nodesError={nodesQuery.error}
            systemInfoError={systemInfoQuery.error}
          />
        ) : null}

        {activeTab === "backend" ? (
          <SettingsBackendSection
            form={form}
            submitConfig={submitConfig}
            patchError={patchMutation.error}
            configError={configQuery.error}
            hasSelectedNode={hasSelectedNode}
            selectedNode={selectedNode}
            pending={patchMutation.isPending}
            submitMessage={submitMessage}
            config={configQuery.data}
          />
        ) : null}

        {activeTab === "security" ? (
          <SettingsSecuritySection
            hasSelectedNode={hasSelectedNode}
            securitySummary={securitySummary}
            controlPlane={controlPlane}
            runtimeSecurity={runtimeSecurity}
            hasDefaultSecretRisk={hasDefaultSecretRisk}
            systemInfo={systemInfo}
            securitySummaryError={securitySummaryQuery.error}
            systemInfoError={systemInfoQuery.error}
          />
        ) : null}

        {activeTab === "llm" ? (
          <SettingsLlmSection
            form={form}
            submitConfig={submitConfig}
            patchError={patchMutation.error}
            configError={configQuery.error}
            hasSelectedNode={hasSelectedNode}
            selectedNode={selectedNode}
            pending={patchMutation.isPending}
            submitMessage={submitMessage}
            llmProvider={llmProvider ?? ""}
            llmModel={llmModel ?? ""}
            llmBaseUrl={llmBaseUrl ?? ""}
          />
        ) : null}

        {activeTab === "toolchain" ? (
          <SettingsToolchainSection
            form={form}
            submitConfig={submitConfig}
            patchError={patchMutation.error}
            configError={configQuery.error}
            hasSelectedNode={hasSelectedNode}
            selectedNode={selectedNode}
            pending={patchMutation.isPending}
            submitMessage={submitMessage}
            toolchainSummary={toolchainSummary}
            toolchainEntries={toolchainEntries}
          />
        ) : null}

        {activeTab === "build" ? (
          <SettingsBuildSection
            form={form}
            submitConfig={submitConfig}
            patchError={patchMutation.error}
            configError={configQuery.error}
            hasSelectedNode={hasSelectedNode}
            selectedNode={selectedNode}
            pending={patchMutation.isPending}
            submitMessage={submitMessage}
            gdbSummary={toolchainSummary.gdb}
          />
        ) : null}

        {activeTab === "account" ? (
          <SettingsAccountSection
            currentUser={currentUser}
            securitySummary={securitySummary}
            accountForm={accountForm}
            submitPassword={submitPassword}
            changePasswordPending={changePasswordMutation.isPending}
            logoutPending={logoutMutation.isPending}
            accountMessage={accountMessage}
            onResetPasswordForm={() => {
              accountForm.reset();
              setAccountMessage(null);
            }}
            onLogout={() => logoutMutation.mutate()}
            changePasswordError={changePasswordMutation.error}
            logoutError={logoutMutation.error}
            securitySummaryError={securitySummaryQuery.error}
          />
        ) : null}

        {activeTab === "users" && isAdmin ? (
          <SettingsUsersSection
            users={managedUsers}
            adminCount={adminCount}
            regularUserCount={regularUserCount}
            currentUser={currentUser}
            createUserForm={createUserForm}
            submitCreateUser={submitCreateUser}
            usersMessage={usersMessage}
            createUserPending={createUserMutation.isPending}
            deleteUserPendingUsername={deleteUserMutation.isPending ? deleteUserMutation.variables : undefined}
            onDeleteUser={(username) => deleteUserMutation.mutate(username)}
            onResetCreateUserForm={() => {
              createUserForm.reset({ username: "", password: "", role: "user" });
              setUsersMessage(null);
            }}
            usersError={usersQuery.error}
            createUserError={createUserMutation.error}
            deleteUserError={deleteUserMutation.error}
            usersLoading={usersQuery.isLoading}
          />
        ) : null}
      </section>

      <Card className="settings-json-foldout">
        <details className="group">
          <summary className="settings-json-foldout__summary">
            <div>
              <CardTitle>当前配置 JSON / 调试信息</CardTitle>
              <CardDescription className="mt-1">原始返回JSON，用于调试对照节点配置、system info、capabilities 与 BFF 安全摘要原始返回</CardDescription>
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
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Network, Save, ShieldEllipsis, Wrench } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { systemApi } from "@/lib/api/services/system";
import type { AppConfigResponse, ConfigPatchRequest } from "@/types/api/config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/common/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { JsonViewer } from "@/components/common/json-viewer";
import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { SummaryCard } from "@/components/common/summary-card";

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

type SettingsFormValues = z.infer<typeof settingsSchema>;

function splitLines(value?: string): string[] {
  return (value ?? "").split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
}

function text(value?: string): string {
  return value?.trim() ?? "";
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

function SwitchRow({ title, description, checked, onChange }: { title: string; description?: string; checked: boolean; onChange: (checked: boolean) => void }): JSX.Element {
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

export function SettingsView(): JSX.Element {
  const configQuery = useQuery({ queryKey: ["config"], queryFn: systemApi.getConfig });
  const systemInfoQuery = useQuery({ queryKey: ["system-info"], queryFn: systemApi.getSystemInfo });
  const capabilitiesQuery = useQuery({ queryKey: ["capabilities"], queryFn: systemApi.getSystemCapabilities });
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: configToForm(),
  });

  useEffect(() => {
    if (configQuery.data) form.reset(configToForm(configQuery.data));
  }, [configQuery.data, form]);

  const patchMutation = useMutation({
    mutationFn: systemApi.patchConfig,
    onSuccess: async (saved) => {
      form.reset(configToForm(saved));
      setSubmitMessage("配置已更新");
      await Promise.all([configQuery.refetch(), systemInfoQuery.refetch(), capabilitiesQuery.refetch()]);
    },
    onError: () => setSubmitMessage(null),
  });

  const resolvedTools = useMemo(
    () => configQuery.data?.runtime_info?.resolved_afl_tools ?? systemInfoQuery.data?.afl?.resolved_tools ?? {},
    [configQuery.data, systemInfoQuery.data],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="系统设置"
        title="系统设置"
        description="减少不必要输入框，按控制面状态、节点基础配置、CORS、LLM、工具路径与构建助手分组。"
        actions={<Button asChild variant="secondary"><Link to="/nodes"><Network className="size-4" />进入节点管理</Link></Button>}
      />

      {patchMutation.error ? <ApiErrorAlert error={patchMutation.error} title="保存配置失败" /> : null}
      {configQuery.error ? <ApiErrorAlert error={configQuery.error} title="加载配置失败" /> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="控制面状态" value="online" hint="Web BFF / 当前节点" statusColor="blue" />
        <SummaryCard title="节点端口" value={String(form.watch("server_port"))} hint={form.watch("server_host") || "-"} statusColor="teal" />
        <SummaryCard title="LLM 模型" value={form.watch("llm_model") || "-"} hint={form.watch("llm_provider") || "-"} statusColor="violet" />
        <SummaryCard title="构建助手" value={form.watch("build_enabled") ? "enabled" : "disabled"} hint={form.watch("build_default_compiler") || "-"} statusColor="gold" />
      </div>

      <form className="space-y-4" onSubmit={form.handleSubmit((values) => { setSubmitMessage(null); patchMutation.mutate(buildPatch(values)); })}>
        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Web 控制面状态</CardTitle>
              <CardDescription>只读为主，展示当前系统和能力摘要。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border border-border/60 bg-background/50 p-4 text-sm">
                <p className="font-medium">System Info</p>
                <div className="mt-2 text-xs text-muted-foreground">
                  <JsonViewer data={systemInfoQuery.data ?? {}} compact />
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/50 p-4 text-sm">
                <p className="font-medium">Capabilities</p>
                <div className="mt-2 text-xs text-muted-foreground">
                  <JsonViewer data={capabilitiesQuery.data ?? {}} compact />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>当前节点基础配置</CardTitle>
              <CardDescription>工作区与服务监听配置。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <FormField label="workspace.root"><Input {...form.register("workspace_root")} /></FormField>
              <FormField label="workspace.default_protocol"><Input {...form.register("workspace_default_protocol")} /></FormField>
              <FormField label="server.host"><Input {...form.register("server_host")} /></FormField>
              <FormField label="server.port"><Input type="number" {...form.register("server_port")} /></FormField>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>CORS / 服务配置</CardTitle>
              <CardDescription>常用布尔项直接用 Switch，高级字段折叠。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <SwitchRow title="server.cors.enabled" description="允许前端域访问当前节点。" checked={form.watch("cors_enabled")} onChange={(checked) => form.setValue("cors_enabled", checked)} />
              <SwitchRow title="server.cors.allow_credentials" checked={form.watch("cors_allow_credentials")} onChange={(checked) => form.setValue("cors_allow_credentials", checked)} />
              <details className="rounded-xl border border-border/60 bg-background/50 p-4">
                <summary className="cursor-pointer text-sm font-medium">高级 CORS</summary>
                <div className="mt-4 grid gap-4">
                  <FormField label="allow_origins"><Textarea {...form.register("cors_allow_origins_text")} /></FormField>
                  <FormField label="allow_origin_regex"><Input {...form.register("cors_allow_origin_regex")} /></FormField>
                </div>
              </details>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>LLM 配置</CardTitle>
              <CardDescription>保留必要字段，敏感 key 继续用密码框。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <FormField label="llm.provider"><Input {...form.register("llm_provider")} /></FormField>
              <FormField label="llm.model"><Input {...form.register("llm_model")} /></FormField>
              <div className="md:col-span-2"><FormField label="llm.base_url"><Input {...form.register("llm_base_url")} /></FormField></div>
              <div className="md:col-span-2"><FormField label="llm.api_key"><Input type="password" {...form.register("llm_api_key")} /></FormField></div>
              <FormField label="llm.api_key_env"><Input {...form.register("llm_api_key_env")} /></FormField>
              <FormField label="llm.timeout_sec"><Input type="number" {...form.register("llm_timeout_sec")} /></FormField>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>工具路径</CardTitle>
              <CardDescription>常用 AFL / build 工具集中管理。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <FormField label="afl_fuzz"><Input {...form.register("paths_afl_fuzz")} /></FormField>
              <FormField label="afl_showmap"><Input {...form.register("paths_afl_showmap")} /></FormField>
              <FormField label="afl_cc"><Input {...form.register("paths_afl_cc")} /></FormField>
              <FormField label="afl_clang_fast"><Input {...form.register("paths_afl_clang_fast")} /></FormField>
              <FormField label="cmake"><Input {...form.register("paths_cmake")} /></FormField>
              <FormField label="make"><Input {...form.register("paths_make")} /></FormField>
              <FormField label="ninja"><Input {...form.register("paths_ninja")} /></FormField>
              <FormField label="git"><Input {...form.register("paths_git")} /></FormField>
              <div className="md:col-span-2 rounded-xl border border-border/60 bg-background/50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Wrench className="size-4 text-primary" />
                  已解析工具
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  <JsonViewer data={resolvedTools} compact />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>构建助手 / 调试器</CardTitle>
              <CardDescription>开关和高级项分开，避免整页密集输入框。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <SwitchRow title="build.enabled" checked={form.watch("build_enabled")} onChange={(checked) => form.setValue("build_enabled", checked)} />
              <SwitchRow title="build.allow_llm_assist" checked={form.watch("build_allow_llm_assist")} onChange={(checked) => form.setValue("build_allow_llm_assist", checked)} />
              <SwitchRow title="build.allow_shell_scripts" description="默认关闭，保持安全边界。" checked={form.watch("build_allow_shell_scripts")} onChange={(checked) => form.setValue("build_allow_shell_scripts", checked)} />
              <SwitchRow title="debugger.allow_network_replay" description="仅修改配置，不在前端擅自启用网络回放。" checked={form.watch("debugger_allow_network_replay")} onChange={(checked) => form.setValue("debugger_allow_network_replay", checked)} />
              <details className="rounded-xl border border-border/60 bg-background/50 p-4">
                <summary className="cursor-pointer text-sm font-medium">高级构建 / 调试字段</summary>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <FormField label="build.default_compiler"><Input {...form.register("build_default_compiler")} /></FormField>
                  <FormField label="debugger.gdb_path"><Input {...form.register("debugger_gdb_path")} /></FormField>
                  <FormField label="debugger.timeout_sec"><Input type="number" {...form.register("debugger_timeout_sec")} /></FormField>
                  <div className="md:col-span-2"><FormField label="build.allowed_compilers"><Textarea {...form.register("build_allowed_compilers_text")} /></FormField></div>
                  <div className="md:col-span-2"><FormField label="build.allowed_tools"><Textarea {...form.register("build_allowed_tools_text")} /></FormField></div>
                </div>
              </details>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>安全提示</CardTitle>
            <CardDescription>保持现有 node token + 请求签名边界，不在前端放宽命令执行能力。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p className="flex items-center gap-2"><KeyRound className="size-4 shrink-0 text-primary" /> API Key 使用密码框承载。</p>
            <p className="flex items-center gap-2"><ShieldEllipsis className="size-4 shrink-0 text-primary" /> 当前页修改的是当前节点后端配置，仍需通过 BFF 登录态和节点签名认证。</p>
            <p>未展示 node_secret、后端 node token、服务器绝对路径。</p>
          </CardContent>
        </Card>

        {submitMessage ? <p className="text-sm text-muted-foreground">{submitMessage}</p> : null}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={patchMutation.isPending}>
            <Save className="size-4" />
            {patchMutation.isPending ? "保存中..." : "保存配置"}
          </Button>
        </div>
      </form>

      <Card>
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-5">
            <div>
              <CardTitle>当前配置 JSON / 调试信息</CardTitle>
              <CardDescription className="mt-1">默认折叠，仅用于联调查看完整原始返回。</CardDescription>
            </div>
            <span className="rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs text-muted-foreground transition-colors group-open:bg-primary/10 group-open:text-primary"><span className="group-open:hidden">展开</span><span className="hidden group-open:inline">收起</span></span>
          </summary>
          <CardContent className="pt-0"><JsonViewer data={configQuery.data as AppConfigResponse | undefined} /></CardContent>
        </details>
      </Card>
    </div>
  );
}

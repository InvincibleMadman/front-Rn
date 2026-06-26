import type { BaseSyntheticEvent, ComponentType } from "react";
import { z } from "zod";
import type { AuthSecuritySummary } from "@/types/api/auth";
import type { AppConfigResponse, ConfigPatchRequest, ToolchainItemSummary } from "@/types/api/config";

export const settingsSchema = z.object({
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

export const accountSchema = z.object({
  current_password: z.string().min(1, "请输入当前密码"),
  new_password: z.string().min(8, "新密码至少 8 位").max(128, "新密码最多 128 位"),
});

export const createUserSchema = z.object({
  username: z.string().trim().min(1, "请输入用户名"),
  password: z.string().min(8, "密码至少 8 位").max(128, "密码最多 128 位"),
  role: z.enum(["admin", "user"]),
});

export type SettingsFormValues = z.infer<typeof settingsSchema>;
export type AccountFormValues = z.infer<typeof accountSchema>;
export type CreateUserFormValues = z.infer<typeof createUserSchema>;

export type SettingsTab =
  | "overview"
  | "backend"
  | "security"
  | "llm"
  | "toolchain"
  | "build"
  | "account"
  | "users";

export type Tone = "default" | "success" | "warning" | "danger" | "info";
export type SettingsSubmitHandler = (event?: BaseSyntheticEvent) => void | Promise<void>;

export interface SettingsTabMeta {
  id: SettingsTab;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

export interface NormalizedAuthSecuritySummary extends AuthSecuritySummary {
  session?: AuthSecuritySummary["session"] & { enabled?: boolean };
  csrf?: AuthSecuritySummary["csrf"] & { enabled?: boolean };
}

export const CONFIG_TABS = new Set<SettingsTab>(["backend", "llm", "toolchain", "build"]);
export const COMPAT_REMOVED_TEXT = "系统仅保留 /api/v1/*；legacy compat routes: removed";

export function splitLines(value?: string): string[] {
  return (value ?? "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function text(value?: string): string {
  return value?.trim() ?? "";
}

export function roleLabel(role?: "admin" | "user"): string {
  return role === "admin" ? "管理员" : "普通用户";
}

export function yesNo(value?: boolean, unknown = "未确认"): string {
  if (value === true) return "是";
  if (value === false) return "否";
  return unknown;
}

export function enabledDisabled(value?: boolean, unknown = "未确认"): string {
  if (value === true) return "已启用";
  if (value === false) return "已关闭";
  return unknown;
}

export function passwordSourceLabel(value?: "env" | "default"): string {
  if (value === "env") return "环境变量";
  if (value === "default") return "默认密码";
  return "未确认";
}

export function safeText(value: unknown, fallback = "未设置"): string {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return fallback;
}

export function formatSeconds(value?: number): string {
  return typeof value === "number" ? `${value}s` : "未设置";
}

export function formatDateTime(value?: string): string {
  if (!value) return "未记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

export function isSettingsTab(value: string | null, tabs: SettingsTabMeta[]): value is SettingsTab {
  return tabs.some((item) => item.id === value);
}

export function configToForm(config?: AppConfigResponse): SettingsFormValues {
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

export function buildPatch(values: SettingsFormValues): ConfigPatchRequest {
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

export function toolchainSummaryValue(item?: ToolchainItemSummary): string {
  if (item?.status === "available") return "有效";
  if (item?.status === "missing") return "无效";
  return "未配置";
}

export function toolchainSummaryTone(item?: ToolchainItemSummary): Tone {
  if (item?.status === "available") return "success";
  if (item?.status === "missing") return "warning";
  return "default";
}

export function toolchainResolutionLabel(item?: ToolchainItemSummary): string {
  if (item?.resolution === "configured_path") return "显式配置";
  if (item?.resolution === "path_lookup") return "PATH 解析";
  return "未配置";
}

export function countAvailableTools(summary: Record<string, ToolchainItemSummary>): number {
  return Object.values(summary).filter((item) => item?.status === "available").length;
}

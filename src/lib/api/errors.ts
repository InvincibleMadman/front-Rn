export type ApiErrorKind =
  | "network_error"
  | "timeout"
  | "cors_or_preflight"
  | "http_error"
  | "envelope_error"
  | "backend_error"
  | "validation_error"
  | "websocket_error"
  | "unknown";

export interface ApiErrorPayload {
  kind: ApiErrorKind;
  message: string;
  method?: string;
  url?: string;
  status?: number;
  statusText?: string;
  requestId?: string;
  operationId?: string;
  requestBody?: unknown;
  responseBody?: unknown;
  detail?: unknown;
  cause?: unknown;
  hint?: string;
  timestamp: string;
}

export class ApiError extends Error {
  public readonly payload: ApiErrorPayload;

  constructor(payload: ApiErrorPayload) {
    super(payload.message);
    this.name = "ApiError";
    this.payload = payload;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringifyCause(cause: unknown): unknown {
  if (cause instanceof Error) return { name: cause.name, message: cause.message, stack: cause.stack };
  return cause;
}

function stringifyDetailValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value;
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => {
        if (!isRecord(item)) return typeof item === "string" ? item : JSON.stringify(item);
        const loc = Array.isArray(item.loc) ? item.loc.join(".") : undefined;
        const msg = typeof item.msg === "string" ? item.msg : undefined;
        const type = typeof item.type === "string" ? item.type : undefined;
        return [loc, msg, type].filter(Boolean).join(": ") || JSON.stringify(item);
      })
      .filter(Boolean);
    return parts.length ? parts.join("; ") : undefined;
  }
  if (isRecord(value)) {
    if (typeof value.msg === "string" && value.msg.trim()) return value.msg;
    if (typeof value.message === "string" && value.message.trim()) return value.message;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return undefined;
}

export function getPayloadString(payload: unknown, keys: string[]): string | undefined {
  if (!isRecord(payload)) return undefined;
  for (const key of keys) {
    const text = stringifyDetailValue(payload[key]);
    if (text) return text;
  }
  return undefined;
}

export function getPayloadUnknown(payload: unknown, keys: string[]): unknown {
  if (!isRecord(payload)) return undefined;
  for (const key of keys) {
    if (key in payload) return payload[key];
  }
  return undefined;
}

export function makeApiError(input: {
  kind: ApiErrorKind;
  message: string;
  method?: string;
  url?: string;
  status?: number;
  statusText?: string;
  requestBody?: unknown;
  responseBody?: unknown;
  detail?: unknown;
  cause?: unknown;
  hint?: string;
  operationId?: string;
  requestId?: string;
}): ApiError {
  const responseBody = input.responseBody;
  const requestId =
    input.requestId ??
    getPayloadString(responseBody, ["request_id", "requestId", "x-request-id"]);
  const operationId =
    input.operationId ??
    getPayloadString(responseBody, ["operation_id", "operationId"]);

  return new ApiError({
    kind: input.kind,
    message: input.message,
    method: input.method,
    url: input.url,
    status: input.status,
    statusText: input.statusText,
    requestId,
    operationId,
    requestBody: input.requestBody,
    responseBody,
    detail: input.detail ?? getPayloadUnknown(responseBody, ["detail", "message", "errors"]),
    cause: stringifyCause(input.cause),
    hint: input.hint,
    timestamp: new Date().toISOString(),
  });
}

export function normalizeApiError(error: unknown, fallback = "请求失败"): ApiErrorPayload {
  if (error instanceof ApiError) return error.payload;
  if (isRecord(error) && typeof error.kind === "string" && typeof error.message === "string") {
    const timestamp = typeof error.timestamp === "string" ? error.timestamp : new Date().toISOString();
    return {
      ...(error as unknown as Omit<ApiErrorPayload, "timestamp">),
      timestamp,
    };
  }
  if (error instanceof Error) {
    const message = error.message || fallback;
    const kind: ApiErrorKind = /timeout|aborted/i.test(message) ? "timeout" : /failed to fetch|network/i.test(message) ? "network_error" : "unknown";
    return {
      kind,
      message,
      cause: { name: error.name, message: error.message, stack: error.stack },
      hint: kind === "network_error" ? networkCorsHint : undefined,
      timestamp: new Date().toISOString(),
    };
  }
  return { kind: "unknown", message: fallback, detail: error, timestamp: new Date().toISOString() };
}

export const networkCorsHint =
  "检查后端是否启动、API Base URL 是否正确、后端 server.host 是否为 0.0.0.0、config.yaml 的 server.cors.allow_origins 是否包含当前前端 Origin、虚拟机端口映射/防火墙是否放行，以及 Vite 是否使用 --host 0.0.0.0 对外监听。";

export function hintForStatus(status?: number): string | undefined {
  if (status === 404) return "资源不存在。请检查请求 URL、job_id/artifact_id/session_id，以及路径是否是后端机器可访问的真实路径。";
  if (status === 422) return "请求字段未通过后端校验。请检查路径字段是否是后端机器上的路径，以及 target_cmd、cwd、output_dir 等字段格式。";
  if (status && status >= 500) return "后端内部错误，请查看 operation logs 或后端终端输出。";
  return undefined;
}

export function formatApiError(error: ApiErrorPayload | unknown): string {
  const payload = normalizeApiError(error);
  return JSON.stringify(payload, null, 2);
}

export function toApiErrorPayload(error: unknown): ApiErrorPayload {
  return normalizeApiError(error);
}

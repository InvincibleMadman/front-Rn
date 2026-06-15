export type ApiErrorKind =
  | "node_not_selected"
  | "bff_unreachable"
  | "backend_unreachable"
  | "timeout"
  | "http_error"
  | "response_shape_error"
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
  path?: string;
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
  path?: string;
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
    path: input.path,
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

export function normalizeApiError(error: unknown, fallback = "Request failed"): ApiErrorPayload {
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
    const lower = message.toLowerCase();
    const kind: ApiErrorKind =
      /timeout|aborted/i.test(message)
        ? "timeout"
        : lower.includes("node is not selected") || lower.includes("select a backend node")
          ? "node_not_selected"
          : /failed to fetch|network|load failed/i.test(message)
            ? "bff_unreachable"
            : lower.includes("response shape")
              ? "response_shape_error"
              : "unknown";

    return {
      kind,
      message,
      cause: { name: error.name, message: error.message, stack: error.stack },
      hint: kind === "bff_unreachable" ? networkCorsHint : undefined,
      timestamp: new Date().toISOString(),
    };
  }

  return { kind: "unknown", message: fallback, detail: error, timestamp: new Date().toISOString() };
}

export const networkCorsHint =
  "Check that the Web BFF is reachable, the selected backend node is online, and the browser is requesting the BFF proxy path instead of a direct backend URL.";

export function hintForStatus(status?: number): string | undefined {
  if (status === 404) return "The requested API path or resource was not found on the selected backend node.";
  if (status === 422) return "The backend rejected request fields. Check the submitted payload and required parameters.";
  if (status && status >= 500) return "The backend node returned an internal error. Inspect operation logs or backend console output.";
  return undefined;
}

export function formatApiError(error: ApiErrorPayload | unknown): string {
  const payload = normalizeApiError(error);
  return JSON.stringify(payload, null, 2);
}

export function toApiErrorPayload(error: unknown): ApiErrorPayload {
  return normalizeApiError(error);
}

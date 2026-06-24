import { normalizeApiEnvelope, type ApiEnvelope } from "@/types/api/envelope";
import { makeApiError, networkCorsHint, hintForStatus, getPayloadString, isRecord } from "@/lib/api/errors";
import { resolveApiUrl, getSelectedNodeId } from "@/lib/api/url";
import { useAuthStore } from "@/stores/auth-store";

export class ApiClientError extends Error {
  public readonly status?: number;
  public readonly payload?: unknown;

  constructor(message: string, status?: number, payload?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.payload = payload;
  }
}

type RequestOptions = RequestInit & {
  timeoutMs?: number;
  operationId?: string;
  rawUrl?: string;
};

function methodOf(options?: RequestOptions): string {
  return (options?.method ?? "GET").toUpperCase();
}

function serializeRequestBody(body: BodyInit | null | undefined): unknown {
  if (!body) return undefined;
  if (body instanceof FormData) {
    return { formData: Array.from(body.keys()) };
  }
  if (typeof body === "string") {
    try {
      return JSON.parse(body) as unknown;
    } catch {
      return body;
    }
  }
  return "[non-json body]";
}

async function parseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (response.status === 204) return null;
  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch (cause) {
      throw makeApiError({
        kind: "response_shape_error",
        message: "Response declared JSON but could not be parsed.",
        status: response.status,
        statusText: response.statusText,
        detail: cause,
      });
    }
  }
  return response.text();
}

function buildHeaders(path: string, options?: RequestOptions): HeadersInit {
  const headers = new Headers(options?.headers ?? {});
  const method = methodOf(options);
  const body = options?.body;
  const shouldSetJsonContentType =
    body !== undefined &&
    body !== null &&
    !(body instanceof FormData) &&
    method !== "GET" &&
    method !== "HEAD" &&
    !headers.has("Content-Type");

  if (shouldSetJsonContentType) headers.set("Content-Type", "application/json");
  if (options?.operationId && !headers.has("X-Operation-Id")) headers.set("X-Operation-Id", options.operationId);

  const selectedNodeId = getSelectedNodeId();
  if (selectedNodeId && !headers.has("X-Selected-Node-Id")) {
    headers.set("X-Selected-Node-Id", selectedNodeId);
  }

  if (!["GET", "HEAD", "OPTIONS"].includes(method) && !headers.has("X-CSRF-Token")) {
    const csrfToken = useAuthStore.getState().csrfToken;
    if (csrfToken) headers.set("X-CSRF-Token", csrfToken);
  }
  return headers;
}

function buildUrl(path: string, options?: RequestOptions): string {
  return options?.rawUrl ?? resolveApiUrl(path);
}

function extractMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "string" && payload.trim()) return payload;
  const message = getPayloadString(payload, ["detail", "message", "msg", "error"]);
  return message ?? fallback;
}

function isNodeApiPath(path: string): boolean {
  return path.startsWith("/api/v1") || path.includes("/node-api/");
}

function classifyHttpError(path: string, payload: unknown, status: number): "http_error" | "backend_unreachable" {
  if (isNodeApiPath(path) && status >= 502) {
    const detailText = extractMessage(payload, "").toLowerCase();
    if (
      detailText.includes("connect") ||
      detailText.includes("connection refused") ||
      detailText.includes("upstream") ||
      detailText.includes("backend") ||
      detailText.includes("timed out")
    ) {
      return "backend_unreachable";
    }
  }
  return "http_error";
}

function normalizeSuccessfulEnvelope<T>(payload: unknown): ApiEnvelope<T> {
  const envelope = normalizeApiEnvelope<T>(payload);
  if (envelope) {
    return {
      ok: envelope.ok,
      message: envelope.message,
      data: envelope.data,
    };
  }

  if (isRecord(payload)) {
    return {
      ok: true,
      message: "",
      data: payload as T,
      request_id: getPayloadString(payload, ["request_id", "requestId", "x-request-id"]),
      operation_id: getPayloadString(payload, ["operation_id", "operationId"]),
    };
  }

  if (Array.isArray(payload) || payload === null || typeof payload === "string" || typeof payload === "number" || typeof payload === "boolean") {
    return {
      ok: true,
      message: "",
      data: payload as T,
    };
  }

  throw makeApiError({
    kind: "response_shape_error",
    message: "Response shape is not a supported API envelope or direct JSON payload.",
    responseBody: payload,
    hint: "Supported responses are { ok, message, data }, { is_success, msg, data }, or a direct FastAPI JSON object/array.",
  });
}

async function doFetch(path: string, options?: RequestOptions): Promise<{ response: Response; payload: unknown; url: string; method: string }> {
  const timeoutMs = options?.timeoutMs ?? 0;
  const controller = timeoutMs > 0 ? new AbortController() : undefined;
  const method = methodOf(options);

  if (path.startsWith("/api/v1") && !getSelectedNodeId()) {
    throw makeApiError({
      kind: "node_not_selected",
      message: "Backend node is not selected. Select a backend node before sending /api/v1 requests.",
      method,
      path,
      requestBody: serializeRequestBody(options?.body),
      operationId: options?.operationId,
      hint: "Choose a node from the topbar node selector, then retry.",
    });
  }

  const url = buildUrl(path, options);
  const timeoutId = timeoutMs > 0
    ? window.setTimeout(() => controller?.abort("frontend-timeout"), timeoutMs)
    : undefined;

  try {
    const response = await fetch(url, {
      ...options,
      credentials: options?.credentials ?? "include",
      signal: controller?.signal ?? options?.signal,
      headers: buildHeaders(path, options),
    });
    const payload = await parseBody(response);
    return { response, payload, url, method };
  } catch (cause) {
    if (cause instanceof Error && cause.name === "ApiError") throw cause;

    const isAbort = cause instanceof DOMException && cause.name === "AbortError";
    const causeMessage = cause instanceof Error ? cause.message : String(cause);
    const kind = isAbort || /frontend-timeout|timeout/i.test(causeMessage)
      ? "timeout"
      : "bff_unreachable";

    throw makeApiError({
      kind,
      message: kind === "timeout"
        ? `${method} ${path} timed out on the frontend.`
        : `${method} ${path} could not reach the Web BFF.`,
      method,
      url,
      path,
      requestBody: serializeRequestBody(options?.body),
      cause,
      operationId: options?.operationId,
      hint: kind === "timeout"
        ? "The frontend timeout expired before a response arrived. Retry or increase the timeout for long-running calls."
        : networkCorsHint,
    });
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
}

export const apiClient = {
  async requestEnvelope<T>(path: string, options?: RequestOptions): Promise<ApiEnvelope<T>> {
    const { response, payload, url, method } = await doFetch(path, options);

    if (!response.ok) {
      throw makeApiError({
        kind: classifyHttpError(path, payload, response.status),
        message: extractMessage(payload, `${method} ${path} failed with ${response.status}`),
        method,
        url,
        path,
        status: response.status,
        statusText: response.statusText,
        requestBody: serializeRequestBody(options?.body),
        responseBody: payload,
        operationId: options?.operationId,
        hint: hintForStatus(response.status),
      });
    }

    const envelope = normalizeSuccessfulEnvelope<T>(payload);

    if (envelope.ok !== true) {
      throw makeApiError({
        kind: "http_error",
        message: extractMessage(payload, "Backend returned ok=false."),
        method,
        url,
        path,
        status: response.status,
        statusText: response.statusText,
        requestBody: serializeRequestBody(options?.body),
        responseBody: payload,
        operationId: options?.operationId,
        hint: hintForStatus(response.status),
      });
    }

    return envelope;
  },

  async requestRaw<T>(path: string, options?: RequestOptions): Promise<T> {
    const { response, payload, url, method } = await doFetch(path, options);
    if (!response.ok) {
      throw makeApiError({
        kind: classifyHttpError(path, payload, response.status),
        message: extractMessage(payload, `${method} ${path} failed with ${response.status}`),
        method,
        url,
        path,
        status: response.status,
        statusText: response.statusText,
        requestBody: serializeRequestBody(options?.body),
        responseBody: payload,
        operationId: options?.operationId,
        hint: hintForStatus(response.status),
      });
    }
    return payload as T;
  },
};

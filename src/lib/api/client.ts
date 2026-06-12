import { isApiEnvelope, type ApiEnvelope } from "@/types/api/envelope";
import { resolveApiUrl } from "@/lib/api/url";
import { makeApiError, networkCorsHint, hintForStatus, getPayloadString } from "@/lib/api/errors";
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
        kind: "envelope_error",
        message: "响应声明为 JSON，但解析失败",
        status: response.status,
        statusText: response.statusText,
        detail: cause,
      });
    }
  }
  return response.text();
}

function buildHeaders(options?: RequestOptions): HeadersInit {
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
  const message = getPayloadString(payload, ["detail", "message", "error"]);
  return message ?? fallback;
}

async function doFetch(path: string, options?: RequestOptions): Promise<{ response: Response; payload: unknown; url: string; method: string }> {
  const timeoutMs = options?.timeoutMs ?? 0;
  const controller = timeoutMs > 0 ? new AbortController() : undefined;
  const method = methodOf(options);
  const url = buildUrl(path, options);
  const timeoutId = timeoutMs > 0
    ? window.setTimeout(() => controller?.abort("frontend-timeout"), timeoutMs)
    : undefined;

  try {
    const response = await fetch(url, {
      ...options,
      credentials: options?.credentials ?? "include",
      signal: controller?.signal ?? options?.signal,
      headers: buildHeaders(options),
    });
    const payload = await parseBody(response);
    return { response, payload, url, method };
  } catch (cause) {
    const isAbort = cause instanceof DOMException && cause.name === "AbortError";
    const causeMessage = cause instanceof Error ? cause.message : String(cause);
    const kind = isAbort || /frontend-timeout|timeout/i.test(causeMessage)
      ? "timeout"
      : /failed to fetch|load failed|network/i.test(causeMessage)
        ? "cors_or_preflight"
        : "network_error";

    throw makeApiError({
      kind,
      message: kind === "timeout"
        ? `${method} ${url} 前端等待超时`
        : `${method} ${url} 无法连接后端或被浏览器拦截`,
      method,
      url,
      requestBody: serializeRequestBody(options?.body),
      cause,
      operationId: options?.operationId,
      hint: kind === "timeout"
        ? "该超时来自前端主动 abort。长耗时任务建议不要传 timeoutMs，让后端按自身 timeout_sec 返回 detail。"
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
        kind: "http_error",
        message: extractMessage(payload, `${method} ${url} failed with ${response.status}`),
        method,
        url,
        status: response.status,
        statusText: response.statusText,
        requestBody: serializeRequestBody(options?.body),
        responseBody: payload,
        operationId: options?.operationId,
        hint: hintForStatus(response.status),
      });
    }

    if (!isApiEnvelope<T>(payload)) {
      throw makeApiError({
        kind: "envelope_error",
        message: "响应不是预期的 ApiEnvelope 结构",
        method,
        url,
        status: response.status,
        statusText: response.statusText,
        requestBody: serializeRequestBody(options?.body),
        responseBody: payload,
        operationId: options?.operationId,
        hint: "检查后端新版 /api/v1 接口是否返回 { ok: true, message: string, data: ... }。FastAPI 失败响应应通过 HTTP 非 2xx 和 detail 暴露。",
      });
    }

    if ((payload as ApiEnvelope<unknown>).ok !== true) {
      throw makeApiError({
        kind: "backend_error",
        message: extractMessage(payload, "接口返回 ok=false"),
        method,
        url,
        status: response.status,
        statusText: response.statusText,
        requestBody: serializeRequestBody(options?.body),
        responseBody: payload,
        operationId: options?.operationId,
        hint: hintForStatus(response.status),
      });
    }

    return payload;
  },

  async requestRaw<T>(path: string, options?: RequestOptions): Promise<T> {
    const { response, payload, url, method } = await doFetch(path, options);
    if (!response.ok) {
      throw makeApiError({
        kind: "http_error",
        message: extractMessage(payload, `${method} ${url} failed with ${response.status}`),
        method,
        url,
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

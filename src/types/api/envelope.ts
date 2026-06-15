export interface ApiEnvelope<T> {
  ok: boolean;
  message: string;
  data: T;
  request_id?: string;
  requestId?: string;
  operation_id?: string;
  operationId?: string;
}

export interface NormalizedApiEnvelope<T> {
  ok: boolean;
  message: string;
  data: T;
}

export interface ApiErrorShape {
  detail?: unknown;
  message?: string;
  request_id?: string;
  requestId?: string;
  operation_id?: string;
  operationId?: string;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isApiEnvelope<T>(value: unknown): value is ApiEnvelope<T> {
  return normalizeApiEnvelope<T>(value) !== null;
}

export function normalizeApiEnvelope<T>(value: unknown): NormalizedApiEnvelope<T> | null {
  if (!isRecord(value)) return null;

  if (typeof value.ok === "boolean" && "data" in value) {
    return {
      ok: value.ok,
      message: typeof value.message === "string" ? value.message : "",
      data: value.data as T,
    };
  }

  if (typeof value.is_success === "boolean" && "data" in value) {
    return {
      ok: value.is_success,
      message: typeof value.msg === "string"
        ? value.msg
        : typeof value.message === "string"
          ? value.message
          : "",
      data: value.data as T,
    };
  }

  return null;
}

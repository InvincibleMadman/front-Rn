export interface ApiEnvelope<T> {
  ok: boolean;
  message: string;
  data: T;
  request_id?: string;
  requestId?: string;
  operation_id?: string;
  operationId?: string;
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
  if (!isRecord(value)) return false;
  return typeof value.ok === "boolean" && typeof value.message === "string" && "data" in value;
}

export type OperationStatus = "running" | "finished" | "failed" | "unknown" | string;
export type OperationLogLevel = "debug" | "info" | "warning" | "error" | string;

export interface OperationLogItem {
  seq: number;
  operation_id: string;
  at?: string;
  level?: OperationLogLevel;
  stage?: string;
  message?: string;
  data?: Record<string, unknown>;
  kind?: string;
  [key: string]: unknown;
}

export interface OperationLogTail {
  operation_id: string;
  status?: OperationStatus;
  next_seq: number;
  items: OperationLogItem[];
  [key: string]: unknown;
}

export interface OperationRecord {
  operation_id: string;
  status?: OperationStatus;
  created_at?: string;
  updated_at?: string;
  title?: string;
  kind?: string;
  [key: string]: unknown;
}

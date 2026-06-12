export interface ProtocolListResponse {
  protocols?: string[];
  items?: unknown[];
  documents?: unknown[];
  [key: string]: unknown;
}

export interface ProtocolSummaryResponse {
  protocol?: string;
  root?: string;
  [key: string]: unknown;
}
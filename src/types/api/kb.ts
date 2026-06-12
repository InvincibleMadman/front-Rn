import type { KbEntry } from "@/types/api/vuldocs";

export interface KbSummaryResponse {
  protocol: string;
  total: number;
  by_coarse_type?: Record<string, number>;
  by_vuln_type?: Record<string, number>;
  by_cwe?: Record<string, number>;
  top_entries?: KbEntry[];
  [key: string]: unknown;
}

export interface KbGraphNode {
  id: string;
  label?: string;
  type?: string;
  [key: string]: unknown;
}

export interface KbGraphEdge {
  source: string;
  target: string;
  type?: string;
  [key: string]: unknown;
}

export interface KbGraphResponse {
  protocol: string;
  nodes: KbGraphNode[];
  edges: KbGraphEdge[];
  [key: string]: unknown;
}

export interface KbTimelineEvent {
  time?: string;
  kind?: string;
  id?: string;
  title?: string;
  [key: string]: unknown;
}

export interface KbTimelineResponse {
  protocol: string;
  events: KbTimelineEvent[];
  [key: string]: unknown;
}

export interface KbSearchParams {
  coarse_type?: string;
  vuln_type?: string;
  cwe?: string;
  keyword?: string;
  limit?: number;
  offset?: number;
}

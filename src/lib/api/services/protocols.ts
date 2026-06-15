import { apiClient } from "@/lib/api/client";
import { resolveNodeApiPath } from "@/lib/api/url";
import type { ProtocolListResponse, ProtocolSummaryResponse } from "@/types/api/protocols";

type ProtocolListEnvelopeData = ProtocolListResponse | string[] | { items?: unknown[]; documents?: unknown[] };

function nodeApiPath(path: string): string {
  return resolveNodeApiPath(`/api/v1${path}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function arrayFromField(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function normalizeProtocolList(data: ProtocolListEnvelopeData): string[] {
  const record = isRecord(data) ? data as Record<string, unknown> : undefined;
  const raw = Array.isArray(data)
    ? data
    : record
      ? arrayFromField(record.protocols) ?? arrayFromField(record.items) ?? arrayFromField(record.documents) ?? []
      : [];

  return raw
    .map((item) => {
      if (typeof item === "string") return item.trim();

      if (isRecord(item)) {
        return String(item.protocol ?? item.name ?? item.id ?? "").trim();
      }

      return "";
    })
    .filter(Boolean);
}

export const protocolsApi = {
  listProtocols: async (): Promise<string[]> => {
    const response = await apiClient.requestEnvelope<ProtocolListEnvelopeData>(nodeApiPath("/protocols"), {
      credentials: "include",
    });

    return normalizeProtocolList(response.data);
  },

  getProtocolSummary: async (protocol: string): Promise<ProtocolSummaryResponse> => {
    const response = await apiClient.requestEnvelope<ProtocolSummaryResponse>(
      nodeApiPath(`/protocols/${encodeURIComponent(protocol)}/summary`),
      {
        credentials: "include",
      },
    );

    return response.data;
  },
};

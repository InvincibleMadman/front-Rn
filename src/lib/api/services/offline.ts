import { apiClient } from "@/lib/api/client";
import type { InstrumentRequest, InstrumentResponse, ProtocolAnalyzeRequest, ProtocolAnalyzeResponse, RiskAnalyzeRequest, RiskAnalyzeResponse, RiskPreviewRequest, RiskPreviewResponse, RiskUploadResponse, SeedGenerateRequest, SeedGenerateResponse } from "@/types/api/offline";

export const offlineApi = {
  protocolAnalyze: async (payload: ProtocolAnalyzeRequest): Promise<ProtocolAnalyzeResponse> => {
    const response = await apiClient.requestEnvelope<ProtocolAnalyzeResponse>("/api/v1/offline/protocol/analyze", {
      method: "POST",
      body: JSON.stringify(payload),
      operationId: payload.operation_id,
    });
    return response.data;
  },
  generateSeeds: async (payload: SeedGenerateRequest): Promise<SeedGenerateResponse> => {
    const response = await apiClient.requestEnvelope<SeedGenerateResponse>("/api/v1/offline/seeds/generate", {
      method: "POST",
      body: JSON.stringify(payload),
      operationId: payload.operation_id,
    });
    return response.data;
  },
  riskAnalyze: async (payload: RiskAnalyzeRequest): Promise<RiskAnalyzeResponse> => {
    const response = await apiClient.requestEnvelope<RiskAnalyzeResponse>("/api/v1/offline/risk/analyze", {
      method: "POST",
      body: JSON.stringify(payload),
      operationId: payload.operation_id,
    });
    return response.data;
  },
  riskPreview: async (payload: RiskPreviewRequest): Promise<RiskPreviewResponse> => {
    const response = await apiClient.requestEnvelope<RiskPreviewResponse>("/api/v1/offline/risk/preview", {
      method: "POST",
      body: JSON.stringify(payload),
      operationId: payload.operation_id,
    });
    return response.data;
  },
  riskUpload: async ({
    protocol,
    file,
    operation_id,
  }: {
    protocol: string;
    file: File;
    operation_id?: string;
  }): Promise<RiskUploadResponse> => {
    const formData = new FormData();
    formData.append("protocol", protocol);
    if (operation_id) formData.append("operation_id", operation_id);
    formData.append("file", file);
    const response = await apiClient.requestEnvelope<RiskUploadResponse>("/api/v1/offline/risk/upload", {
      method: "POST",
      body: formData,
      operationId: operation_id,
    });
    return response.data;
  },
  instrument: async (payload: InstrumentRequest): Promise<InstrumentResponse> => {
    const response = await apiClient.requestEnvelope<InstrumentResponse>("/api/v1/offline/instrument", {
      method: "POST",
      body: JSON.stringify(payload),
      operationId: payload.operation_id,
    });
    return response.data;
  },
};

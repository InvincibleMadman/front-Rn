import { apiClient } from "@/lib/api/client";
import type { VulDocDistillResponse, VulDocRecord, VulDocUploadResponse } from "@/types/api/vuldocs";

export const vuldocsApi = {
  upload: async (protocol: string, files: File[], operationId?: string): Promise<VulDocUploadResponse> => {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    if (operationId) formData.append("operation_id", operationId);
    const response = await apiClient.requestEnvelope<VulDocUploadResponse>(`/api/v1/protocols/${encodeURIComponent(protocol)}/vuldocs/upload`, {
      method: "POST",
      body: formData,
      operationId,
    });
    return response.data;
  },
  distill: async (protocol: string, body: { operation_id?: string; doc_ids?: string[] }): Promise<VulDocDistillResponse> => {
    const response = await apiClient.requestEnvelope<VulDocDistillResponse>(`/api/v1/protocols/${encodeURIComponent(protocol)}/vuldocs/distill`, {
      method: "POST",
      body: JSON.stringify(body),
      operationId: body.operation_id,
    });
    return response.data;
  },
  list: async (protocol: string): Promise<VulDocRecord[]> => {
    const response = await apiClient.requestEnvelope<{ protocol?: string; items?: VulDocRecord[]; documents?: VulDocRecord[] }>(`/api/v1/protocols/${encodeURIComponent(protocol)}/vuldocs`);
    return response.data.documents?.length ? response.data.documents : response.data.items ?? [];
  },
  get: async (protocol: string, docId: string): Promise<VulDocRecord> => {
    const response = await apiClient.requestEnvelope<VulDocRecord>(`/api/v1/protocols/${encodeURIComponent(protocol)}/vuldocs/${encodeURIComponent(docId)}`);
    return response.data;
  },
};

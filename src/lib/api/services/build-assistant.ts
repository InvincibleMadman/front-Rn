import { apiClient } from "@/lib/api/client";
import { resolveNodeApiPath } from "@/lib/api/url";
import { useAuthStore } from "@/stores/auth-store";
import type { BuildPlan, BuildPlanCreatePayload, BuildProbe, BuildRun, LaunchProfile, TargetCandidate } from "@/types/api/build-assistant";

function nodeApiPath(path: string): string {
  return resolveNodeApiPath(`/api/v1${path}`);
}

function csrfHeaders(): HeadersInit {
  const csrfToken = useAuthStore.getState().csrfToken;
  return csrfToken ? { "X-CSRF-Token": csrfToken } : {};
}

export const buildAssistantApi = {
  async probe(protocol: string): Promise<BuildProbe> {
    const response = await apiClient.requestEnvelope<BuildProbe>(nodeApiPath(`/protocols/${encodeURIComponent(protocol)}/build/probe`), {
      credentials: "include",
    });
    return response.data;
  },

  async createPlan(protocol: string, payload: BuildPlanCreatePayload | Record<string, unknown>, operationId?: string): Promise<BuildPlan> {
    const response = await apiClient.requestEnvelope<BuildPlan>(nodeApiPath(`/protocols/${encodeURIComponent(protocol)}/build/plans`), {
      method: "POST",
      credentials: "include",
      headers: csrfHeaders(),
      body: JSON.stringify(payload),
      operationId,
    });
    return response.data;
  },

  async listPlans(protocol: string): Promise<BuildPlan[]> {
    const response = await apiClient.requestEnvelope<{ items: BuildPlan[] }>(nodeApiPath(`/protocols/${encodeURIComponent(protocol)}/build/plans`), {
      credentials: "include",
    });
    return response.data.items ?? [];
  },

  async dryRunPlan(protocol: string, planId: string): Promise<Record<string, unknown>> {
    const response = await apiClient.requestEnvelope<Record<string, unknown>>(nodeApiPath(`/protocols/${encodeURIComponent(protocol)}/build/plans/${encodeURIComponent(planId)}/dry-run`), {
      method: "POST",
      credentials: "include",
      headers: csrfHeaders(),
      body: JSON.stringify({}),
    });
    return response.data;
  },

  async runPlan(protocol: string, planId: string, operationId?: string): Promise<BuildRun> {
    const response = await apiClient.requestEnvelope<BuildRun>(nodeApiPath(`/protocols/${encodeURIComponent(protocol)}/build/plans/${encodeURIComponent(planId)}/run`), {
      method: "POST",
      credentials: "include",
      headers: csrfHeaders(),
      body: JSON.stringify({}),
      operationId,
    });
    return response.data;
  },

  async listRuns(protocol: string): Promise<BuildRun[]> {
    const response = await apiClient.requestEnvelope<{ items: BuildRun[] }>(nodeApiPath(`/protocols/${encodeURIComponent(protocol)}/build/runs`), {
      credentials: "include",
    });
    return response.data.items ?? [];
  },

  async getRun(protocol: string, buildId: string): Promise<BuildRun> {
    const response = await apiClient.requestEnvelope<BuildRun>(nodeApiPath(`/protocols/${encodeURIComponent(protocol)}/build/runs/${encodeURIComponent(buildId)}`), {
      credentials: "include",
    });
    return response.data;
  },

  async listTargets(protocol: string): Promise<TargetCandidate[]> {
    const response = await apiClient.requestEnvelope<{ items: TargetCandidate[] }>(nodeApiPath(`/protocols/${encodeURIComponent(protocol)}/build/targets`), {
      credentials: "include",
    });
    return response.data.items ?? [];
  },

  async predictLaunchProfile(protocol: string, payload: Record<string, unknown>, operationId?: string): Promise<LaunchProfile> {
    const response = await apiClient.requestEnvelope<LaunchProfile>(nodeApiPath(`/protocols/${encodeURIComponent(protocol)}/fuzz/launch-profiles/predict`), {
      method: "POST",
      credentials: "include",
      headers: csrfHeaders(),
      body: JSON.stringify(payload),
      operationId,
    });
    return response.data;
  },

  async listLaunchProfiles(protocol: string): Promise<LaunchProfile[]> {
    const response = await apiClient.requestEnvelope<{ items: LaunchProfile[] }>(nodeApiPath(`/protocols/${encodeURIComponent(protocol)}/fuzz/launch-profiles`), {
      credentials: "include",
    });
    return response.data.items ?? [];
  },
};

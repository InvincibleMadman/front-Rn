import { apiClient } from "@/lib/api/client";
import { useAuthStore, type AuthUser } from "@/stores/auth-store";
import type { AuthSecuritySummary, ChangePasswordRequest, ChangePasswordResponse } from "@/types/api/auth";

export const authApi = {
  async getCsrfToken(): Promise<string> {
    const response = await apiClient.requestEnvelope<{ csrf_token: string }>("/web-api/csrf", {
      credentials: "include",
    });
    useAuthStore.getState().setCsrfToken(response.data.csrf_token);
    return response.data.csrf_token;
  },

  async login(username: string, password: string): Promise<AuthUser> {
    const csrfToken = useAuthStore.getState().csrfToken || await authApi.getCsrfToken();
    const response = await apiClient.requestEnvelope<{ user: AuthUser }>("/web-api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "X-CSRF-Token": csrfToken },
      body: JSON.stringify({ username, password }),
    });
    useAuthStore.getState().setUser(response.data.user);
    return response.data.user;
  },

  async logout(): Promise<void> {
    const csrfToken = useAuthStore.getState().csrfToken || await authApi.getCsrfToken();
    await apiClient.requestEnvelope<null>("/web-api/auth/logout", {
      method: "POST",
      credentials: "include",
      headers: { "X-CSRF-Token": csrfToken },
    });
    useAuthStore.getState().setCsrfToken("");
    useAuthStore.getState().setUser(null);
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<AuthUser> {
    const csrfToken = useAuthStore.getState().csrfToken || await authApi.getCsrfToken();
    const body: ChangePasswordRequest = {
      current_password: currentPassword,
      new_password: newPassword,
    };
    const response = await apiClient.requestEnvelope<ChangePasswordResponse>("/web-api/auth/change-password", {
      method: "POST",
      credentials: "include",
      headers: { "X-CSRF-Token": csrfToken },
      body: JSON.stringify(body),
    });
    useAuthStore.getState().setUser(response.data.user);
    return response.data.user;
  },

  async getSecuritySummary(): Promise<AuthSecuritySummary> {
    const response = await apiClient.requestEnvelope<AuthSecuritySummary>("/web-api/auth/security-summary", {
      credentials: "include",
    });
    return response.data;
  },

  async me(): Promise<AuthUser | null> {
    try {
      const response = await apiClient.requestEnvelope<{ user: AuthUser }>("/web-api/auth/me", {
        credentials: "include",
      });
      useAuthStore.getState().setUser(response.data.user);
      return response.data.user;
    } catch {
      useAuthStore.getState().setUser(null);
      return null;
    } finally {
      useAuthStore.getState().setHydrated(true);
    }
  },
};

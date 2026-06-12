import { apiClient } from "@/lib/api/client";
import { useAuthStore, type AuthUser } from "@/stores/auth-store";

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
    useAuthStore.getState().setUser(null);
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

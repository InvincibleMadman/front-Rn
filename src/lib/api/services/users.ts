import { apiClient } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";
import type { CreateUserRequest, CreateUserResponse, ListUsersResponse, ManagedUser } from "@/types/api/users";

function csrfHeaders(): HeadersInit {
  const csrfToken = useAuthStore.getState().csrfToken;
  return csrfToken ? { "X-CSRF-Token": csrfToken } : {};
}

export const usersApi = {
  async list(): Promise<ManagedUser[]> {
    const response = await apiClient.requestEnvelope<ListUsersResponse>("/web-api/users", {
      credentials: "include",
    });
    return response.data.items;
  },

  async create(body: CreateUserRequest): Promise<ManagedUser> {
    const response = await apiClient.requestEnvelope<CreateUserResponse>("/web-api/users", {
      method: "POST",
      credentials: "include",
      headers: csrfHeaders(),
      body: JSON.stringify(body),
    });
    return response.data.user;
  },

  async remove(username: string): Promise<void> {
    await apiClient.requestEnvelope<null>(`/web-api/users/${encodeURIComponent(username)}`, {
      method: "DELETE",
      credentials: "include",
      headers: csrfHeaders(),
    });
  },
};

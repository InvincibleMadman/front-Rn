import { create } from "zustand";

export interface AuthUser {
  user_id: string;
  username: string;
  role: "admin" | "user";
}

interface AuthState {
  user: AuthUser | null;
  csrfToken: string;
  hydrated: boolean;
  setUser: (user: AuthUser | null) => void;
  setCsrfToken: (token: string) => void;
  setHydrated: (hydrated: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  csrfToken: "",
  hydrated: false,
  setUser: (user) => set({ user }),
  setCsrfToken: (csrfToken) => set({ csrfToken }),
  setHydrated: (hydrated) => set({ hydrated }),
}));

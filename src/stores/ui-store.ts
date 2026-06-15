import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ApiNode } from "@/types/api/nodes";

export type ThemeMode = "light" | "dark";

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

interface UiState {
  apiBaseUrl: string;
  selectedApiNodeId: string;
  apiNodes: ApiNode[];
  theme: ThemeMode;
  sidebarCollapsed: boolean;
  offlineNavExpanded: boolean;
  setApiBaseUrl: (url: string) => void;
  setSelectedApiNode: (node: ApiNode) => void;
  setSelectedApiNodeId: (id: string) => void;
  setApiNodes: (nodes: ApiNode[]) => void;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setOfflineNavExpanded: (expanded: boolean) => void;
  toggleOfflineNavExpanded: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      apiBaseUrl: "",
      selectedApiNodeId: "",
      apiNodes: [],
      theme: "light",
      sidebarCollapsed: false,
      offlineNavExpanded: true,
      setApiBaseUrl: (apiBaseUrl) => set({ apiBaseUrl: normalizeBaseUrl(apiBaseUrl) }),
      setSelectedApiNode: (node) => set({ selectedApiNodeId: node.id }),
      setSelectedApiNodeId: (selectedApiNodeId) => set({ selectedApiNodeId }),
      setApiNodes: (apiNodes) => set({ apiNodes }),
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set({ theme: get().theme === "dark" ? "light" : "dark" }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      toggleSidebarCollapsed: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
      setOfflineNavExpanded: (offlineNavExpanded) => set({ offlineNavExpanded }),
      toggleOfflineNavExpanded: () => set({ offlineNavExpanded: !get().offlineNavExpanded }),
    }),
    {
      name: "fuzz-core-ui",
      version: 3,
      migrate: (persistedState) => {
        if (!persistedState || typeof persistedState !== "object") return persistedState;
        const record = persistedState as Record<string, unknown>;
        const selectedApiNodeId =
          typeof record.selectedApiNodeId === "string" && record.selectedApiNodeId !== "local"
            ? record.selectedApiNodeId
            : "";
        return {
          ...record,
          apiBaseUrl: "",
          selectedApiNodeId,
        };
      },
      partialize: (state) => ({
        apiBaseUrl: state.apiBaseUrl,
        selectedApiNodeId: state.selectedApiNodeId,
        apiNodes: state.apiNodes,
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
        offlineNavExpanded: state.offlineNavExpanded,
      }),
    },
  ),
);

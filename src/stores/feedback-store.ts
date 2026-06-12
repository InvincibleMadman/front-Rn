import { create } from "zustand";
import type { ApiErrorPayload } from "@/lib/api/errors";

export interface FeedbackEntry {
  id: string;
  title: string;
  error: ApiErrorPayload;
  createdAt: string;
  source?: string;
}

interface FeedbackState {
  entries: FeedbackEntry[];
  activeId?: string;
  pushError: (entry: Omit<FeedbackEntry, "id" | "createdAt">) => void;
  dismiss: (id: string) => void;
  clear: () => void;
  openDetail: (id: string) => void;
  closeDetail: () => void;
}

export const useFeedbackStore = create<FeedbackState>((set) => ({
  entries: [],
  activeId: undefined,
  pushError: (entry) =>
    set((state) => {
      const id = `feedback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const next = [
        ...state.entries,
        {
          ...entry,
          id,
          createdAt: new Date().toISOString(),
        },
      ].slice(-12);
      return {
        entries: next,
        activeId: state.activeId,
      };
    }),
  dismiss: (id) =>
    set((state) => ({
      entries: state.entries.filter((entry) => entry.id !== id),
      activeId: state.activeId === id ? undefined : state.activeId,
    })),
  clear: () => set({ entries: [], activeId: undefined }),
  openDetail: (id) => set({ activeId: id }),
  closeDetail: () => set({ activeId: undefined }),
}));

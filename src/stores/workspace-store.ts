import { create } from "zustand";
import { persist } from "zustand/middleware";

export type WorkspaceReferenceType =
  | "protocol"
  | "seeds"
  | "risk-analysis"
  | "risk-preview"
  | "risk-upload"
  | "instrument"
  | "build-plan"
  | "build-run"
  | "launch-profile";

export interface WorkspaceReference {
  id: string;
  type: WorkspaceReferenceType;
  label: string;
  createdAt: string;
  primaryPath?: string | null;
  relatedPaths?: string[];
  data?: unknown;
}

interface WorkspaceState {
  references: WorkspaceReference[];
  addReference: (reference: Omit<WorkspaceReference, "id" | "createdAt">) => void;
  clearReferences: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      references: [],
      addReference: (reference) =>
        set((state) => ({
          references: [
            {
              ...reference,
              id: `${reference.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              createdAt: new Date().toISOString(),
            },
            ...state.references,
          ].slice(0, 60),
        })),
      clearReferences: () => set({ references: [] }),
    }),
    {
      name: "fuzz-core-workspace-cache",
    },
  ),
);

export function selectWorkspaceReferences(
  references: WorkspaceReference[],
  type: WorkspaceReferenceType,
): WorkspaceReference[] {
  return references.filter((item) => item.type === type);
}

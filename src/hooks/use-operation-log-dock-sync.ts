import { useEffect, useMemo, useRef } from "react";
import { dockLog, type LogLevel } from "@/components/layout/dock";
import { operationsApi } from "@/lib/api/services/operations";
import type { OperationLogItem } from "@/types/api/operations";

interface OperationDockBinding {
  operationId?: string | null;
  source: string;
  label?: string;
  enabled?: boolean;
  kinds?: string[];
}

function toDockLevel(level?: string): LogLevel {
  if (level === "error" || level === "fatal") return "error";
  if (level === "warning" || level === "warn") return "warn";
  if (level === "debug") return "debug";
  if (level === "success" || level === "done" || level === "finished") return "success";
  return "info";
}

function messageFor(binding: OperationDockBinding, item: OperationLogItem): string {
  const prefix = binding.label ? `${binding.label} · ` : "";
  const stage = item.stage ? `[${item.stage}] ` : "";
  return `${prefix}${stage}${item.message ?? "operation update"}`;
}

export function useOperationLogDockSync(
  bindings: OperationDockBinding[],
  pollIntervalMs = 1200,
): void {
  const cursorsRef = useRef<Record<string, number>>({});
  const seenRef = useRef<Record<string, Record<number, true>>>({});

  const activeBindings = useMemo(() => {
    const deduped = new Map<string, OperationDockBinding>();

    bindings.forEach((binding) => {
      if (!binding.operationId || binding.enabled === false) return;
      if (!deduped.has(binding.operationId)) {
        deduped.set(binding.operationId, binding);
      }
    });

    return Array.from(deduped.values());
  }, [bindings]);

  const signature = activeBindings
    .map((binding) => `${binding.source}:${binding.label ?? ""}:${binding.operationId ?? ""}:${(binding.kinds ?? []).join(",")}`)
    .join("|");

  useEffect(() => {
    if (!activeBindings.length) return;

    let cancelled = false;
    let timer: number | undefined;

    const syncBinding = async (binding: OperationDockBinding): Promise<void> => {
      const operationId = binding.operationId;
      if (!operationId) return;

      try {
        const tail = await operationsApi.tailLogs(
          operationId,
          cursorsRef.current[operationId] ?? 0,
          200,
          binding.kinds?.length ? { kinds: binding.kinds } : undefined,
        );

        cursorsRef.current[operationId] =
          typeof tail.next_seq === "number"
            ? tail.next_seq
            : cursorsRef.current[operationId] ?? 0;

        const seen = seenRef.current[operationId] ?? {};
        seenRef.current[operationId] = seen;

        (tail.items ?? []).forEach((item) => {
          const itemKind = String(item.kind ?? "event");
          if (binding.kinds?.length && !binding.kinds.includes(itemKind)) return;
          if (seen[item.seq]) return;
          seen[item.seq] = true;

          dockLog(
            toDockLevel(item.level),
            binding.source,
            messageFor(binding, item),
            {
              ...item,
              operation_id: operationId,
            },
          );
        });
      } catch {
        // Avoid flooding the dock with repeated tail polling failures.
      }
    };

    const tick = async (): Promise<void> => {
      await Promise.all(activeBindings.map((binding) => syncBinding(binding)));
      if (!cancelled) {
        timer = window.setTimeout(() => {
          void tick();
        }, pollIntervalMs);
      }
    };

    void tick();

    return () => {
      cancelled = true;
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, [activeBindings, pollIntervalMs, signature]);
}

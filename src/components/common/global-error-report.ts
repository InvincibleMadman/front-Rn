import { dockLog } from "@/components/layout/dock";
import { normalizeApiError } from "@/lib/api/errors";
import { useFeedbackStore } from "@/stores/feedback-store";

export function reportGlobalError(error: unknown, title = "请求失败", source = "api"): void {
  const payload = normalizeApiError(error, title);
  useFeedbackStore.getState().pushError({
    title,
    error: payload,
    source,
  });
  dockLog("error", source, `${title}: ${payload.message}`, payload);
}

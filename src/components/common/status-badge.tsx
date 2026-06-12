import { Badge } from "@/components/ui/badge";
import type { JobStatus } from "@/types/api/jobs";
import { translateArtifactKind, translateJobStatus } from "@/lib/utils/display";

export function StatusBadge({ status }: { status: string | JobStatus }): JSX.Element {
  const variant =
    status === "running"
      ? "success"
      : status === "failed"
        ? "danger"
        : status === "stopping"
          ? "warning"
          : status === "finished"
            ? "secondary"
            : status === "crash"
              ? "danger"
              : status === "hang"
                ? "warning"
                : "default";

  const label = status === "crash" || status === "hang" ? translateArtifactKind(status) : translateJobStatus(status);

  return <Badge variant={variant}>{label}</Badge>;
}

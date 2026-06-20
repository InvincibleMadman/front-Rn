import { JsonViewer } from "@/components/common/json-viewer";

export function JobPayloadPreview({ payload }: { payload: Record<string, unknown> }): JSX.Element {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border/60 bg-background/65 p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">提交 payload 预览</p>
      <div className="mt-3 rounded-[var(--radius-lg)] border border-border/60 bg-background/80 p-3">
        <JsonViewer data={payload} compact />
      </div>
    </div>
  );
}

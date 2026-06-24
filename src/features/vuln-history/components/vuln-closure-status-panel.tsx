import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { VulnSummary } from "@/types/api/vuln-history";

export function VulnClosureStatusPanel({ summary }: { summary?: VulnSummary }): JSX.Element {
  const closure = summary?.closure_status ?? {};
  const items = [
    { label: "已关联 crash", value: Number(closure.linked_crash ?? summary?.linked_crash ?? 0) },
    { label: "已关联 debug", value: Number(closure.linked_debug ?? summary?.linked_debug ?? 0) },
    { label: "已归档", value: Number(closure.archived ?? summary?.archived ?? 0) },
    { label: "缺 GDB", value: Number(closure.missing_debug ?? 0) },
    { label: "缺 artifact", value: Number(closure.missing_artifact ?? 0) },
  ];
  const total = Math.max(summary?.total ?? 0, 1);
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">闭环状态区</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div key={item.label} className="space-y-2">
            <div className="flex items-center justify-between text-sm"><span>{item.label}</span><span className="text-muted-foreground">{item.value}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-muted/70"><div className="h-full rounded-full bg-foreground/80" style={{ width: `${Math.min(100, Math.round((item.value / total) * 100))}%` }} /></div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

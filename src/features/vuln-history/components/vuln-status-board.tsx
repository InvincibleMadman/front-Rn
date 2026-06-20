import { Archive, Bug, Link2, Microscope, ShieldAlert, Unlink2 } from "lucide-react";
import type { VulnSummary } from "@/types/api/vuln-history";

function Row({ icon: Icon, label, value, percent }: { icon: typeof Bug; label: string; value: string; percent: number }): JSX.Element {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[var(--radius-lg)] border border-border/60 bg-card px-3 py-2.5">
      <span className="inline-flex size-8 items-center justify-center rounded-[var(--radius-md)] bg-danger/10 text-danger"><Icon className="size-4" /></span>
      <div>
        <p className="text-sm font-medium">{label}</p>
        <div className="mt-2 h-1.5 rounded-full bg-muted/80"><div className="h-1.5 rounded-full bg-danger" style={{ width: `${Math.max(8, Math.min(100, percent))}%` }} /></div>
      </div>
      <p className="text-lg font-semibold tabular-nums text-danger">{value}</p>
    </div>
  );
}

export function VulnStatusBoard({ summary }: { summary?: VulnSummary }): JSX.Element {
  const total = Math.max(summary?.total ?? 0, 1);
  const rows = [
    { icon: ShieldAlert, label: "Open findings", value: String(summary?.open_findings ?? 0), percent: ((summary?.open_findings ?? 0) / total) * 100 },
    { icon: Microscope, label: "High confidence", value: String(summary?.high_confidence ?? 0), percent: ((summary?.high_confidence ?? 0) / total) * 100 },
    { icon: Link2, label: "Linked to GDB", value: String(summary?.linked_debug ?? 0), percent: ((summary?.linked_debug ?? 0) / total) * 100 },
    { icon: Bug, label: "Linked to Crash", value: String(summary?.linked_crash ?? 0), percent: ((summary?.linked_crash ?? 0) / total) * 100 },
    { icon: Unlink2, label: "Unlinked records", value: String(summary?.unlinked_records ?? 0), percent: ((summary?.unlinked_records ?? 0) / total) * 100 },
    { icon: Archive, label: "Archived", value: String(summary?.archived ?? 0), percent: ((summary?.archived ?? 0) / total) * 100 },
  ];
  return <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{rows.map((row) => <Row key={row.label} {...row} />)}</div>;
}

import { BarChart } from "@/components/charts/bar-chart";

export function ReportAssetBreakdownChart({ counts }: { counts: Record<string, number> }): JSX.Element {
  const entries = Object.entries(counts).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]);
  return <BarChart title="资产构成" labels={entries.map(([name]) => name)} values={entries.map(([, value]) => value)} height={260} />;
}

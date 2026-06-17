import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface SettingsCapabilityItem {
  id: string;
  label: string;
  description: string;
  status: "ready" | "partial" | "unavailable";
}

export function SettingsCapabilityGrid({
  items,
}: {
  items: SettingsCapabilityItem[];
}): JSX.Element {
  return (
    <div className="settings-hero-panel space-y-4">
      <CardHeader className="space-y-2 p-0">
        <CardTitle className="text-base">Capabilities matrix</CardTitle>
        <CardDescription>仅显示真实能力状态，不把矩阵做成告警区。</CardDescription>
      </CardHeader>

      <div className="settings-hero-matrix">
        {items.map((item) => (
          <div key={item.id} className="settings-hero-matrix__tile" data-status={item.status}>
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 text-sm font-semibold text-foreground">{item.label}</p>
              <span className="settings-hero-matrix__badge">{item.status}</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

import { DebugMonitorContext } from "@/features/debug/components/debug-monitor-context";
import { DebugMonitorPlanFlow } from "@/features/debug/components/debug-monitor-plan-flow";
import { DebugMonitorSource } from "@/features/debug/components/debug-monitor-source";
import { DebugMonitorOutput } from "@/features/debug/components/debug-monitor-output";
import { DebugMonitorDetails } from "@/features/debug/components/debug-monitor-details";
import { DebugMonitorRuntime } from "@/features/debug/components/debug-monitor-runtime";
import type { MonitorViewModel } from "@/features/debug/debug-types";

export function DebugMonitorShell({
  viewModel,
  previewExcerpt,
}: {
  viewModel: MonitorViewModel;
  previewExcerpt?: MonitorViewModel["source"]["excerpt"];
}): JSX.Element {
  return (
    <div className="grid gap-3 xl:grid-cols-[17.5rem_minmax(0,1.38fr)_22.5rem] 2xl:grid-cols-[18rem_minmax(0,1.5fr)_24rem] xl:items-start">
      <div className="min-h-full">
        <DebugMonitorContext context={viewModel.context} workspaceRef={viewModel.source.workspaceRef} />
      </div>

      <div className="grid min-h-full gap-3 [grid-template-rows:auto_auto_minmax(0,1fr)]">
        <DebugMonitorPlanFlow items={viewModel.planFlow} />
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:items-start">
          <DebugMonitorRuntime details={viewModel.details} variant="stack" />
          <DebugMonitorRuntime details={viewModel.details} variant="inspect" />
        </div>
        <DebugMonitorOutput output={viewModel.output} />
      </div>

      <div className="grid min-h-full gap-3 [grid-template-rows:auto_minmax(0,1fr)]">
        <DebugMonitorSource
          source={viewModel.source}
          previewExcerpt={previewExcerpt}
          focusFrame={viewModel.details.focusFrame}
          focusSummary={viewModel.details.focusSummary}
        />
        <DebugMonitorDetails details={viewModel.details} />
      </div>
    </div>
  );
}

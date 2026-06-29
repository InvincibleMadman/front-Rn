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
    <div className="grid gap-3 xl:grid-cols-[18rem_minmax(0,1.5fr)_23rem] 2xl:grid-cols-[19rem_minmax(0,1.6fr)_24rem] xl:items-start">
      <div className="grid min-h-full gap-3">
        <DebugMonitorContext context={viewModel.context} workspaceRef={viewModel.source.workspaceRef} />
        <DebugMonitorPlanFlow items={viewModel.planFlow} />
      </div>

      <div className="grid min-h-full gap-3 [grid-template-rows:auto_auto_auto]">
        <DebugMonitorRuntime details={viewModel.details} variant="stack" />
        <DebugMonitorSource
          source={viewModel.source}
          previewExcerpt={previewExcerpt}
          focusFrame={viewModel.details.focusFrame}
          focusSummary={viewModel.details.focusSummary}
        />
        <DebugMonitorOutput output={viewModel.output} />
      </div>

      <div className="grid min-h-full gap-3">
        <DebugMonitorDetails details={viewModel.details} />
      </div>
    </div>
  );
}

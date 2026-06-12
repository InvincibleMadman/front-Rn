import { use as useEcharts, getInstanceByDom, type EChartsCoreOption } from "echarts/core";
import { GraphChart } from "echarts/charts";
import { useEffect, useRef } from "react";
import { EchartsBase } from "@/components/charts/echarts-base";
import { cn } from "@/lib/utils/cn";

useEcharts([GraphChart]);

export interface AssetGraphChartNodePayload {
  id: string;
  name?: string;
  graphKey?: string;
  kind?: string;
  category?: string;
  scope?: string;
  status?: string;
  count?: number;
  workspace_ref?: string;
}

interface GraphClickParams {
  dataType?: string;
  data?: Partial<AssetGraphChartNodePayload> | null;
}

interface AssetGraphChartProps {
  option: EChartsCoreOption;
  height?: number;
  minWidth?: number;
  className?: string;
  onNodeClick?: (node: AssetGraphChartNodePayload) => void;
}

export function AssetGraphChart({
  option,
  height = 520,
  minWidth,
  className,
  onNodeClick,
}: AssetGraphChartProps): JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!onNodeClick) return;

    let frame = 0;
    let disposed = false;
    let cleanup = () => undefined;

    const bindEvents = (): void => {
      if (disposed) return;

      const chartElement = hostRef.current?.firstElementChild;
      if (!(chartElement instanceof HTMLDivElement)) {
        frame = window.requestAnimationFrame(bindEvents);
        return;
      }

      const chart = getInstanceByDom(chartElement);
      if (!chart) {
        frame = window.requestAnimationFrame(bindEvents);
        return;
      }

      const handleClick = (params: unknown): void => {
        const payload = params as GraphClickParams;
        if (payload.dataType !== "node" || !payload.data?.id) return;
        onNodeClick(payload.data as AssetGraphChartNodePayload);
      };

      chart.on("click", handleClick);
      cleanup = () => {
        chart.off("click", handleClick);
      };
    };

    frame = window.requestAnimationFrame(bindEvents);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      cleanup();
    };
  }, [onNodeClick, option]);

  return (
    <div className={cn("min-h-0 min-w-0 overflow-hidden", className)}>
      <div className={cn("min-h-0 min-w-0", minWidth ? "overflow-x-auto overflow-y-hidden" : "overflow-hidden")}>
        <div
          ref={hostRef}
          className="min-h-0 min-w-0"
          style={minWidth ? { minWidth: `${minWidth}px` } : undefined}
        >
          <EchartsBase option={option} height={height} />
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef } from "react";
import { init, use, type ECharts, type EChartsCoreOption } from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import {
  DataZoomComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useUiStore } from "@/stores/ui-store";

use([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  GraphicComponent,
  CanvasRenderer,
]);

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export type ChartOption = EChartsCoreOption;

export function useEchartsPalette(): string[] {
  const theme = useUiStore((state) => state.theme);

  return useMemo(() => {
    void theme;

    return [
      `hsl(${cssVar("--chart-1")})`,
      `hsl(${cssVar("--chart-2")})`,
      `hsl(${cssVar("--chart-3")})`,
      `hsl(${cssVar("--chart-4")})`,
      `hsl(${cssVar("--chart-5")})`,
    ];
  }, [theme]);
}

export function EchartsBase({
  option,
  height = 320,
}: {
  option: EChartsCoreOption;
  height?: number;
}): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ECharts | null>(null);
  const theme = useUiStore((state) => state.theme);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || chartRef.current) return;

    const chart = init(element, undefined, { renderer: "canvas" });
    chartRef.current = chart;

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(element);

    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.setOption(option, { notMerge: true, lazyUpdate: true });
  }, [option, theme]);

  return <div ref={containerRef} style={{ height }} className="w-full" />;
}

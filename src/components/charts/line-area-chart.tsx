import { useMemo } from "react";
import { EchartsBase, useEchartsPalette, type ChartOption } from "@/components/charts/echarts-base";
import { EmptyState } from "@/components/common/empty-state";
import { useUiStore } from "@/stores/ui-store";

interface LineSeries {
  name: string;
  data: Array<[string, number]>;
}

export function LineAreaChart({
  title,
  series,
  yAxisName,
  height = 320,
}: {
  title: string;
  series: LineSeries[];
  yAxisName?: string;
  height?: number;
}): JSX.Element {
  const palette = useEchartsPalette();
  const theme = useUiStore((state) => state.theme);
  const hasData = series.some((item) => item.data.length > 0);

  const option = useMemo<ChartOption>(() => {
    const axisColor = theme === "dark" ? "rgba(255,255,255,0.42)" : "rgba(17,24,39,0.48)";
    const gridColor = theme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(17,24,39,0.08)";
    return {
      color: palette,
      tooltip: { trigger: "axis", confine: true, transitionDuration: 0 },
      legend: { top: 0, textStyle: { color: axisColor } },
      grid: { left: 20, right: 20, top: 52, bottom: 28, containLabel: true },
      dataZoom: [{ type: "inside" }],
      xAxis: {
        type: "time",
        axisLabel: { color: axisColor },
        axisLine: { lineStyle: { color: gridColor } },
      },
      yAxis: {
        type: "value",
        name: yAxisName,
        axisLabel: { color: axisColor },
        splitLine: { lineStyle: { color: gridColor } },
      },
      series: series.map((item) => ({
        name: item.name,
        type: "line",
        smooth: true,
        showSymbol: false,
        areaStyle: { opacity: 0.12 },
        lineStyle: { width: 2 },
        data: item.data,
      })),
    };
  }, [palette, series, theme, yAxisName]);

  if (!hasData) {
    return <EmptyState title={title} description="当前还没有可展示的趋势数据。" />;
  }

  return <EchartsBase option={option} height={height} />;
}

import { useMemo } from "react";
import { EchartsBase, useEchartsPalette, type ChartOption } from "@/components/charts/echarts-base";
import { EmptyState } from "@/components/common/empty-state";
import { useUiStore } from "@/stores/ui-store";

export function BarChart({
  title,
  labels,
  values,
  height = 300,
}: {
  title: string;
  labels: string[];
  values: number[];
  height?: number;
}): JSX.Element {
  const palette = useEchartsPalette();
  const theme = useUiStore((state) => state.theme);

  const option = useMemo<ChartOption>(() => {
    const axisColor = theme === "dark" ? "rgba(255,255,255,0.42)" : "rgba(17,24,39,0.48)";
    const gridColor = theme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(17,24,39,0.08)";
    return {
      color: [palette[0]],
      tooltip: { trigger: "axis" },
      grid: { left: 20, right: 20, top: 36, bottom: 24, containLabel: true },
      xAxis: {
        type: "category",
        data: labels,
        axisLabel: { color: axisColor },
        axisLine: { lineStyle: { color: gridColor } },
      },
      yAxis: {
        type: "value",
        axisLabel: { color: axisColor },
        splitLine: { lineStyle: { color: gridColor } },
      },
      series: [
        {
          type: "bar",
          data: values,
          barMaxWidth: 28,
          itemStyle: { borderRadius: [10, 10, 4, 4] },
        },
      ],
    };
  }, [labels, palette, theme, values]);

  if (!labels.length || !values.length) {
    return <EmptyState title={title} description="当前暂无可展示的柱状统计数据。" />;
  }

  return <EchartsBase option={option} height={height} />;
}

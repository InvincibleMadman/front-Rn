import { useMemo } from "react";
import { EchartsBase, useEchartsPalette, type ChartOption } from "@/components/charts/echarts-base";
import { useUiStore } from "@/stores/ui-store";
import type { VulnSummary } from "@/types/api/vuln-history";

type TooltipParam = {
  color?: string;
  name?: string;
  value?: number | string;
  seriesName?: string;
};

export function VulnTypeDistributionChart({ summary }: { summary?: VulnSummary }): JSX.Element {
  const entries = Object.entries(summary?.by_coarse_type ?? {}).sort((a, b) => b[1] - a[1]);
  const isPlaceholder = entries.length === 0;
  const labels = entries.length
    ? entries.map(([name]) => name)
    : ["memory", "bounds", "null", "state", "resource", "unknown"];
  const values = entries.length
    ? entries.map(([, value]) => value)
    : [0, 0, 0, 0, 0, 0];

  const palette = useEchartsPalette();
  const theme = useUiStore((state) => state.theme);

  const option = useMemo<ChartOption>(() => {
    const axisColor = theme === "dark" ? "rgba(255,255,255,0.48)" : "rgba(17,24,39,0.58)";
    const gridColor = theme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(17,24,39,0.08)";
    const tooltipTextColor = theme === "dark" ? "rgba(241,245,249,0.96)" : "rgba(15,23,42,0.94)";
    const tooltipBg = theme === "dark" ? "rgba(31, 27, 46, 0.96)" : "rgba(255,255,255,0.96)";
    const tooltipBorder = theme === "dark" ? "rgba(129,140,248,0.22)" : "rgba(148,163,184,0.32)";
    const tooltipShadow = theme === "dark"
      ? "0 18px 42px rgba(0,0,0,0.42)"
      : "0 14px 32px rgba(15,23,42,0.14)";
    const barColors = theme === "dark"
      ? ["#8b5cf6", "#38bdf8", "#22c55e", "#f59e0b", "#fb7185", "#a78bfa", "#2dd4bf", "#f97316", "#60a5fa", "#f472b6"]
      : ["#6366f1", "#0ea5e9", "#16a34a", "#d97706", "#e11d48", "#7c3aed", "#0f766e", "#ea580c", "#2563eb", "#db2777"];
    const data = values.map((value, index) => ({
      value,
      itemStyle: {
        color: barColors[index % barColors.length],
        borderRadius: [0, 7, 7, 0] as [number, number, number, number],
      },
    }));

    return {
      color: barColors,
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        borderWidth: 1,
        textStyle: { fontSize: 13, color: tooltipTextColor },
        extraCssText: `border-radius: 0.875rem; box-shadow: ${tooltipShadow}; padding: 0.625rem 0.75rem;`,
        formatter: (params: TooltipParam[] | TooltipParam) => {
          const item = Array.isArray(params) ? params[0] : params;
          const color = item?.color ?? palette[0];
          const name = item?.name ?? "";
          const value = item?.value ?? 0;
          const seriesName = item?.seriesName ?? "数量";

          return `<div style="color:${tooltipTextColor};"><div style="margin-bottom:0.375rem;font-size:0.875rem;font-weight:600;">${name}</div><span style="display:inline-block;width:0.625rem;height:0.625rem;margin-right:0.375rem;border-radius:9999px;background:${color};vertical-align:middle;"></span>${seriesName}：${value}</div>`;
        },
      },
      grid: { left: 18, right: 16, top: 14, bottom: 12, containLabel: true },
      xAxis: {
        type: "value",
        minInterval: 1,
        min: 0,
        max: isPlaceholder ? 4 : undefined,
        interval: isPlaceholder ? 2 : undefined,
        axisLabel: { color: axisColor, fontSize: 13, margin: 10 },
        splitLine: { lineStyle: { color: gridColor } },
      },
      yAxis: {
        type: "category",
        data: labels,
        axisLabel: {
          color: axisColor,
          fontSize: 14,
          fontWeight: 600,
          width: 116,
          overflow: "truncate",
        },
        axisTick: { show: false },
        axisLine: { show: false },
      },
      series: [
        {
          name: "数量",
          type: "bar",
          data,
          barWidth: 16,
          label: {
            show: true,
            position: "right",
            color: axisColor,
            fontSize: 13,
            fontWeight: 600,
            formatter: ({ value }: { value?: number }) => `${value ?? 0}`,
          },
        },
      ],
    };
  }, [isPlaceholder, labels, palette, theme, values]);

  return <EchartsBase option={option} height={320} />;
}

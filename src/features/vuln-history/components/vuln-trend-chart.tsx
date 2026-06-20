import { useMemo } from "react";
import { EchartsBase, useEchartsPalette, type ChartOption } from "@/components/charts/echarts-base";
import { useUiStore } from "@/stores/ui-store";
import type { VulnTrendResponse } from "@/types/api/vuln-history";

type TooltipParam = {
  axisValueLabel?: string;
  color?: string;
  seriesName?: string;
  value?: [string, number] | number;
};

export function VulnTrendChart({ data }: { data?: VulnTrendResponse }): JSX.Element {
  const points = (data?.items ?? []).length
    ? (data?.items ?? [])
    : [
        { bucket: "2026-01-01T00:00:00Z", total: 0, high_confidence: 0, memory_related: 0 },
        { bucket: "2026-01-02T00:00:00Z", total: 0, high_confidence: 0, memory_related: 0 },
        { bucket: "2026-01-03T00:00:00Z", total: 0, high_confidence: 0, memory_related: 0 },
        { bucket: "2026-01-04T00:00:00Z", total: 0, high_confidence: 0, memory_related: 0 },
        { bucket: "2026-01-05T00:00:00Z", total: 0, high_confidence: 0, memory_related: 0 },
        { bucket: "2026-01-06T00:00:00Z", total: 0, high_confidence: 0, memory_related: 0 },
      ];

  const palette = useEchartsPalette();
  const theme = useUiStore((state) => state.theme);

  const option = useMemo<ChartOption>(() => {
    const axisColor = theme === "dark" ? "rgba(255,255,255,0.42)" : "rgba(17,24,39,0.48)";
    const gridColor = theme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(17,24,39,0.08)";
    const tooltipTextColor = theme === "dark" ? "rgba(241,245,249,0.96)" : "rgba(15,23,42,0.94)";
    const tooltipMutedColor = theme === "dark" ? "rgba(203,213,225,0.78)" : "rgba(71,85,105,0.82)";
    const tooltipBg = theme === "dark" ? "rgba(24, 24, 39, 0.96)" : "rgba(255,255,255,0.96)";
    const tooltipBorder = theme === "dark" ? "rgba(96,165,250,0.24)" : "rgba(148,163,184,0.3)";
    const tooltipShadow = theme === "dark"
      ? "0 18px 42px rgba(0,0,0,0.42)"
      : "0 14px 32px rgba(15,23,42,0.14)";

    return {
      color: palette,
      tooltip: {
        trigger: "axis",
        confine: true,
        transitionDuration: 0,
        axisPointer: {
          type: "line",
          lineStyle: {
            color: theme === "dark" ? "rgba(148,163,184,0.32)" : "rgba(100,116,139,0.28)",
            width: 1,
          },
        },
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        borderWidth: 1,
        textStyle: { fontSize: 13, color: tooltipTextColor },
        extraCssText: `border-radius: 0.875rem; box-shadow: ${tooltipShadow}; padding: 0.625rem 0.75rem;`,
        formatter: (params: TooltipParam[] | TooltipParam) => {
          const items = Array.isArray(params) ? params : [params];
          const header = items[0]?.axisValueLabel ?? "";
          const rows = items.map((item) => {
            const value = Array.isArray(item.value) ? item.value[1] : item.value ?? 0;
            return `<div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-top:0.25rem;">
              <span style="display:inline-flex;align-items:center;color:${tooltipMutedColor};">
                <span style="display:inline-block;width:0.625rem;height:0.625rem;margin-right:0.375rem;border-radius:9999px;background:${item.color ?? palette[0]};"></span>
                ${item.seriesName ?? ""}
              </span>
              <span style="font-weight:600;color:${tooltipTextColor};">${value}</span>
            </div>`;
          }).join("");

          return `<div style="color:${tooltipTextColor};min-width:10rem;"><div style="margin-bottom:0.125rem;font-size:0.875rem;font-weight:600;">${header}</div>${rows}</div>`;
        },
      },
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
        axisLabel: { color: axisColor },
        splitLine: { lineStyle: { color: gridColor } },
      },
      series: [
        {
          name: "total",
          type: "line",
          smooth: true,
          showSymbol: false,
          areaStyle: { opacity: 0.12 },
          lineStyle: { width: 2 },
          data: points.map((item) => [item.bucket, item.total] as [string, number]),
        },
        {
          name: "high confidence",
          type: "line",
          smooth: true,
          showSymbol: false,
          areaStyle: { opacity: 0.12 },
          lineStyle: { width: 2 },
          data: points.map((item) => [item.bucket, item.high_confidence] as [string, number]),
        },
        {
          name: "memory related",
          type: "line",
          smooth: true,
          showSymbol: false,
          areaStyle: { opacity: 0.12 },
          lineStyle: { width: 2 },
          data: points.map((item) => [item.bucket, item.memory_related] as [string, number]),
        },
      ],
    };
  }, [palette, points, theme]);

  return <EchartsBase option={option} height={320} />;
}

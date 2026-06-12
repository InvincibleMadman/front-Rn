import { useMemo, useState } from "react";
import { EchartsBase, useEchartsPalette, type ChartOption } from "@/components/charts/echarts-base";
import { EmptyState } from "@/components/common/empty-state";
import { useUiStore } from "@/stores/ui-store";

interface DonutDatum {
  name: string;
  value: number;
}

export function DonutChart({
  title,
  data,
  height = 460,
  legendItemsPerPage = 6,
}: {
  title: string;
  data: DonutDatum[];
  height?: number;
  /**
   * 默认 6 个：3 列 x 2 行。
   * 超过 6 个后启动自定义分页按钮。
   */
  legendItemsPerPage?: number;
}): JSX.Element {
  const theme = useUiStore((state) => state.theme);
  const palette = useEchartsPalette();
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const [legendPage, setLegendPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(data.length / legendItemsPerPage));
  const activePage = Math.min(legendPage, totalPages - 1);
  const legendItems = data.slice(
    activePage * legendItemsPerPage,
    activePage * legendItemsPerPage + legendItemsPerPage,
  );

  const chartHeight = Math.max(300, height - 90);

  const option = useMemo<ChartOption>(() => {
    const labelColor = theme === "dark" ? "rgba(255,255,255,0.72)" : "rgba(17,24,39,0.76)";

    return {
      color: palette,
      tooltip: { trigger: "item" },
      series: [
        {
          name: title,
          type: "pie",
          radius: ["44%", "58%"],
          center: ["50%", "45%"],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 10,
            borderWidth: 2,
            borderColor: theme === "dark" ? "rgba(17,24,39,1)" : "#fff",
          },
          label: {
            color: labelColor,
            fontSize: 15,
            lineHeight: 18,
            formatter: "{b}\n{d}%",
          },
          labelLine: {
            length: 10,
            length2: 8,
          },
          data,
        },
      ],
      graphic: [
        {
          type: "text",
          left: "center",
          top: "37%",
          style: {
            text: `${total}`,
            fill: theme === "dark" ? "#ffffff" : "#111827",
            font: "800 30px sans-serif",
          },
        },
        {
          type: "text",
          left: "center",
          top: "48%",
          style: {
            text: "Total",
            fill: labelColor,
            font: "600 15px sans-serif",
          },
        },
      ],
    };
  }, [data, palette, theme, title, total]);

  if (!data.length) {
    return <EmptyState title={title} description="当前暂无可用于占比分析的数据。" />;
  }

  return (
    <div className="flex min-h-0 flex-col" style={{ height }}>
      <div className="min-h-0 flex-1">
        <EchartsBase option={option} height={chartHeight} />
      </div>

      <div className="shrink-0 px-4 pb-5 pt-3">
        <div className="grid min-h-[52px] grid-cols-3 gap-x-4 gap-y-2">
          {legendItems.map((item, index) => {
            const absoluteIndex = activePage * legendItemsPerPage + index;
            return (
              <div key={`${item.name}-${absoluteIndex}`} className="flex min-w-0 items-start gap-2">
                <span
                  className="mt-1 size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: palette[absoluteIndex % palette.length] }}
                />
                <span
                  className="min-w-0 break-words text-center text-[14px] font-medium leading-[16px] text-muted-foreground"
                  title={`${item.name}: ${item.value}`}
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {item.name}
                </span>
              </div>
            );
          })}
        </div>

        {totalPages > 1 ? (
          <div className="mt-3 flex items-center justify-center gap-3 pb-1 text-xs text-muted-foreground">
            <button
              type="button"
              className="rounded-md border border-border/70 px-2 py-1 transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
              disabled={activePage <= 0}
              onClick={() => setLegendPage((page) => Math.max(0, page - 1))}
            >
              上一页
            </button>
            <span>
              {activePage + 1} / {totalPages}
            </span>
            <button
              type="button"
              className="rounded-md border border-border/70 px-2 py-1 transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
              disabled={activePage >= totalPages - 1}
              onClick={() => setLegendPage((page) => Math.min(totalPages - 1, page + 1))}
            >
              下一页
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
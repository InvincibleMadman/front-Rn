import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

export interface DashboardMetricRingSegment {
  value: number;
  color: string;
  label?: string;
}

export interface DashboardMetricRingProps {
  value: number;
  max: number;
  colorClassName?: string;
  color?: string;
  centerColor?: string;
  label?: string;
  centerValue: string | number;
  centerFontSize?: number | string;
  size?: number | string;
  strokeWidth?: number;
  className?: string;
  active?: boolean;
  segments?: DashboardMetricRingSegment[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function DashboardMetricRing({
  value,
  max,
  colorClassName,
  color,
  centerColor,
  label,
  centerValue,
  centerFontSize,
  size = "clamp(4.2rem, 7.5vw, 4.8rem)",
  strokeWidth = 10,
  className,
  active = false,
  segments,
}: DashboardMetricRingProps): JSX.Element {
  const viewBoxSize = 100;
  const [reducedMotion, setReducedMotion] = useState(false);
  const [displayDash, setDisplayDash] = useState(0);
  const [displayOpacity, setDisplayOpacity] = useState(0);
  const [hoveredSegmentIndex, setHoveredSegmentIndex] = useState<number | null>(null);
  const previousActiveRef = useRef(active);
  const bounceTimerRefs = useRef<number[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = (): void => {
      setReducedMotion(mediaQuery.matches);
    };

    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  const safeMax = Number.isFinite(max) && max > 0 ? max : 0;
  const safeValue = Number.isFinite(value) ? value : 0;
  const clampedValue = safeMax > 0 ? clamp(safeValue, 0, safeMax) : 0;
  const ratio = safeMax > 0 ? clamp(clampedValue / safeMax, 0, 1) : 0;
  const radius = (viewBoxSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalizedSegments = useMemo(() => {
    const source = Array.isArray(segments) ? segments : [];
    const prepared = source
      .map((segment) => ({
        ...segment,
        value: Math.max(Number.isFinite(segment.value) ? segment.value : 0, 0),
      }))
      .filter((segment) => segment.value > 0);
    const total = prepared.reduce((sum, segment) => sum + segment.value, 0);
    const denominator = Math.max(safeMax, total, 1);
    let accumulated = 0;

    return prepared.map((segment) => {
      const dash = (circumference * segment.value) / denominator;
      const offset = accumulated;
      accumulated += dash;
      return {
        ...segment,
        dash,
        offset,
      };
    });
  }, [circumference, safeMax, segments]);
  const hasSegments = normalizedSegments.length > 0;
  const hoveredSegment =
    hoveredSegmentIndex !== null ? normalizedSegments[hoveredSegmentIndex] ?? null : null;
  const baseDash = circumference * ratio;
  const previewDash = circumference * 0.07;
  const dotDash = Math.max(strokeWidth * 0.92, circumference * 0.012);
  const settleDash = Math.max(dotDash * 1.08, previewDash * 0.54);
  const bounceDash =
    ratio <= 0
      ? previewDash
      : Math.min(circumference, baseDash + previewDash);
  const bounceable = ratio < 1;
  const dotBlendThreshold = settleDash * 1.18;
  const dotBlendProgress = ratio <= 0 && displayDash > 0
    ? clamp((dotBlendThreshold - displayDash) / Math.max(dotBlendThreshold - (dotDash * 0.82), 1), 0, 1)
    : 0;
  const arcOpacity = displayOpacity * (1 - (dotBlendProgress * 0.82));
  const dotOpacity = displayOpacity * dotBlendProgress;

  const clearBounceTimers = (): void => {
    bounceTimerRefs.current.forEach((timer) => window.clearTimeout(timer));
    bounceTimerRefs.current = [];
  };

  useEffect(() => {
    clearBounceTimers();
    if (hasSegments) {
      setDisplayDash(0);
      setDisplayOpacity(0);
      return;
    }
    setDisplayDash(baseDash);
    setDisplayOpacity(baseDash > 0 ? 1 : 0);
  }, [baseDash, hasSegments]);

  useEffect(() => {
    if (hasSegments) {
      clearBounceTimers();
      setDisplayDash(0);
      setDisplayOpacity(0);
      return;
    }

    const wasActive = previousActiveRef.current;
    previousActiveRef.current = active;

    if (!active) {
      clearBounceTimers();
      setDisplayDash(baseDash);
      setDisplayOpacity(baseDash > 0 ? 1 : 0);
      return;
    }

    if (wasActive || reducedMotion || !bounceable) {
      return;
    }

    clearBounceTimers();
    setDisplayOpacity(1);

    setDisplayDash(bounceDash);
    if (ratio <= 0) {
      bounceTimerRefs.current.push(window.setTimeout(() => {
        setDisplayDash(settleDash);
      }, 250));
      bounceTimerRefs.current.push(window.setTimeout(() => {
        setDisplayDash(dotDash);
      }, 460));
      bounceTimerRefs.current.push(window.setTimeout(() => {
        setDisplayOpacity(0);
      }, 520));
      bounceTimerRefs.current.push(window.setTimeout(() => {
        setDisplayDash(0);
      }, 700));
    } else {
      bounceTimerRefs.current.push(window.setTimeout(() => {
        setDisplayDash(baseDash);
      }, 340));
    }

    return () => {
      clearBounceTimers();
    };
  }, [active, baseDash, bounceDash, bounceable, dotDash, hasSegments, ratio, reducedMotion, settleDash]);

  useEffect(() => {
    return () => {
      clearBounceTimers();
    };
  }, []);

  const resolvedCenterFontSize = useMemo(() => {
    if (centerFontSize !== undefined) {
      return centerFontSize;
    }
    const text = String(centerValue ?? "");
    if (text.length >= 7) return 18;
    if (text.length >= 5) return 20;
    return 22;
  }, [centerFontSize, centerValue]);

  return (
    <div
      className={cn("relative grid place-items-center", colorClassName, className)}
      style={{ color, width: size, height: size }}
      aria-label={label}
      title={label}
    >
      {hasSegments && hoveredSegment?.label ? (
        <div className="pointer-events-none absolute -top-2 left-1/2 z-[1] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full border border-border/60 bg-background/95 px-2.5 py-1 text-[11px] font-medium leading-none text-foreground shadow-sm">
          {hoveredSegment.label}
        </div>
      ) : null}
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        className="size-full overflow-visible"
      >
        {label ? <title>{label}</title> : null}
        <circle
          cx={viewBoxSize / 2}
          cy={viewBoxSize / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--border) / 0.28)"
          strokeWidth={strokeWidth}
        />
        {hasSegments
          ? normalizedSegments.map((segment, index) => {
              const isHovered = hoveredSegmentIndex === index;

              return (
                <g
                  key={`${segment.label ?? "segment"}-${index}`}
                  onMouseEnter={() => setHoveredSegmentIndex(index)}
                  onMouseLeave={() => setHoveredSegmentIndex((current) => (current === index ? null : current))}
                  onFocus={() => setHoveredSegmentIndex(index)}
                  onBlur={() => setHoveredSegmentIndex((current) => (current === index ? null : current))}
                >
                  <circle
                    cx={viewBoxSize / 2}
                    cy={viewBoxSize / 2}
                    r={radius}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={strokeWidth + 8}
                    strokeLinecap="butt"
                    strokeDasharray={`${segment.dash} ${Math.max(circumference - segment.dash, 0)}`}
                    strokeDashoffset={-segment.offset}
                    transform={`rotate(-90 ${viewBoxSize / 2} ${viewBoxSize / 2})`}
                    style={{ cursor: "pointer" }}
                  />
                  <circle
                    cx={viewBoxSize / 2}
                    cy={viewBoxSize / 2}
                    r={radius}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth={isHovered ? strokeWidth + 3 : strokeWidth}
                    strokeOpacity={isHovered ? 1 : 0.96}
                    strokeLinecap="butt"
                    strokeDasharray={`${segment.dash} ${Math.max(circumference - segment.dash, 0)}`}
                    strokeDashoffset={-segment.offset}
                    transform={`rotate(-90 ${viewBoxSize / 2} ${viewBoxSize / 2})`}
                    style={{
                      transition: reducedMotion
                        ? undefined
                        : "stroke-width 180ms cubic-bezier(0.22, 0.61, 0.36, 1), stroke-opacity 180ms cubic-bezier(0.22, 0.61, 0.36, 1)",
                    }}
                  />
                </g>
              );
            })
          : (
            <circle
              cx={viewBoxSize / 2}
              cy={viewBoxSize / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              strokeOpacity={arcOpacity}
              strokeLinecap={ratio >= 1 ? "butt" : "round"}
              strokeDasharray={`${displayDash} ${Math.max(circumference - displayDash, 0)}`}
              transform={`rotate(-90 ${viewBoxSize / 2} ${viewBoxSize / 2})`}
              style={{
                transition: reducedMotion
                  ? undefined
                  : "stroke-dasharray 380ms cubic-bezier(0.22, 0.72, 0.24, 1), stroke-opacity 240ms cubic-bezier(0.22, 0.61, 0.36, 1)",
              }}
            />
          )}
        {ratio <= 0 && dotOpacity > 0 ? (
          <circle
            cx={viewBoxSize / 2}
            cy={strokeWidth / 2}
            r={strokeWidth / 2}
            fill="currentColor"
            fillOpacity={dotOpacity}
            style={{
              transition: reducedMotion ? undefined : "fill-opacity 220ms cubic-bezier(0.22, 0.61, 0.36, 1)",
            }}
          />
        ) : null}
        <text
          x="50%"
          y="50%"
          fill={centerColor ?? "currentColor"}
          fontSize={resolvedCenterFontSize}
          fontWeight={800}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {String(centerValue)}
        </text>
      </svg>
    </div>
  );
}

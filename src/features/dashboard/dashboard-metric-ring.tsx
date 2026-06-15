import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

export interface DashboardMetricRingProps {
  value: number;
  max: number;
  colorClassName?: string;
  color?: string;
  label?: string;
  centerValue: string | number;
  size?: number | string;
  strokeWidth?: number;
  className?: string;
  active?: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function DashboardMetricRing({
  value,
  max,
  colorClassName,
  color,
  label,
  centerValue,
  size = "clamp(5rem, 9vw, 5.75rem)",
  strokeWidth = 10,
  className,
  active = false,
}: DashboardMetricRingProps): JSX.Element {
  const viewBoxSize = 100;
  const [reducedMotion, setReducedMotion] = useState(false);
  const [displayDash, setDisplayDash] = useState(0);
  const [displayOpacity, setDisplayOpacity] = useState(0);
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
  const baseDash = circumference * ratio;
  const previewDash = circumference * 0.07;
  const dotDash = Math.max(strokeWidth * 0.92, circumference * 0.012);
  const bounceDash =
    ratio <= 0
      ? previewDash
      : Math.min(circumference, baseDash + previewDash);
  const bounceable = ratio < 1;
  const isDotPhase = ratio <= 0 && displayOpacity > 0 && displayDash > 0 && displayDash <= (dotDash * 1.35);

  const clearBounceTimers = (): void => {
    bounceTimerRefs.current.forEach((timer) => window.clearTimeout(timer));
    bounceTimerRefs.current = [];
  };

  useEffect(() => {
    clearBounceTimers();
    setDisplayDash(baseDash);
    setDisplayOpacity(baseDash > 0 ? 1 : 0);
  }, [baseDash]);

  useEffect(() => {
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
        setDisplayDash(dotDash);
      }, 210));
      bounceTimerRefs.current.push(window.setTimeout(() => {
        setDisplayOpacity(0);
      }, 330));
      bounceTimerRefs.current.push(window.setTimeout(() => {
        setDisplayDash(0);
      }, 430));
    } else {
      bounceTimerRefs.current.push(window.setTimeout(() => {
        setDisplayDash(baseDash);
      }, 260));
    }

    return () => {
      clearBounceTimers();
    };
  }, [active, baseDash, bounceDash, bounceable, dotDash, ratio, reducedMotion]);

  useEffect(() => {
    return () => {
      clearBounceTimers();
    };
  }, []);

  const centerFontSize = useMemo(() => {
    const text = String(centerValue ?? "");
    if (text.length >= 7) return 16;
    if (text.length >= 5) return 18;
    return 20;
  }, [centerValue]);

  return (
    <div
      className={cn("relative grid place-items-center", colorClassName, className)}
      style={{ color, width: size, height: size }}
      aria-label={label}
      title={label}
    >
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
        <circle
          cx={viewBoxSize / 2}
          cy={viewBoxSize / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeOpacity={isDotPhase ? 0 : displayOpacity}
          strokeLinecap={ratio >= 1 ? "butt" : "round"}
          strokeDasharray={`${displayDash} ${Math.max(circumference - displayDash, 0)}`}
          transform={`rotate(-90 ${viewBoxSize / 2} ${viewBoxSize / 2})`}
          style={{
            transition: reducedMotion
              ? undefined
              : "stroke-dasharray 220ms cubic-bezier(0.22, 1, 0.36, 1), stroke-opacity 120ms ease-out",
          }}
        />
        {isDotPhase ? (
          <circle
            cx={viewBoxSize / 2}
            cy={strokeWidth / 2}
            r={strokeWidth / 2}
            fill="currentColor"
            fillOpacity={displayOpacity}
            style={{
              transition: reducedMotion ? undefined : "fill-opacity 120ms ease-out",
            }}
          />
        ) : null}
        <text
          x="50%"
          y="50%"
          fill="currentColor"
          fontSize={centerFontSize}
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

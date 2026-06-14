import { memo, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type RefObject, type WheelEvent } from "react";
import { Maximize2, Move, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { useUiStore } from "@/stores/ui-store";
import { readCssHsl } from "@/features/assets/asset-utils";
import type { AssetUmlLayout, AssetUmlNode, AssetUmlEdge } from "@/features/assets/asset-uml-model";

interface AssetUmlCanvasProps {
  title: string;
  subtitle?: string;
  layout: AssetUmlLayout;
  height: number | string;
  className?: string;
  selectedNodeId?: string | null;
  onNodeClick?: (node: AssetUmlNode) => void;
  onBackgroundClick?: () => void;
}

interface ViewTransform {
  panX: number;
  panY: number;
  zoom: number;
}

interface DragState {
  active: boolean;
  pointerId: number | null;
  startX: number;
  startY: number;
  startPanX: number;
  startPanY: number;
}

const MIN_ZOOM = 0.55;
const MAX_ZOOM = 1.8;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function shortenText(value: string, maxLength: number): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(8, Math.floor((maxLength - 1) * 0.6)))}…${text.slice(-Math.max(6, Math.floor(maxLength * 0.25)))}`;
}

function getRoleTone(role: AssetUmlNode["role"], palette: ReturnType<typeof getPalette>): { fill: string; stroke: string; header: string; text: string; accent: string } {
  switch (role) {
    case "catalog":
      return {
        fill: palette.blueSoft,
        stroke: palette.blue,
        header: palette.blueHeader,
        text: palette.text,
        accent: palette.blue,
      };
    case "protocol":
      return {
        fill: palette.chart1Soft,
        stroke: palette.chart1,
        header: palette.chart1Header,
        text: palette.text,
        accent: palette.chart1,
      };
    case "primary":
      return {
        fill: palette.orangeSoft,
        stroke: palette.orange,
        header: palette.orangeHeader,
        text: palette.text,
        accent: palette.orange,
      };
    case "secondary":
      return {
        fill: palette.chart3Soft,
        stroke: palette.chart3,
        header: palette.chart3Header,
        text: palette.text,
        accent: palette.chart3,
      };
    default:
      return {
        fill: palette.chart5Soft,
        stroke: palette.chart5,
        header: palette.chart5Header,
        text: palette.text,
        accent: palette.chart5,
      };
  }
}

function getPalette(theme: string) {
  void theme;
  return {
    text: readCssHsl("--foreground"),
    muted: readCssHsl("--muted-foreground"),
    background: readCssHsl("--background"),
    card: readCssHsl("--card"),
    border: readCssHsl("--border"),
    blue: readCssHsl("--accent-blue"),
    blueSoft: readCssHsl("--accent-blue", 0.14),
    blueHeader: readCssHsl("--accent-blue", 0.22),
    orange: readCssHsl("--accent-orange"),
    orangeSoft: readCssHsl("--accent-orange", 0.16),
    orangeHeader: readCssHsl("--accent-orange", 0.24),
    chart1: readCssHsl("--chart-1"),
    chart1Soft: readCssHsl("--chart-1", 0.14),
    chart1Header: readCssHsl("--chart-1", 0.22),
    chart3: readCssHsl("--chart-3"),
    chart3Soft: readCssHsl("--chart-3", 0.14),
    chart3Header: readCssHsl("--chart-3", 0.22),
    chart5: readCssHsl("--chart-5"),
    chart5Soft: readCssHsl("--chart-5", 0.14),
    chart5Header: readCssHsl("--chart-5", 0.22),
    success: readCssHsl("--color-success"),
    danger: readCssHsl("--color-danger"),
  };
}

function connectorPoint(node: AssetUmlNode, side: "left" | "right" | "top" | "bottom"): { x: number; y: number } {
  switch (side) {
    case "left":
      return { x: node.x, y: node.y + (node.height / 2) };
    case "right":
      return { x: node.x + node.width, y: node.y + (node.height / 2) };
    case "top":
      return { x: node.x + (node.width / 2), y: node.y };
    case "bottom":
    default:
      return { x: node.x + (node.width / 2), y: node.y + node.height };
  }
}

function buildEdgePath(edge: AssetUmlEdge, source: AssetUmlNode, target: AssetUmlNode): { path: string; labelX: number; labelY: number; markerStart?: string; markerEnd?: string } {
  const sourceCenterX = source.x + (source.width / 2);
  const sourceCenterY = source.y + (source.height / 2);
  const targetCenterX = target.x + (target.width / 2);
  const targetCenterY = target.y + (target.height / 2);
  const dx = targetCenterX - sourceCenterX;
  const dy = targetCenterY - sourceCenterY;
  const horizontal = Math.abs(dx) >= Math.abs(dy);

  if (horizontal) {
    const sourceSide = dx >= 0 ? "right" : "left";
    const targetSide = dx >= 0 ? "left" : "right";
    const start = connectorPoint(source, sourceSide);
    const end = connectorPoint(target, targetSide);
    const controlX = start.x + (end.x - start.x) * 0.5;
    return {
      path: `M ${start.x} ${start.y} C ${controlX} ${start.y}, ${controlX} ${end.y}, ${end.x} ${end.y}`,
      labelX: (start.x + end.x) / 2,
      labelY: (start.y + end.y) / 2 - 8,
      markerStart: edge.composite ? "url(#uml-diamond-marker)" : undefined,
      markerEnd: "url(#uml-arrow-marker)",
    };
  }

  const sourceSide = dy >= 0 ? "bottom" : "top";
  const targetSide = dy >= 0 ? "top" : "bottom";
  const start = connectorPoint(source, sourceSide);
  const end = connectorPoint(target, targetSide);
  const controlY = start.y + (end.y - start.y) * 0.5;
  return {
    path: `M ${start.x} ${start.y} C ${start.x} ${controlY}, ${end.x} ${controlY}, ${end.x} ${end.y}`,
    labelX: (start.x + end.x) / 2,
    labelY: (start.y + end.y) / 2 - 8,
    markerStart: edge.composite ? "url(#uml-diamond-marker)" : undefined,
    markerEnd: "url(#uml-arrow-marker)",
  };
}

function useSvgViewport(hostRef: RefObject<HTMLDivElement | null>): { width: number; height: number } {
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = hostRef.current;
    if (!element) return;

    const update = (): void => {
      const rect = element.getBoundingClientRect();
      setViewport({
        width: Math.max(0, Math.floor(rect.width)),
        height: Math.max(0, Math.floor(rect.height)),
      });
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [hostRef]);

  return viewport;
}

export const AssetUmlCanvas = memo(function AssetUmlCanvas({
  title,
  subtitle,
  layout,
  height,
  className,
  selectedNodeId,
  onNodeClick,
  onBackgroundClick,
}: AssetUmlCanvasProps): JSX.Element {
  const theme = useUiStore((state) => state.theme);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const viewport = useSvgViewport(hostRef);
  const palette = useMemo(() => getPalette(theme), [theme]);
  const nodesById = useMemo(() => new Map(layout.nodes.map((node) => [node.id, node] as const)), [layout.nodes]);
  const [transform, setTransform] = useState<ViewTransform>({ panX: 40, panY: 40, zoom: 1 });
  const transformRef = useRef(transform);
  const dragRef = useRef<DragState>({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
  });
  const fitTransformRef = useRef<ViewTransform>({ panX: 40, panY: 40, zoom: 1 });
  const suppressClickRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  const fitView = useCallback((): void => {
    const { width: viewportWidth, height: viewportHeight } = viewport;
    if (!viewportWidth || !viewportHeight) return;

    const boundsWidth = Math.max(1, layout.bounds.width || 1);
    const boundsHeight = Math.max(1, layout.bounds.height || 1);
    const availableWidth = Math.max(1, viewportWidth - 96);
    const availableHeight = Math.max(1, viewportHeight - 96);
    const zoom = clamp(Math.min(availableWidth / boundsWidth, availableHeight / boundsHeight), MIN_ZOOM, MAX_ZOOM);
    const panX = ((viewportWidth - (boundsWidth * zoom)) / 2) - (layout.bounds.x * zoom);
    const panY = ((viewportHeight - (boundsHeight * zoom)) / 2) - (layout.bounds.y * zoom);
    const next = { panX, panY, zoom };
    fitTransformRef.current = next;
    setTransform(next);
  }, [layout.bounds.height, layout.bounds.width, layout.bounds.x, layout.bounds.y, viewport]);

  useEffect(() => {
    fitView();
  }, [fitView]);

  const resetView = useCallback((): void => {
    setTransform(fitTransformRef.current);
  }, []);

  const screenToWorld = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    const svgElement = svgRef.current;
    if (!svgElement) return null;
    const rect = svgElement.getBoundingClientRect();
    return {
      x: (clientX - rect.left - transformRef.current.panX) / transformRef.current.zoom,
      y: (clientY - rect.top - transformRef.current.panY) / transformRef.current.zoom,
    };
  }, []);

  const applyWheelZoom = useCallback((deltaY: number, clientX: number, clientY: number): void => {
    const svgElement = svgRef.current;
    if (!svgElement) return;

    const rect = svgElement.getBoundingClientRect();
    const direction = deltaY < 0 ? 1.08 : 0.92;
    const nextZoom = clamp(transformRef.current.zoom * direction, MIN_ZOOM, MAX_ZOOM);
    const worldPoint = screenToWorld(clientX, clientY);
    if (!worldPoint) return;

    const nextPanX = clientX - rect.left - (worldPoint.x * nextZoom);
    const nextPanY = clientY - rect.top - (worldPoint.y * nextZoom);
    const next = { panX: nextPanX, panY: nextPanY, zoom: nextZoom };
    fitTransformRef.current = next;
    setTransform(next);
  }, [screenToWorld]);

  const handleWheel = useCallback((event: WheelEvent<SVGSVGElement>): void => {
    event.preventDefault();
    applyWheelZoom(event.deltaY, event.clientX, event.clientY);
  }, [applyWheelZoom]);

  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement) return;

    const nativeWheelListener = (event: globalThis.WheelEvent): void => {
      event.preventDefault();
      applyWheelZoom(event.deltaY, event.clientX, event.clientY);
    };

    svgElement.addEventListener("wheel", nativeWheelListener, { passive: false });
    return () => {
      svgElement.removeEventListener("wheel", nativeWheelListener);
    };
  }, [screenToWorld]);

  const handlePointerDown = useCallback((event: PointerEvent<SVGSVGElement>): void => {
    if (event.button !== 0) return;
    if ((event.target as Element | null)?.closest?.("[data-uml-node]")) {
      return;
    }

    const svgElement = svgRef.current;
    if (!svgElement) return;

    dragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPanX: transformRef.current.panX,
      startPanY: transformRef.current.panY,
    };
    setDragging(true);
    svgElement.setPointerCapture(event.pointerId);
  }, []);

  const handlePointerMove = useCallback((event: PointerEvent<SVGSVGElement>): void => {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 4) {
      suppressClickRef.current = true;
    }

    setTransform({
      panX: drag.startPanX + deltaX,
      panY: drag.startPanY + deltaY,
      zoom: transformRef.current.zoom,
    });
  }, []);

  const finishDrag = useCallback((event?: PointerEvent<SVGSVGElement>): void => {
    const drag = dragRef.current;
    if (!drag.active) return;
    if (event && drag.pointerId !== event.pointerId) return;

    dragRef.current = {
      active: false,
      pointerId: null,
      startX: 0,
      startY: 0,
      startPanX: 0,
      startPanY: 0,
    };
    setDragging(false);

    const svgElement = svgRef.current;
    const pointerId = event?.pointerId ?? drag.pointerId ?? undefined;
    if (pointerId !== undefined && svgElement?.hasPointerCapture(pointerId)) {
      svgElement.releasePointerCapture(pointerId);
    }

    window.requestAnimationFrame(() => {
      suppressClickRef.current = false;
    });
  }, []);

  const background = useMemo(() => {
    const width = Math.max(layout.bounds.x + layout.bounds.width + 240, 1800);
    const heightValue = Math.max(layout.bounds.y + layout.bounds.height + 240, 1200);
    return { width, height: heightValue };
  }, [layout.bounds.height, layout.bounds.width, layout.bounds.x, layout.bounds.y]);

  const edgeElements = useMemo(
    () => layout.edges.map((edge) => {
      const source = nodesById.get(edge.source);
      const target = nodesById.get(edge.target);
      if (!source || !target) return null;
      const geometry = buildEdgePath(edge, source, target);
      const label = edge.label ? shortenText(edge.label, 24) : "";

      return (
        <g key={`${edge.source}->${edge.target}`} className={edge.inferred ? "opacity-70" : "opacity-100"}>
          <path
            d={geometry.path}
            fill="none"
            stroke={edge.inferred ? readCssHsl("--muted-foreground", 0.5) : readCssHsl("--border", 0.9)}
            strokeWidth={1.5}
            strokeDasharray={edge.inferred ? "6 4" : undefined}
            markerStart={geometry.markerStart}
            markerEnd={geometry.markerEnd}
          />
          {label ? (
            <g transform={`translate(${geometry.labelX},${geometry.labelY})`}>
              <rect x={-4} y={-11} width={Math.max(36, (label.length * 6.6) + 8)} height={16} rx={4} fill={palette.card} stroke={palette.border} strokeWidth={0.8} />
              <text
                x={2}
                y={0}
                fill={palette.muted}
                fontSize={10}
                fontWeight={500}
                dominantBaseline="middle"
              >
                {label}
              </text>
            </g>
          ) : null}
        </g>
      );
    }),
    [layout.edges, nodesById, palette.border, palette.card, palette.muted],
  );

  const nodeElements = useMemo(
    () => layout.nodes.map((node) => {
      const tone = getRoleTone(node.role, palette);
      const isSelected = node.id === selectedNodeId || node.selected;
      const clipId = `uml-clip-${node.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
      const headerHeight = Math.max(30, Math.min(38, Math.round(node.height * 0.26)));
      const rowHeight = Math.max(18, Math.round((node.height - headerHeight - 18) / Math.max(node.attributes.length, 1)));
      const valueX = node.x + 12;
      const titleY = node.y + 22;
      const statusLabel = shortenText(node.status, 14);

      return (
        <g
          key={node.id}
          data-uml-node
          role="button"
          tabIndex={0}
          style={{ cursor: node.clickable === false ? "default" : "pointer" }}
          onClick={(event) => {
            event.stopPropagation();
            if (suppressClickRef.current || node.clickable === false) return;
            onNodeClick?.(node);
          }}
          onKeyDown={(event) => {
            if ((event.key === "Enter" || event.key === " ") && node.clickable !== false) {
              event.preventDefault();
              onNodeClick?.(node);
            }
          }}
        >
          <clipPath id={clipId}>
            <rect x={node.x} y={node.y} width={node.width} height={node.height} rx={2} />
          </clipPath>
          <rect
            x={node.x}
            y={node.y}
            width={node.width}
            height={node.height}
            rx={2}
            fill={tone.fill}
            stroke={isSelected ? palette.blue : tone.stroke}
            strokeWidth={isSelected ? 2.2 : 1.2}
          />
          <rect
            x={node.x}
            y={node.y}
            width={4}
            height={node.height}
            rx={2}
            fill={tone.accent}
          />
          <rect
            x={node.x + 1}
            y={node.y + 1}
            width={node.width - 2}
            height={headerHeight}
            rx={2}
            fill={tone.header}
          />
          <line
            x1={node.x}
            y1={node.y + headerHeight}
            x2={node.x + node.width}
            y2={node.y + headerHeight}
            stroke={palette.border}
            strokeWidth={0.9}
          />
          <g clipPath={`url(#${clipId})`}>
            <text
              x={valueX}
              y={titleY}
              fill={palette.text}
              fontSize={12.5}
              fontWeight={700}
              dominantBaseline="middle"
            >
              {shortenText(node.title, 28)}
            </text>
            <text
              x={node.x + node.width - 10}
              y={titleY}
              fill={palette.muted}
              fontSize={10}
              textAnchor="end"
              dominantBaseline="middle"
            >
              {statusLabel}
            </text>

            {node.attributes.map((row, index) => {
              const rowY = node.y + headerHeight + 16 + (index * rowHeight);
              const rowColor = row.tone === "success"
                ? palette.success
                : row.tone === "danger"
                  ? palette.danger
                  : row.tone === "accent"
                    ? tone.accent
                    : palette.muted;
              return (
                <g key={`${node.id}-${row.key}`}>
                  <text
                    x={valueX}
                    y={rowY}
                    fill={palette.muted}
                    fontSize={10.5}
                    dominantBaseline="middle"
                  >
                    <tspan fontWeight={600}>{row.key}</tspan>
                    <tspan>:</tspan>
                    <tspan fill={rowColor}>{` ${shortenText(row.value, 36)}`}</tspan>
                  </text>
                </g>
              );
            })}
          </g>
        </g>
      );
    }),
    [layout.nodes, onNodeClick, palette.blue, palette.border, palette.card, palette.danger, palette.muted, palette.success, palette.text, selectedNodeId],
  );

  return (
    <div className={cn("flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card shadow-console", className)}>
      <div className="flex flex-wrap items-center gap-3 border-b border-border/70 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{title}</p>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={fitView}>
            <Maximize2 className="size-4" />
            适配视图
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={resetView}>
            <RotateCcw className="size-4" />
            重置位置
          </Button>
          <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-xs text-muted-foreground">
            <Move className="size-3.5" />
            {Math.round(transform.zoom * 100)}%
          </span>
        </div>
      </div>

      <div ref={hostRef} className="h-full min-h-0 min-w-0 flex-1 overflow-hidden" style={{ height }}>
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          className="block min-h-0 min-w-0 select-none"
          style={{ cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onPointerLeave={finishDrag}
        >
          <defs>
            <linearGradient id="uml-background-gradient" x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor={palette.background} stopOpacity={0.95} />
              <stop offset="100%" stopColor={palette.card} stopOpacity={0.9} />
            </linearGradient>
            <pattern id="uml-grid" width="36" height="36" patternUnits="userSpaceOnUse">
              <path d="M 36 0 L 0 0 0 36" fill="none" stroke={palette.border} strokeOpacity={0.14} strokeWidth={1} />
            </pattern>
            <marker id="uml-arrow-marker" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={palette.border} />
            </marker>
            <marker id="uml-diamond-marker" viewBox="0 0 14 14" refX="7" refY="7" markerWidth="8" markerHeight="8" orient="auto">
              <path d="M 7 0 L 14 7 L 7 14 L 0 7 z" fill={palette.card} stroke={palette.border} strokeWidth={1} />
            </marker>
          </defs>

          <rect x={0} y={0} width={background.width} height={background.height} fill="url(#uml-background-gradient)" />
          <rect x={0} y={0} width={background.width} height={background.height} fill="url(#uml-grid)" opacity={0.55} />
          <rect
            x={0}
            y={0}
            width={background.width}
            height={background.height}
            fill="transparent"
            onClick={() => {
              if (suppressClickRef.current) return;
              onBackgroundClick?.();
            }}
          />

          <g transform={`translate(${transform.panX},${transform.panY}) scale(${transform.zoom})`}>
            {edgeElements}
            {nodeElements}
          </g>
        </svg>
      </div>
    </div>
  );
});

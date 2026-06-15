import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type ReactNode,
  type WheelEvent,
} from "react";
import { Maximize2, Plus, Minus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { AssetUmlEdge, AssetUmlEdgeDefs } from "@/features/assets/uml/asset-uml-edge";
import { AssetUmlEntity } from "@/features/assets/uml/asset-uml-entity";
import { umlCssHsl } from "@/features/assets/uml/asset-uml-theme";
import {
  withResolvedUmlEntitySize,
  type UmlAssetEntity,
  type UmlAssetRelation,
  type UmlDiagramModel,
} from "@/features/assets/uml/asset-uml-types";

interface AssetUmlCanvasProps {
  model: UmlDiagramModel;
  className?: string;
  minHeight?: number;
  toolbar?: ReactNode;
  selectedEntityId?: string | null;
  selectedRelationId?: string | null;
  onEntitySelect?: (entity: UmlAssetEntity) => void;
  onRelationSelect?: (relation: UmlAssetRelation) => void;
  onBackgroundClick?: () => void;
}

interface ViewState {
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

interface DiagramBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 1.8;
const FIT_MAX_ZOOM = 1;
const FIT_VIEWPORT_PADDING = 40;
const EMPTY_BOUNDS_PADDING = 72;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function measureViewport(host: HTMLDivElement | null): { width: number; height: number } {
  if (!host) {
    return { width: 0, height: 0 };
  }

  return {
    width: Math.max(0, Math.round(host.clientWidth)),
    height: Math.max(0, Math.round(host.clientHeight)),
  };
}

function computeDiagramBounds(
  entities: UmlAssetEntity[],
  fallbackBounds: UmlDiagramModel["bounds"],
): DiagramBounds {
  if (entities.length === 0) {
    return {
      x: -EMPTY_BOUNDS_PADDING,
      y: -EMPTY_BOUNDS_PADDING,
      width: Math.max(fallbackBounds.width + (EMPTY_BOUNDS_PADDING * 2), 1),
      height: Math.max(fallbackBounds.height + (EMPTY_BOUNDS_PADDING * 2), 1),
    };
  }

  const sizedEntities = entities.map(withResolvedUmlEntitySize);
  const minX = Math.min(...sizedEntities.map((entity) => entity.x));
  const minY = Math.min(...sizedEntities.map((entity) => entity.y));
  const maxX = Math.max(...sizedEntities.map((entity) => entity.x + entity.width));
  const maxY = Math.max(...sizedEntities.map((entity) => entity.y + entity.height));

  return {
    x: minX,
    y: minY,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1),
  };
}

function fitDiagramToViewport(
  bounds: DiagramBounds,
  viewport: { width: number; height: number },
  padding = FIT_VIEWPORT_PADDING,
): ViewState {
  const availableWidth = Math.max(1, viewport.width - (padding * 2));
  const availableHeight = Math.max(1, viewport.height - (padding * 2));
  const scaleX = availableWidth / Math.max(bounds.width, 1);
  const scaleY = availableHeight / Math.max(bounds.height, 1);
  const zoom = clamp(Math.min(scaleX, scaleY), MIN_ZOOM, FIT_MAX_ZOOM);

  return {
    panX: ((viewport.width - (bounds.width * zoom)) / 2) - (bounds.x * zoom),
    panY: ((viewport.height - (bounds.height * zoom)) / 2) - (bounds.y * zoom),
    zoom,
  };
}

function isSameViewState(left: ViewState, right: ViewState): boolean {
  return Math.abs(left.panX - right.panX) < 0.5
    && Math.abs(left.panY - right.panY) < 0.5
    && Math.abs(left.zoom - right.zoom) < 0.001;
}

function useViewport(hostRef: RefObject<HTMLDivElement | null>): { width: number; height: number } {
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const update = (): void => {
      setViewport(measureViewport(host));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => observer.disconnect();
  }, [hostRef]);

  return viewport;
}

export function AssetUmlCanvas({
  model,
  className,
  minHeight = 520,
  toolbar,
  selectedEntityId,
  selectedRelationId,
  onEntitySelect,
  onRelationSelect,
  onBackgroundClick,
}: AssetUmlCanvasProps): JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const viewport = useViewport(hostRef);
  const entities = useMemo(() => model.entities.map(withResolvedUmlEntitySize), [model.entities]);
  const entityMap = useMemo(() => new Map(entities.map((entity) => [entity.id, entity] as const)), [entities]);
  const diagramBounds = useMemo(
    () => computeDiagramBounds(entities, model.bounds),
    [entities, model.bounds.height, model.bounds.width],
  );
  const [viewState, setViewState] = useState<ViewState>({ panX: 32, panY: 32, zoom: 1 });
  const viewStateRef = useRef(viewState);
  const isUserPositionedRef = useRef(false);
  const dragRef = useRef<DragState>({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
  });
  const suppressClickRef = useRef(false);

  useEffect(() => {
    viewStateRef.current = viewState;
  }, [viewState]);

  const resolveViewport = useCallback((): { width: number; height: number } => {
    const measured = measureViewport(hostRef.current);
    if (measured.width > 0 && measured.height > 0) {
      return measured;
    }

    return viewport;
  }, [viewport]);

  const fitToView = useCallback((markUserPositioned = false): void => {
    const nextViewport = resolveViewport();
    if (!nextViewport.width || !nextViewport.height) return;

    const nextState = fitDiagramToViewport(diagramBounds, nextViewport);
    isUserPositionedRef.current = markUserPositioned;
    setViewState((current) => (isSameViewState(current, nextState) ? current : nextState));
  }, [diagramBounds, resolveViewport]);

  useEffect(() => {
    if (isUserPositionedRef.current) return;
    fitToView(false);
  }, [fitToView]);

  const commitUserViewState = useCallback((nextState: ViewState): void => {
    isUserPositionedRef.current = true;
    setViewState(nextState);
  }, []);

  const resetView = useCallback((): void => {
    isUserPositionedRef.current = false;
    fitToView(false);
  }, [fitToView]);

  const zoomAroundPoint = useCallback((nextZoom: number, clientX?: number, clientY?: number): void => {
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const anchorX = clientX ?? (rect.left + (rect.width / 2));
    const anchorY = clientY ?? (rect.top + (rect.height / 2));
    const worldX = (anchorX - rect.left - viewStateRef.current.panX) / viewStateRef.current.zoom;
    const worldY = (anchorY - rect.top - viewStateRef.current.panY) / viewStateRef.current.zoom;

    commitUserViewState({
      panX: anchorX - rect.left - (worldX * nextZoom),
      panY: anchorY - rect.top - (worldY * nextZoom),
      zoom: nextZoom,
    });
  }, [commitUserViewState]);

  const handleWheel = useCallback((event: WheelEvent<SVGSVGElement>): void => {
    event.preventDefault();
    const direction = event.deltaY < 0 ? 1.08 : 0.92;
    const nextZoom = clamp(viewStateRef.current.zoom * direction, MIN_ZOOM, MAX_ZOOM);
    zoomAroundPoint(nextZoom, event.clientX, event.clientY);
  }, [zoomAroundPoint]);

  const finishDrag = useCallback((pointerId?: number): void => {
    const svg = svgRef.current;
    if (pointerId !== undefined && svg?.hasPointerCapture(pointerId)) {
      svg.releasePointerCapture(pointerId);
    }

    dragRef.current = {
      active: false,
      pointerId: null,
      startX: 0,
      startY: 0,
      startPanX: 0,
      startPanY: 0,
    };

    window.requestAnimationFrame(() => {
      suppressClickRef.current = false;
    });
  }, []);

  const handlePointerDown = useCallback((event: ReactPointerEvent<SVGSVGElement>): void => {
    if (event.button !== 0) return;
    const target = event.target as Element | null;
    if (target?.closest?.("[data-uml-entity]") || target?.closest?.("[data-uml-edge]")) return;

    dragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPanX: viewStateRef.current.panX,
      startPanY: viewStateRef.current.panY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const handlePointerMove = useCallback((event: ReactPointerEvent<SVGSVGElement>): void => {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      suppressClickRef.current = true;
    }

    commitUserViewState({
      panX: drag.startPanX + deltaX,
      panY: drag.startPanY + deltaY,
      zoom: viewStateRef.current.zoom,
    });
  }, [commitUserViewState]);

  const handlePointerUp = useCallback((event: ReactPointerEvent<SVGSVGElement>): void => {
    if (!dragRef.current.active) return;
    finishDrag(event.pointerId);
  }, [finishDrag]);

  const handleZoomStep = useCallback((direction: 1 | -1): void => {
    const multiplier = direction > 0 ? 1.12 : 0.88;
    const nextZoom = clamp(viewStateRef.current.zoom * multiplier, MIN_ZOOM, MAX_ZOOM);
    zoomAroundPoint(nextZoom);
  }, [zoomAroundPoint]);

  const surfaceWidth = Math.max(viewport.width, 1);
  const surfaceHeight = Math.max(viewport.height, 1);

  return (
    <div
      className={cn(
        "relative min-h-[520px] min-w-0 overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card shadow-none",
        className,
      )}
    >
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
        {toolbar}
        <Button type="button" variant="outline" size="sm" onClick={() => fitToView(false)}>
          <Maximize2 className="size-4" />
          适配视图
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={resetView}>
          <RotateCcw className="size-4" />
          重置
        </Button>
        <Button type="button" variant="outline" size="icon" onClick={() => handleZoomStep(1)} aria-label="Zoom in">
          <Plus className="size-4" />
        </Button>
        <Button type="button" variant="outline" size="icon" onClick={() => handleZoomStep(-1)} aria-label="Zoom out">
          <Minus className="size-4" />
        </Button>
      </div>

      <div ref={hostRef} className="h-full min-h-[520px] min-w-0 overflow-hidden" style={{ minHeight }}>
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`0 0 ${Math.max(viewport.width, 1)} ${Math.max(viewport.height, 1)}`}
          className="block select-none"
          style={{ touchAction: "none", cursor: dragRef.current.active ? "grabbing" : "grab" }}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <AssetUmlEdgeDefs />

          <defs>
            <pattern id="asset-uml-grid-minor" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 14 0 L 0 0 0 14" fill="none" stroke={umlCssHsl("--border", 0.18)} strokeWidth="0.5" />
            </pattern>
            <pattern id="asset-uml-grid-major" width="20" height="20" patternUnits="userSpaceOnUse">
              <rect x={0} y={0} width={56} height={56} fill="url(#asset-uml-grid-minor)" />
              <path d="M 56 0 L 0 0 0 56" fill="none" stroke={umlCssHsl("--muted-foreground", 0.26)} strokeWidth="0.7" />
            </pattern>
          </defs>

          <rect x={0} y={0} width={surfaceWidth} height={surfaceHeight} fill="transparent" />
          <rect x={0} y={0} width={surfaceWidth} height={surfaceHeight} fill="url(#asset-uml-grid-major)" />

          <rect
            x={0}
            y={0}
            width={surfaceWidth}
            height={surfaceHeight}
            fill="transparent"
            onClick={() => {
              if (suppressClickRef.current) return;
              onBackgroundClick?.();
            }}
          />

          <g transform={`translate(${viewState.panX},${viewState.panY}) scale(${viewState.zoom})`}>
            {model.relations.map((relation) => {
              const sourceEntity = entityMap.get(relation.source);
              const targetEntity = entityMap.get(relation.target);
              if (!sourceEntity || !targetEntity) return null;
              const relationTouchesSelectedEntity = Boolean(
                selectedEntityId && (relation.source === selectedEntityId || relation.target === selectedEntityId),
              );

              return (
                <AssetUmlEdge
                  key={relation.id}
                  relation={relation}
                  sourceEntity={sourceEntity}
                  targetEntity={targetEntity}
                  allEntities={entities}
                  selected={relation.id === selectedRelationId}
                  highlighted={relationTouchesSelectedEntity}
                  onRelationSelect={onRelationSelect}
                />
              );
            })}

            {entities.map((entity) => (
              <AssetUmlEntity
                key={entity.id}
                entity={entity}
                selected={entity.id === selectedEntityId}
                onEntitySelect={onEntitySelect}
              />
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}

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
  getDiagramRect,
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

const MIN_ZOOM = 0.55;
const MAX_ZOOM = 1.8;
const FIT_PADDING = 40;
const FIT_MAX_ZOOM = 1;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getContentExtent(model: UmlDiagramModel): { x: number; y: number; width: number; height: number } {
  const rect = getDiagramRect(model);
  return {
    x: rect.x,
    y: rect.y,
    width: Math.max(rect.width, 1),
    height: Math.max(rect.height, 1),
  };
}

function useViewport(hostRef: RefObject<HTMLDivElement | null>): { width: number; height: number } {
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const update = (): void => {
      const rect = host.getBoundingClientRect();
      setViewport({
        width: Math.max(0, Math.round(rect.width)),
        height: Math.max(0, Math.round(rect.height)),
      });
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
  const extent = useMemo(() => getContentExtent({ ...model, entities }), [entities, model]);
  const [viewState, setViewState] = useState<ViewState>({ panX: 32, panY: 32, zoom: 1 });
  const viewStateRef = useRef(viewState);
  const fitStateRef = useRef<ViewState>({ panX: 32, panY: 32, zoom: 1 });
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

  const fitToView = useCallback((): void => {
    if (!viewport.width || !viewport.height) return;

    const availableWidth = Math.max(1, viewport.width - (FIT_PADDING * 2));
    const availableHeight = Math.max(1, viewport.height - (FIT_PADDING * 2));
    const zoom = clamp(
      Math.min(availableWidth / extent.width, availableHeight / extent.height),
      MIN_ZOOM,
      FIT_MAX_ZOOM,
    );
    const panX = ((viewport.width - (extent.width * zoom)) / 2) - (extent.x * zoom);
    const panY = ((viewport.height - (extent.height * zoom)) / 2) - (extent.y * zoom);
    const nextState = { panX, panY, zoom };
    fitStateRef.current = nextState;
    setViewState(nextState);
  }, [extent.height, extent.width, extent.x, extent.y, viewport.height, viewport.width]);

  useEffect(() => {
    fitToView();
  }, [fitToView]);

  const resetView = useCallback((): void => {
    setViewState(fitStateRef.current);
  }, []);

  const zoomAroundPoint = useCallback((nextZoom: number, clientX?: number, clientY?: number): void => {
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const anchorX = clientX ?? (rect.left + (rect.width / 2));
    const anchorY = clientY ?? (rect.top + (rect.height / 2));
    const worldX = (anchorX - rect.left - viewStateRef.current.panX) / viewStateRef.current.zoom;
    const worldY = (anchorY - rect.top - viewStateRef.current.panY) / viewStateRef.current.zoom;
    const panX = anchorX - rect.left - (worldX * nextZoom);
    const panY = anchorY - rect.top - (worldY * nextZoom);

    setViewState({ panX, panY, zoom: nextZoom });
  }, []);

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
    if (target?.closest?.("[data-uml-entity]")) return;

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

    setViewState({
      panX: drag.startPanX + deltaX,
      panY: drag.startPanY + deltaY,
      zoom: viewStateRef.current.zoom,
    });
  }, []);

  const handlePointerUp = useCallback((event: ReactPointerEvent<SVGSVGElement>): void => {
    if (!dragRef.current.active) return;
    finishDrag(event.pointerId);
  }, [finishDrag]);

  const handleZoomStep = useCallback((direction: 1 | -1): void => {
    const multiplier = direction > 0 ? 1.12 : 0.88;
    const nextZoom = clamp(viewStateRef.current.zoom * multiplier, MIN_ZOOM, MAX_ZOOM);
    zoomAroundPoint(nextZoom);
  }, [zoomAroundPoint]);

  const surfaceWidth = Math.max(extent.width + 240, model.bounds.width + 160, 1400);
  const surfaceHeight = Math.max(extent.height + 240, model.bounds.height + 160, 900);

  return (
    <div
      className={cn(
        "relative min-h-[520px] min-w-0 overflow-hidden rounded-[var(--radius-xl)] border border-border bg-card",
        className,
      )}
    >
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
        {toolbar}
        <Button type="button" variant="outline" size="sm" onClick={fitToView}>
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
            <pattern id="asset-uml-grid" width="36" height="36" patternUnits="userSpaceOnUse">
              <path d="M 36 0 L 0 0 0 36" fill="none" stroke={umlCssHsl("--border", 0.18)} strokeWidth="1" />
            </pattern>
          </defs>

          <rect x={0} y={0} width={surfaceWidth} height={surfaceHeight} fill={umlCssHsl("--background")} />
          <rect x={0} y={0} width={surfaceWidth} height={surfaceHeight} fill="url(#asset-uml-grid)" />

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

              return (
                <AssetUmlEdge
                  key={relation.id}
                  relation={relation}
                  sourceEntity={sourceEntity}
                  targetEntity={targetEntity}
                  selected={relation.id === selectedRelationId}
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

import { memo, useMemo } from "react";
import { getUmlKindTone, umlCssHsl } from "@/features/assets/uml/asset-uml-theme";
import {
  resolveUmlEntitySize,
  type UmlAssetEntity,
  type UmlAssetRelation,
} from "@/features/assets/uml/asset-uml-types";

interface AssetUmlEdgeProps {
  relation: UmlAssetRelation;
  sourceEntity: UmlAssetEntity;
  targetEntity: UmlAssetEntity;
  allEntities: UmlAssetEntity[];
  selected?: boolean;
  highlighted?: boolean;
  onRelationSelect?: (relation: UmlAssetRelation) => void;
}

type EdgePoint = {
  x: number;
  y: number;
};

type EdgeRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ConnectorSide = "left" | "right" | "top" | "bottom";

type EdgeGeometry = {
  path: string;
  labelX: number;
  labelY: number;
  labelDx: number;
  labelDy: number;
  sourceAnchor: EdgePoint;
  targetAnchor: EdgePoint;
  startLinePoint: EdgePoint;
  endLinePoint: EdgePoint;
  sourceSide: ConnectorSide;
  targetSide: ConnectorSide;
};

const ENTITY_AVOID_MARGIN = 28;
const EDGE_EXIT_LENGTH = 28;
const EDGE_CHANNEL_STEP = 56;
const DIAMOND_DEPTH = 16;
const DIAMOND_WIDTH = 12;
const TRIANGLE_DEPTH = 14;
const TRIANGLE_WIDTH = 12;

function getEntityRect(entity: UmlAssetEntity): EdgeRect {
  const size = resolveUmlEntitySize(entity);
  return {
    x: entity.x,
    y: entity.y,
    width: size.width,
    height: size.height,
  };
}

function getEntityCenter(entity: UmlAssetEntity): EdgePoint {
  const rect = getEntityRect(entity);
  return {
    x: rect.x + (rect.width / 2),
    y: rect.y + (rect.height / 2),
  };
}

function getExpandedRect(entity: UmlAssetEntity, margin = ENTITY_AVOID_MARGIN): EdgeRect {
  const rect = getEntityRect(entity);
  return {
    x: rect.x - margin,
    y: rect.y - margin,
    width: rect.width + (margin * 2),
    height: rect.height + (margin * 2),
  };
}

function getConnector(entity: UmlAssetEntity, side: ConnectorSide): EdgePoint {
  const rect = getEntityRect(entity);
  if (side === "left") return { x: rect.x, y: rect.y + (rect.height / 2) };
  if (side === "right") return { x: rect.x + rect.width, y: rect.y + (rect.height / 2) };
  if (side === "top") return { x: rect.x + (rect.width / 2), y: rect.y };
  return { x: rect.x + (rect.width / 2), y: rect.y + rect.height };
}

function sideVector(side: ConnectorSide): EdgePoint {
  if (side === "left") return { x: -1, y: 0 };
  if (side === "right") return { x: 1, y: 0 };
  if (side === "top") return { x: 0, y: -1 };
  return { x: 0, y: 1 };
}

function perpendicularVector(side: ConnectorSide): EdgePoint {
  const vector = sideVector(side);
  return { x: -vector.y, y: vector.x };
}

function shiftPoint(point: EdgePoint, side: ConnectorSide, distance: number): EdgePoint {
  const vector = sideVector(side);
  return {
    x: point.x + (vector.x * distance),
    y: point.y + (vector.y * distance),
  };
}

function resolveConnectorSides(
  sourceEntity: UmlAssetEntity,
  targetEntity: UmlAssetEntity,
): {
  sourceSide: ConnectorSide;
  targetSide: ConnectorSide;
  horizontalPrimary: boolean;
} {
  const sourceCenter = getEntityCenter(sourceEntity);
  const targetCenter = getEntityCenter(targetEntity);
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;
  const horizontalPrimary = Math.abs(dx) >= (Math.abs(dy) * 0.72);

  if (horizontalPrimary) {
    return dx >= 0
      ? { sourceSide: "right", targetSide: "left", horizontalPrimary: true }
      : { sourceSide: "left", targetSide: "right", horizontalPrimary: true };
  }

  return dy >= 0
    ? { sourceSide: "bottom", targetSide: "top", horizontalPrimary: false }
    : { sourceSide: "top", targetSide: "bottom", horizontalPrimary: false };
}

function pointInRect(point: EdgePoint, rect: EdgeRect): boolean {
  return point.x > rect.x
    && point.x < rect.x + rect.width
    && point.y > rect.y
    && point.y < rect.y + rect.height;
}

function segmentIntersectsRect(start: EdgePoint, end: EdgePoint, rect: EdgeRect): boolean {
  if (pointInRect(start, rect) || pointInRect(end, rect)) return true;

  if (start.x === end.x) {
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    return start.x > rect.x
      && start.x < rect.x + rect.width
      && maxY > rect.y
      && minY < rect.y + rect.height;
  }

  if (start.y === end.y) {
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    return start.y > rect.y
      && start.y < rect.y + rect.height
      && maxX > rect.x
      && minX < rect.x + rect.width;
  }

  return false;
}

function dedupePoints(points: EdgePoint[]): EdgePoint[] {
  return points.filter((point, index) => {
    const previous = points[index - 1];
    return !previous || previous.x !== point.x || previous.y !== point.y;
  });
}

function buildSegments(points: EdgePoint[]): Array<{ start: EdgePoint; end: EdgePoint }> {
  const deduped = dedupePoints(points);
  return deduped.slice(0, -1).map((point, index) => ({
    start: point,
    end: deduped[index + 1],
  })).filter((segment) => segment.start.x !== segment.end.x || segment.start.y !== segment.end.y);
}

function normalizeOrthogonalPoints(points: EdgePoint[]): EdgePoint[] {
  const deduped = dedupePoints(points);
  if (deduped.length <= 2) return deduped;

  const normalized: EdgePoint[] = [deduped[0]];
  for (let index = 1; index < deduped.length - 1; index += 1) {
    const previous = normalized[normalized.length - 1];
    const current = deduped[index];
    const next = deduped[index + 1];
    const sameVertical = previous.x === current.x && current.x === next.x;
    const sameHorizontal = previous.y === current.y && current.y === next.y;
    if (sameVertical || sameHorizontal) {
      continue;
    }
    normalized.push(current);
  }
  normalized.push(deduped[deduped.length - 1]);
  return normalized;
}

function pathHitsEntities(points: EdgePoint[], obstacles: EdgeRect[]): boolean {
  const segments = buildSegments(points);
  return segments.some((segment) => obstacles.some((rect) => segmentIntersectsRect(segment.start, segment.end, rect)));
}

function buildEntityAvoidanceRects(
  entities: UmlAssetEntity[],
  ignoredIds: Set<string>,
): EdgeRect[] {
  return entities
    .filter((entity) => !ignoredIds.has(entity.id))
    .map((entity) => getExpandedRect(entity));
}

function pathLength(points: EdgePoint[]): number {
  return buildSegments(points).reduce((sum, segment) => (
    sum + Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y)
  ), 0);
}

function countTurns(points: EdgePoint[]): number {
  const segments = buildSegments(points);
  if (segments.length <= 1) return 0;

  let turns = 0;
  for (let index = 1; index < segments.length; index += 1) {
    const previous = segments[index - 1];
    const current = segments[index];
    const previousHorizontal = previous.start.y === previous.end.y;
    const currentHorizontal = current.start.y === current.end.y;
    if (previousHorizontal !== currentHorizontal) {
      turns += 1;
    }
  }
  return turns;
}

function computeBacktrackPenalty(points: EdgePoint[]): number {
  const segments = buildSegments(points);
  if (segments.length <= 1) return 0;

  let penalty = 0;
  let previousDx = 0;
  let previousDy = 0;

  segments.forEach((segment) => {
    const dx = segment.end.x - segment.start.x;
    const dy = segment.end.y - segment.start.y;
    if (dx !== 0) {
      const signX = Math.sign(dx);
      if (previousDx !== 0 && signX !== previousDx) {
        penalty += Math.abs(dx);
      }
      previousDx = signX;
    }
    if (dy !== 0) {
      const signY = Math.sign(dy);
      if (previousDy !== 0 && signY !== previousDy) {
        penalty += Math.abs(dy);
      }
      previousDy = signY;
    }
  });

  return penalty;
}

function uniqueNumbers(values: number[]): number[] {
  return Array.from(new Set(values.map((value) => Math.round(value))));
}

function buildHorizontalPath(start: EdgePoint, end: EdgePoint, channelX: number): EdgePoint[] {
  return [
    start,
    { x: channelX, y: start.y },
    { x: channelX, y: end.y },
    end,
  ];
}

function buildVerticalPath(start: EdgePoint, end: EdgePoint, channelY: number): EdgePoint[] {
  return [
    start,
    { x: start.x, y: channelY },
    { x: end.x, y: channelY },
    end,
  ];
}

function buildOffsetSequence(step = EDGE_CHANNEL_STEP): number[] {
  return [0, step, -step, step * 2, -step * 2, step * 3, -step * 3, step * 4, -step * 4];
}

function isWithinSpan(value: number, start: number, end: number, tolerance = 2): boolean {
  const min = Math.min(start, end) - tolerance;
  const max = Math.max(start, end) + tolerance;
  return value >= min && value <= max;
}

function buildCandidatePaths(
  start: EdgePoint,
  end: EdgePoint,
  horizontalPrimary: boolean,
  obstacles: EdgeRect[],
): EdgePoint[][] {
  const midpointX = start.x + ((end.x - start.x) / 2);
  const midpointY = start.y + ((end.y - start.y) / 2);
  const offsetSequence = buildOffsetSequence();
  const obstacleXs = uniqueNumbers(obstacles.flatMap((rect) => [rect.x - 14, rect.x + rect.width + 14]));
  const obstacleYs = uniqueNumbers(obstacles.flatMap((rect) => [rect.y - 14, rect.y + rect.height + 14]));
  const horizontalChannels = uniqueNumbers([
    midpointX,
    ...offsetSequence.map((offset) => midpointX + offset),
    ...obstacleXs,
  ]);
  const verticalChannels = uniqueNumbers([
    midpointY,
    ...offsetSequence.map((offset) => midpointY + offset),
    ...obstacleYs,
  ]);
  const primaryHorizontalChannels = horizontalChannels.filter((channelX) => isWithinSpan(channelX, start.x, end.x));
  const primaryVerticalChannels = verticalChannels.filter((channelY) => isWithinSpan(channelY, start.y, end.y));

  if (horizontalPrimary) {
    return [
      ...primaryHorizontalChannels.map((channelX) => buildHorizontalPath(start, end, channelX)),
      ...verticalChannels.map((channelY) => buildVerticalPath(start, end, channelY)),
    ];
  }

  return [
    ...primaryVerticalChannels.map((channelY) => buildVerticalPath(start, end, channelY)),
    ...horizontalChannels.map((channelX) => buildHorizontalPath(start, end, channelX)),
  ];
}

function getSourceDecorationDepth(relation: UmlAssetRelation): number {
  return relation.kind === "composition" || relation.kind === "aggregation" ? DIAMOND_DEPTH : 0;
}

function getTargetDecorationDepth(relation: UmlAssetRelation): number {
  return relation.kind === "dependency" || relation.kind === "flow" ? TRIANGLE_DEPTH : 0;
}

function computePolylineMidpoint(points: EdgePoint[]): {
  point: EdgePoint;
  segment: { start: EdgePoint; end: EdgePoint } | null;
} {
  const segments = buildSegments(points);
  const lengths = segments.map((segment) => Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y));
  const total = lengths.reduce((sum, value) => sum + value, 0);

  if (!segments.length || total <= 0) {
    return {
      point: points[Math.floor(points.length / 2)] ?? { x: 0, y: 0 },
      segment: null,
    };
  }

  let travelled = 0;
  const halfway = total / 2;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const segmentLength = lengths[index];
    if (travelled + segmentLength >= halfway) {
      const ratio = (halfway - travelled) / segmentLength;
      return {
        point: {
          x: segment.start.x + ((segment.end.x - segment.start.x) * ratio),
          y: segment.start.y + ((segment.end.y - segment.start.y) * ratio),
        },
        segment,
      };
    }
    travelled += segmentLength;
  }

  return {
    point: segments[segments.length - 1]?.end ?? { x: 0, y: 0 },
    segment: segments[segments.length - 1] ?? null,
  };
}

function buildEdgeGeometry(
  relation: UmlAssetRelation,
  sourceEntity: UmlAssetEntity,
  targetEntity: UmlAssetEntity,
  allEntities: UmlAssetEntity[],
): EdgeGeometry {
  const { sourceSide, targetSide, horizontalPrimary } = resolveConnectorSides(sourceEntity, targetEntity);
  const sourceAnchor = getConnector(sourceEntity, sourceSide);
  const targetAnchor = getConnector(targetEntity, targetSide);
  const sourceDecorationDepth = getSourceDecorationDepth(relation);
  const targetDecorationDepth = getTargetDecorationDepth(relation);
  const startLinePoint = shiftPoint(sourceAnchor, sourceSide, sourceDecorationDepth);
  const endLinePoint = shiftPoint(targetAnchor, targetSide, targetDecorationDepth);
  const startExit = shiftPoint(startLinePoint, sourceSide, EDGE_EXIT_LENGTH);
  const endExit = shiftPoint(endLinePoint, targetSide, EDGE_EXIT_LENGTH);
  const obstacles = buildEntityAvoidanceRects(allEntities, new Set([sourceEntity.id, targetEntity.id]));
  const routedCandidates = buildCandidatePaths(startExit, endExit, horizontalPrimary, obstacles);
  const candidates = routedCandidates.map((candidate) => [
    startLinePoint,
    ...candidate,
    endLinePoint,
  ]).map(normalizeOrthogonalPoints);
  const clearCandidates = candidates.filter((points) => !pathHitsEntities(points, obstacles));
  const chosenPoints = (clearCandidates.length > 0 ? clearCandidates : candidates)
    .slice()
    .sort((left, right) => {
      const backtrackDelta = computeBacktrackPenalty(left) - computeBacktrackPenalty(right);
      if (backtrackDelta !== 0) return backtrackDelta;
      const turnsDelta = countTurns(left) - countTurns(right);
      if (turnsDelta !== 0) return turnsDelta;
      return pathLength(left) - pathLength(right);
    })[0] ?? normalizeOrthogonalPoints([startLinePoint, endLinePoint]);
  const midpoint = computePolylineMidpoint(chosenPoints);
  const horizontalLabel = midpoint.segment ? midpoint.segment.start.y === midpoint.segment.end.y : horizontalPrimary;

  return {
    path: chosenPoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" "),
    labelX: midpoint.point.x,
    labelY: midpoint.point.y,
    labelDx: horizontalLabel ? 0 : 12,
    labelDy: horizontalLabel ? -12 : 0,
    sourceAnchor,
    targetAnchor,
    startLinePoint,
    endLinePoint,
    sourceSide,
    targetSide,
  };
}

function buildTrianglePoints(anchor: EdgePoint, side: ConnectorSide, depth = TRIANGLE_DEPTH, width = TRIANGLE_WIDTH): string {
  const forward = sideVector(side);
  const perpendicular = perpendicularVector(side);
  const baseCenter = {
    x: anchor.x + (forward.x * depth),
    y: anchor.y + (forward.y * depth),
  };
  const halfWidth = width / 2;
  const left = {
    x: baseCenter.x + (perpendicular.x * halfWidth),
    y: baseCenter.y + (perpendicular.y * halfWidth),
  };
  const right = {
    x: baseCenter.x - (perpendicular.x * halfWidth),
    y: baseCenter.y - (perpendicular.y * halfWidth),
  };
  return `${anchor.x},${anchor.y} ${left.x},${left.y} ${right.x},${right.y}`;
}

function buildDiamondPoints(anchor: EdgePoint, side: ConnectorSide, depth = DIAMOND_DEPTH, width = DIAMOND_WIDTH): string {
  const forward = sideVector(side);
  const perpendicular = perpendicularVector(side);
  const halfWidth = width / 2;
  const midCenter = {
    x: anchor.x + (forward.x * (depth / 2)),
    y: anchor.y + (forward.y * (depth / 2)),
  };
  const outer = {
    x: anchor.x + (forward.x * depth),
    y: anchor.y + (forward.y * depth),
  };
  const left = {
    x: midCenter.x + (perpendicular.x * halfWidth),
    y: midCenter.y + (perpendicular.y * halfWidth),
  };
  const right = {
    x: midCenter.x - (perpendicular.x * halfWidth),
    y: midCenter.y - (perpendicular.y * halfWidth),
  };
  return `${anchor.x},${anchor.y} ${left.x},${left.y} ${outer.x},${outer.y} ${right.x},${right.y}`;
}

function truncateLabel(value: string, maxChars = 22): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, Math.max(4, maxChars - 3))}...`;
}

function getEdgeStroke(sourceEntity: UmlAssetEntity, targetEntity: UmlAssetEntity, relation: UmlAssetRelation): string {
  if (relation.inferred) {
    return umlCssHsl("--muted-foreground", 0.36);
  }

  const sourceTone = getUmlKindTone(sourceEntity.kind, sourceEntity.status);
  const targetTone = getUmlKindTone(targetEntity.kind, targetEntity.status);
  return `color-mix(in oklab, ${sourceTone.edge} 52%, ${targetTone.edge} 48%)`;
}

export function AssetUmlEdgeDefs(): JSX.Element {
  return <defs />;
}

export const AssetUmlEdge = memo(function AssetUmlEdge({
  relation,
  sourceEntity,
  targetEntity,
  allEntities,
  selected = false,
  highlighted = false,
  onRelationSelect,
}: AssetUmlEdgeProps): JSX.Element {
  const geometry = useMemo(
    () => buildEdgeGeometry(relation, sourceEntity, targetEntity, allEntities),
    [allEntities, relation, sourceEntity, targetEntity],
  );
  const label = relation.label ? truncateLabel(relation.label) : "";
  const dashed = relation.kind === "dependency";
  const stroke = getEdgeStroke(sourceEntity, targetEntity, relation);
  const effectiveOpacity = selected ? 1 : highlighted ? 0.92 : relation.inferred ? 0.54 : 0.78;
  const effectiveWidth = selected ? 2.4 : highlighted ? 2 : 1.55;

  return (
    <g
      aria-hidden="true"
      data-uml-edge
      style={{ cursor: onRelationSelect ? "pointer" : "default" }}
      onClick={(event) => {
        event.stopPropagation();
        onRelationSelect?.(relation);
      }}
    >
      <path
        d={geometry.path}
        fill="none"
        stroke={stroke}
        strokeOpacity={effectiveOpacity}
        strokeWidth={effectiveWidth}
        strokeDasharray={dashed ? "7 4" : undefined}
        strokeLinejoin="miter"
      />

      {relation.kind === "composition" ? (
        <polygon
          points={buildDiamondPoints(geometry.sourceAnchor, geometry.sourceSide)}
          fill={stroke}
          fillOpacity={effectiveOpacity}
          stroke={stroke}
          strokeOpacity={effectiveOpacity}
          strokeWidth={1}
        />
      ) : null}

      {relation.kind === "aggregation" ? (
        <polygon
          points={buildDiamondPoints(geometry.sourceAnchor, geometry.sourceSide)}
          fill={umlCssHsl("--card")}
          stroke={stroke}
          strokeOpacity={effectiveOpacity}
          strokeWidth={1.1}
        />
      ) : null}

      {(relation.kind === "dependency" || relation.kind === "flow") ? (
        <polygon
          points={buildTrianglePoints(geometry.targetAnchor, geometry.targetSide)}
          fill={stroke}
          fillOpacity={effectiveOpacity}
          stroke={stroke}
          strokeOpacity={effectiveOpacity}
          strokeWidth={0.8}
        />
      ) : null}

      {label ? (
        <text
          x={geometry.labelX + geometry.labelDx}
          y={geometry.labelY + geometry.labelDy}
          fill={selected ? umlCssHsl("--foreground") : umlCssHsl("--muted-foreground", 0.92)}
          fontSize={10}
          fontWeight={selected ? 600 : 500}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {label}
        </text>
      ) : null}
    </g>
  );
});

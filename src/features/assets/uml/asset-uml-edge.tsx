import { memo } from "react";
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
  selected?: boolean;
  onRelationSelect?: (relation: UmlAssetRelation) => void;
}

const UML_EDGE_ARROW_ID = "asset-uml-edge-arrow";
const UML_EDGE_COMPOSITION_ID = "asset-uml-edge-composition";
const UML_EDGE_AGGREGATION_ID = "asset-uml-edge-aggregation";

type EdgeGeometry = {
  path: string;
  labelX: number;
  labelY: number;
};

function getEntityCenter(entity: UmlAssetEntity): { x: number; y: number } {
  const size = resolveUmlEntitySize(entity);
  return {
    x: entity.x + (size.width / 2),
    y: entity.y + (size.height / 2),
  };
}

function getConnector(entity: UmlAssetEntity, side: "left" | "right" | "top" | "bottom"): { x: number; y: number } {
  const size = resolveUmlEntitySize(entity);
  if (side === "left") return { x: entity.x, y: entity.y + (size.height / 2) };
  if (side === "right") return { x: entity.x + size.width, y: entity.y + (size.height / 2) };
  if (side === "top") return { x: entity.x + (size.width / 2), y: entity.y };
  return { x: entity.x + (size.width / 2), y: entity.y + size.height };
}

function buildEdgeGeometry(sourceEntity: UmlAssetEntity, targetEntity: UmlAssetEntity): EdgeGeometry {
  const sourceCenter = getEntityCenter(sourceEntity);
  const targetCenter = getEntityCenter(targetEntity);
  const dx = targetCenter.x - sourceCenter.x;
  const horizontal = Math.abs(dx) >= Math.abs(targetCenter.y - sourceCenter.y);
  const start = getConnector(sourceEntity, horizontal ? (dx >= 0 ? "right" : "left") : (targetCenter.y >= sourceCenter.y ? "bottom" : "top"));
  const end = getConnector(targetEntity, horizontal ? (dx >= 0 ? "left" : "right") : (targetCenter.y >= sourceCenter.y ? "top" : "bottom"));

  if (horizontal) {
    const elbowX = start.x + ((end.x - start.x) / 2);
    const points = [
      [start.x, start.y],
      [elbowX, start.y],
      [elbowX, end.y],
      [end.x, end.y],
    ];
    return {
      path: `M ${points[0][0]} ${points[0][1]} L ${points[1][0]} ${points[1][1]} L ${points[2][0]} ${points[2][1]} L ${points[3][0]} ${points[3][1]}`,
      labelX: elbowX,
      labelY: start.y === end.y ? start.y - 8 : Math.min(start.y, end.y) + (Math.abs(end.y - start.y) / 2) - 8,
    };
  }

  const elbowY = start.y + ((end.y - start.y) / 2);
  return {
    path: `M ${start.x} ${start.y} L ${start.x} ${elbowY} L ${end.x} ${elbowY} L ${end.x} ${end.y}`,
    labelX: start.x === end.x ? start.x + 8 : Math.min(start.x, end.x) + (Math.abs(end.x - start.x) / 2),
    labelY: elbowY - 8,
  };
}

function truncateLabel(value: string, maxChars = 22): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars - 1)}…`;
}

export function AssetUmlEdgeDefs(): JSX.Element {
  return (
    <defs>
      <marker
        id={UML_EDGE_ARROW_ID}
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="8"
        markerHeight="8"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill={umlCssHsl("--border")} />
      </marker>
      <marker
        id={UML_EDGE_COMPOSITION_ID}
        viewBox="0 0 14 14"
        refX="2"
        refY="7"
        markerWidth="10"
        markerHeight="10"
        orient="auto-start-reverse"
      >
        <path d="M 0 7 L 7 0 L 14 7 L 7 14 z" fill={umlCssHsl("--border")} stroke={umlCssHsl("--border")} strokeWidth="0.8" />
      </marker>
      <marker
        id={UML_EDGE_AGGREGATION_ID}
        viewBox="0 0 14 14"
        refX="2"
        refY="7"
        markerWidth="10"
        markerHeight="10"
        orient="auto-start-reverse"
      >
        <path d="M 0 7 L 7 0 L 14 7 L 7 14 z" fill={umlCssHsl("--card")} stroke={umlCssHsl("--border")} strokeWidth="1" />
      </marker>
    </defs>
  );
}

export const AssetUmlEdge = memo(function AssetUmlEdge({
  relation,
  sourceEntity,
  targetEntity,
  selected = false,
  onRelationSelect,
}: AssetUmlEdgeProps): JSX.Element {
  const sourceTone = getUmlKindTone(sourceEntity.kind, sourceEntity.status);
  const geometry = buildEdgeGeometry(sourceEntity, targetEntity);
  const label = relation.label ? truncateLabel(relation.label) : "";
  const dashed = relation.kind === "dependency";
  const markerStart = relation.kind === "composition"
    ? `url(#${UML_EDGE_COMPOSITION_ID})`
    : relation.kind === "aggregation"
      ? `url(#${UML_EDGE_AGGREGATION_ID})`
      : undefined;
  const markerEnd = relation.kind === "dependency" || relation.kind === "flow"
    ? `url(#${UML_EDGE_ARROW_ID})`
    : undefined;

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
        stroke={relation.inferred ? umlCssHsl("--muted-foreground", 0.48) : sourceTone.edge}
        strokeWidth={selected ? 2.2 : 1.4}
        strokeDasharray={dashed ? "5 4" : undefined}
        markerStart={markerStart}
        markerEnd={markerEnd}
      />
      {label ? (
        <g transform={`translate(${geometry.labelX},${geometry.labelY})`}>
          <rect
            x={-4}
            y={-10}
            width={(label.length * 6.4) + 8}
            height={14}
            rx={2}
            fill={umlCssHsl("--card")}
            opacity={selected ? 0.98 : 0.92}
          />
          <text x={0} y={0} fill={selected ? sourceTone.text : umlCssHsl("--muted-foreground")} fontSize={10}>
            {label}
          </text>
        </g>
      ) : null}
    </g>
  );
});

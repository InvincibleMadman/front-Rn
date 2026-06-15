export type UmlAssetTone = "default" | "success" | "warning" | "danger" | "info";

export type UmlAssetKind =
  | "catalog"
  | "protocol"
  | "source"
  | "specs"
  | "vuldocs"
  | "kb"
  | "seeds"
  | "risk"
  | "instrumented"
  | "jobs"
  | "crash"
  | "debug"
  | "reports"
  | "vulns"
  | "history"
  | "empty";

export type UmlAssetStatus = "ready" | "available" | "empty" | "degraded" | "running";

export interface UmlAssetAttribute {
  key: string;
  value: string | number;
  muted?: boolean;
  tone?: UmlAssetTone;
}

export interface UmlAssetEntity {
  id: string;
  title: string;
  stereotype?: string;
  subtitle?: string;
  kind: UmlAssetKind;
  status?: UmlAssetStatus;
  attributes: UmlAssetAttribute[];
  x: number;
  y: number;
  width?: number;
  height?: number;
  workspaceRef?: string;
  protocol?: string;
  scope?: string;
}

export type ResolvedUmlAssetEntity = UmlAssetEntity & Required<Pick<UmlAssetEntity, "width" | "height">>;

export interface UmlAssetRelation {
  id: string;
  source: string;
  target: string;
  label?: string;
  kind?: "association" | "dependency" | "composition" | "aggregation" | "flow";
  inferred?: boolean;
  description?: string;
}

export interface UmlDiagramModel {
  entities: UmlAssetEntity[];
  relations: UmlAssetRelation[];
  bounds: { width: number; height: number };
  title?: string;
}

export interface UmlDiagramRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const UML_ENTITY_MAX_ATTRIBUTE_ROWS = 8;
export const UML_ENTITY_ROW_HEIGHT = 18;

const UML_ENTITY_MIN_HEIGHT = 96;

export function getDefaultUmlEntityWidth(kind: UmlAssetKind): number {
  if (kind === "catalog") return 360;
  if (kind === "protocol") return 260;
  return 230;
}

export function getUmlEntityHeaderHeight(entity: Pick<UmlAssetEntity, "stereotype" | "subtitle">): number {
  let height = 38;
  if (entity.stereotype) height += 12;
  if (entity.subtitle) height += 14;
  return height;
}

export function getVisibleUmlAttributes(
  attributes: UmlAssetAttribute[],
  maxRows = UML_ENTITY_MAX_ATTRIBUTE_ROWS,
): { rows: UmlAssetAttribute[]; hiddenCount: number } {
  const rows = attributes.slice(0, maxRows);
  return {
    rows,
    hiddenCount: Math.max(0, attributes.length - rows.length),
  };
}

export function estimateUmlEntityHeight(
  entity: Pick<UmlAssetEntity, "attributes" | "stereotype" | "subtitle">,
  maxRows = UML_ENTITY_MAX_ATTRIBUTE_ROWS,
): number {
  const { rows, hiddenCount } = getVisibleUmlAttributes(entity.attributes, maxRows);
  const rowCount = rows.length + (hiddenCount > 0 ? 1 : 0);
  const height = getUmlEntityHeaderHeight(entity) + 10 + (rowCount * UML_ENTITY_ROW_HEIGHT) + 14;
  return Math.max(UML_ENTITY_MIN_HEIGHT, height);
}

export function resolveUmlEntitySize(entity: UmlAssetEntity): Required<Pick<UmlAssetEntity, "width" | "height">> {
  return {
    width: entity.width ?? getDefaultUmlEntityWidth(entity.kind),
    height: entity.height ?? estimateUmlEntityHeight(entity),
  };
}

export function withResolvedUmlEntitySize(entity: UmlAssetEntity): ResolvedUmlAssetEntity {
  const size = resolveUmlEntitySize(entity);
  return {
    ...entity,
    width: size.width,
    height: size.height,
  };
}

export function getDiagramRect(model: UmlDiagramModel): UmlDiagramRect {
  if (model.entities.length === 0) {
    return {
      x: 0,
      y: 0,
      width: model.bounds.width,
      height: model.bounds.height,
    };
  }

  const sizedEntities = model.entities.map(withResolvedUmlEntitySize);
  const minX = Math.min(...sizedEntities.map((entity) => entity.x));
  const minY = Math.min(...sizedEntities.map((entity) => entity.y));
  const maxX = Math.max(...sizedEntities.map((entity) => entity.x + entity.width));
  const maxY = Math.max(...sizedEntities.map((entity) => entity.y + entity.height));

  return {
    x: minX,
    y: minY,
    width: Math.max(model.bounds.width, maxX - minX),
    height: Math.max(model.bounds.height, maxY - minY),
  };
}

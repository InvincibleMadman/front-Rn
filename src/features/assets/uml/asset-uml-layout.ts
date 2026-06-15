import {
  withResolvedUmlEntitySize,
  type ResolvedUmlAssetEntity,
  type UmlAssetEntity,
  type UmlAssetKind,
  type UmlAssetRelation,
  type UmlDiagramModel,
} from "@/features/assets/uml/asset-uml-types";

const OVERVIEW_PADDING = 32;
const OVERVIEW_COLUMN_GAP = 24;
const OVERVIEW_ROW_GAP = 24;
const OVERVIEW_PROTOCOL_COLUMNS = 4;

const LINEAGE_PADDING = 172;
const LINEAGE_MIN_GAP_X = 96;
const LINEAGE_MIN_GAP_Y = 80;
const LINEAGE_MAX_COLLISION_PASSES = 24;
const LINEAGE_MAX_EXPANSION_PASSES = 3;
const LINEAGE_TARGET_ASPECT = 1.5;
const LINEAGE_MAX_REBALANCE_FACTOR = 1.2;

type LineageColumn = "center" | "leftInner" | "leftOuter" | "rightInner" | "rightOuter";

type PlacedLineageEntity = ResolvedUmlAssetEntity & {
  anchorX: number;
  anchorY: number;
  locked?: boolean;
  slotId?: string;
  column?: LineageColumn;
};

const LINEAGE_KIND_ORDER: UmlAssetKind[] = [
  "protocol",
  "source",
  "specs",
  "vuldocs",
  "kb",
  "seeds",
  "risk",
  "instrumented",
  "jobs",
  "crash",
  "debug",
  "reports",
  "vulns",
  "history",
  "catalog",
  "empty",
];

const LEFT_INNER_KINDS: UmlAssetKind[] = ["specs", "vuldocs", "kb"];
const LEFT_OUTER_KINDS: UmlAssetKind[] = ["reports", "history", "catalog", "empty"];
const RIGHT_INNER_KINDS: UmlAssetKind[] = ["seeds", "risk", "instrumented"];
const RIGHT_OUTER_KINDS: UmlAssetKind[] = ["jobs", "crash", "debug", "vulns"];

const LINEAGE_COLUMN_CENTER_X: Record<Exclude<LineageColumn, "center">, number> = {
  leftInner: -360,
  leftOuter: -630,
  rightInner: 360,
  rightOuter: 630,
};

const LINEAGE_COLUMN_STEP_Y: Record<Exclude<LineageColumn, "center">, number> = {
  leftInner: 160,
  leftOuter: 168,
  rightInner: 160,
  rightOuter: 168,
};

function getBounds(entities: UmlAssetEntity[], padding = OVERVIEW_PADDING): { width: number; height: number } {
  if (entities.length === 0) {
    return { width: padding * 2, height: padding * 2 };
  }

  const sizedEntities = entities.map(withResolvedUmlEntitySize);
  const minX = Math.min(...sizedEntities.map((entity) => entity.x));
  const minY = Math.min(...sizedEntities.map((entity) => entity.y));
  const maxX = Math.max(...sizedEntities.map((entity) => entity.x + entity.width));
  const maxY = Math.max(...sizedEntities.map((entity) => entity.y + entity.height));

  return {
    width: (maxX - minX) + padding,
    height: (maxY - minY) + padding,
  };
}

function resolvedEntity(entity: UmlAssetEntity): ResolvedUmlAssetEntity {
  return withResolvedUmlEntitySize(entity);
}

function createOverviewCatalogEntity(): UmlAssetEntity {
  return {
    id: "catalog:workspace",
    title: "Workspace Asset Catalog",
    stereotype: "<<asset catalog>>",
    kind: "catalog",
    status: "available",
    attributes: [],
    x: 0,
    y: 0,
    width: 360,
  };
}

export function layoutOverviewCatalog(protocolEntities: UmlAssetEntity[]): UmlDiagramModel {
  const existingCatalog = protocolEntities.find((entity) => entity.kind === "catalog");
  const catalog = resolvedEntity(existingCatalog ?? createOverviewCatalogEntity());
  const protocols = protocolEntities
    .filter((entity) => entity.id !== catalog.id)
    .map(resolvedEntity);

  let gridWidth = 0;
  if (protocols.length > 0) {
    const widthsByColumn = Array.from({ length: Math.min(OVERVIEW_PROTOCOL_COLUMNS, protocols.length) }, () => 0);
    protocols.forEach((entity, index) => {
      const column = index % widthsByColumn.length;
      widthsByColumn[column] = Math.max(widthsByColumn[column], entity.width);
    });
    gridWidth = widthsByColumn.reduce((total, value) => total + value, 0) + (Math.max(widthsByColumn.length - 1, 0) * OVERVIEW_COLUMN_GAP);
  }

  const rootX = OVERVIEW_PADDING + Math.max(0, (gridWidth - catalog.width) / 2);
  const rootY = OVERVIEW_PADDING;
  const root = {
    ...catalog,
    x: rootX,
    y: rootY,
  } satisfies ResolvedUmlAssetEntity;

  const columns = Math.max(1, Math.min(OVERVIEW_PROTOCOL_COLUMNS, protocols.length || 1));
  const columnWidths = Array.from({ length: columns }, () => 0);
  protocols.forEach((entity, index) => {
    const column = index % columns;
    columnWidths[column] = Math.max(columnWidths[column], entity.width);
  });

  const columnOffsets = columnWidths.map((_, columnIndex) => {
    let offset = OVERVIEW_PADDING;
    for (let index = 0; index < columnIndex; index += 1) {
      offset += columnWidths[index] + OVERVIEW_COLUMN_GAP;
    }
    return offset;
  });

  const rowHeights = new Map<number, number>();
  protocols.forEach((entity, index) => {
    const row = Math.floor(index / columns);
    rowHeights.set(row, Math.max(rowHeights.get(row) ?? 0, entity.height));
  });

  const rowOffsets = Array.from(rowHeights.keys()).sort((left, right) => left - right).reduce<Map<number, number>>((offsets, row) => {
    const previousRow = row - 1;
    const previousOffset = offsets.get(previousRow) ?? root.y + root.height + 56;
    if (row === 0) {
      offsets.set(row, root.y + root.height + 56);
    } else {
      offsets.set(row, previousOffset + (rowHeights.get(previousRow) ?? 0) + OVERVIEW_ROW_GAP);
    }
    return offsets;
  }, new Map<number, number>());

  const placedProtocols = protocols.map((entity, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return {
      ...entity,
      x: columnOffsets[column],
      y: rowOffsets.get(row) ?? root.y + root.height + 56,
    };
  });

  const relations: UmlAssetRelation[] = placedProtocols.map((entity) => ({
    id: `catalog:${root.id}->${entity.id}`,
    source: root.id,
    target: entity.id,
    label: "contains",
    kind: "composition",
  }));

  const overviewEntities = [root, ...placedProtocols];

  return {
    title: root.title,
    entities: overviewEntities,
    relations,
    bounds: getBounds(overviewEntities),
  };
}

export function estimateEntitySize(entity: UmlAssetEntity): ResolvedUmlAssetEntity {
  return resolvedEntity(entity);
}

export function getEntityBBox(entity: UmlAssetEntity): { x: number; y: number; width: number; height: number } {
  const sized = resolvedEntity(entity);
  return {
    x: sized.x,
    y: sized.y,
    width: sized.width,
    height: sized.height,
  };
}

export function intersects(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
  gapX = LINEAGE_MIN_GAP_X,
  gapY = LINEAGE_MIN_GAP_Y,
): boolean {
  const leftExpanded = {
    x: left.x - (gapX / 2),
    y: left.y - (gapY / 2),
    width: left.width + gapX,
    height: left.height + gapY,
  };
  return !(
    leftExpanded.x + leftExpanded.width <= right.x
    || right.x + right.width <= leftExpanded.x
    || leftExpanded.y + leftExpanded.height <= right.y
    || right.y + right.height <= leftExpanded.y
  );
}

function toCenter(rect: { x: number; y: number; width: number; height: number }): { x: number; y: number } {
  return {
    x: rect.x + (rect.width / 2),
    y: rect.y + (rect.height / 2),
  };
}

function length(x: number, y: number): number {
  return Math.hypot(x, y);
}

function normalizeVector(x: number, y: number): { x: number; y: number } {
  const magnitude = Math.max(length(x, y), 1e-6);
  return {
    x: x / magnitude,
    y: y / magnitude,
  };
}

function getLineageKindOrder(kind: UmlAssetKind): number {
  const index = LINEAGE_KIND_ORDER.indexOf(kind);
  return index >= 0 ? index : LINEAGE_KIND_ORDER.length;
}

function getLineageEntitySortKey(entity: UmlAssetEntity): number {
  if (entity.kind === "protocol") return 0;
  if (entity.kind === "source") return 1;
  return getLineageKindOrder(entity.kind) + 2;
}

function buildBalancedOffsets(count: number, spacing: number): number[] {
  return Array.from({ length: count }, (_, index) => (
    (index - ((count - 1) / 2)) * spacing
  ));
}

function computeLineageBounds(entities: ResolvedUmlAssetEntity[]): { width: number; height: number } {
  if (entities.length === 0) {
    return {
      width: LINEAGE_PADDING * 2,
      height: LINEAGE_PADDING * 2,
    };
  }

  const minX = Math.min(...entities.map((entity) => entity.x));
  const minY = Math.min(...entities.map((entity) => entity.y));
  const maxX = Math.max(...entities.map((entity) => entity.x + entity.width));
  const maxY = Math.max(...entities.map((entity) => entity.y + entity.height));

  return {
    width: (maxX - minX) + (LINEAGE_PADDING * 2),
    height: (maxY - minY) + (LINEAGE_PADDING * 2),
  };
}

function getLineageAnchorCenter(entities: PlacedLineageEntity[]): { x: number; y: number } {
  const protocol = entities.find((entity) => entity.kind === "protocol");
  const source = entities.find((entity) => entity.kind === "source");

  if (protocol && source) {
    return {
      x: ((protocol.x + (protocol.width / 2)) + (source.x + (source.width / 2))) / 2,
      y: ((protocol.y + (protocol.height / 2)) + (source.y + (source.height / 2))) / 2,
    };
  }

  if (protocol) {
    return { x: protocol.x + (protocol.width / 2), y: protocol.y + (protocol.height / 2) };
  }

  if (source) {
    return { x: source.x + (source.width / 2), y: source.y + (source.height / 2) };
  }

  const bounds = computeLineageBounds(entities);
  const minX = Math.min(...entities.map((entity) => entity.x));
  const minY = Math.min(...entities.map((entity) => entity.y));
  return { x: minX + (bounds.width / 2), y: minY + (bounds.height / 2) };
}

function resolveCenterVector(entity: PlacedLineageEntity, centerX: number, centerY: number): { x: number; y: number } {
  const vector = normalizeVector((entity.x + (entity.width / 2)) - centerX, (entity.y + (entity.height / 2)) - centerY);
  if (Number.isNaN(vector.x) || Number.isNaN(vector.y)) {
    return { x: entity.x >= centerX ? 1 : -1, y: entity.y >= centerY ? 0.35 : -0.35 };
  }
  if (Math.abs(vector.x) < 0.1 && Math.abs(vector.y) < 0.1) {
    return { x: entity.x >= centerX ? 1 : -1, y: entity.y >= centerY ? 0.35 : -0.35 };
  }
  return vector;
}

function rebalanceLineageFootprint(entities: PlacedLineageEntity[]): PlacedLineageEntity[] {
  if (entities.length === 0) return entities;

  const minX = Math.min(...entities.map((entity) => entity.x));
  const minY = Math.min(...entities.map((entity) => entity.y));
  const maxX = Math.max(...entities.map((entity) => entity.x + entity.width));
  const maxY = Math.max(...entities.map((entity) => entity.y + entity.height));
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  const aspect = width / height;
  const anchor = getLineageAnchorCenter(entities);

  let factorX = 1;
  let factorY = 1;
  if (aspect > LINEAGE_TARGET_ASPECT) {
    factorY = Math.min(LINEAGE_MAX_REBALANCE_FACTOR, aspect / LINEAGE_TARGET_ASPECT);
  } else if (aspect < (LINEAGE_TARGET_ASPECT * 0.86)) {
    factorX = Math.min(LINEAGE_MAX_REBALANCE_FACTOR, LINEAGE_TARGET_ASPECT / Math.max(aspect, 0.01));
  }

  if (Math.abs(factorX - 1) < 0.02 && Math.abs(factorY - 1) < 0.02) {
    return entities;
  }

  return entities.map((entity) => {
    const centerX = entity.x + (entity.width / 2);
    const centerY = entity.y + (entity.height / 2);
    return {
      ...entity,
      x: anchor.x + ((centerX - anchor.x) * factorX) - (entity.width / 2),
      y: anchor.y + ((centerY - anchor.y) * factorY) - (entity.height / 2),
    };
  });
}

export function resolveUmlEntityCollisions(
  entities: PlacedLineageEntity[],
  centerX = 0,
  centerY = 0,
  minGapX = LINEAGE_MIN_GAP_X,
  minGapY = LINEAGE_MIN_GAP_Y,
): PlacedLineageEntity[] {
  const resolved = entities.map((entity) => ({ ...entity }));

  for (let pass = 0; pass < LINEAGE_MAX_COLLISION_PASSES; pass += 1) {
    let moved = false;

    for (let index = 0; index < resolved.length; index += 1) {
      for (let nextIndex = index + 1; nextIndex < resolved.length; nextIndex += 1) {
        const left = resolved[index];
        const right = resolved[nextIndex];
        if (!intersects(left, right, minGapX, minGapY)) continue;

        const leftCenter = toCenter(left);
        const rightCenter = toCenter(right);
        const dx = rightCenter.x - leftCenter.x;
        const dy = rightCenter.y - leftCenter.y;
        const overlapX = (left.width + right.width) / 2 + minGapX - Math.abs(dx);
        const overlapY = (left.height + right.height) / 2 + minGapY - Math.abs(dy);
        const horizontalDominant = Math.abs(dx) >= Math.abs(dy);
        const leftVector = resolveCenterVector(left, centerX, centerY);
        const rightVector = resolveCenterVector(right, centerX, centerY);
        const dot = (leftVector.x * rightVector.x) + (leftVector.y * rightVector.y);
        const shift = Math.max(overlapX, overlapY, 8) / 2;

        if (left.locked && right.locked) {
          const verticalShift = Math.max(overlapY, 8) / 2;
          right.y += dy >= 0 ? verticalShift : -verticalShift;
          left.y += dy >= 0 ? -verticalShift : verticalShift;
          moved = true;
          continue;
        }

        if (dot > 0.72) {
          if (!left.locked) {
            left.x -= leftVector.x * shift;
            left.y -= leftVector.y * shift * 0.55;
          }
          if (!right.locked) {
            right.x += rightVector.x * shift;
            right.y += rightVector.y * shift * 0.55;
          }
        } else if (horizontalDominant) {
          const verticalShift = Math.max(overlapY, 8) / 2;
          if (!left.locked && !right.locked) {
            left.y -= verticalShift;
            right.y += verticalShift;
          } else if (!left.locked) {
            left.y += dy >= 0 ? -verticalShift : verticalShift;
          } else if (!right.locked) {
            right.y += dy >= 0 ? verticalShift : -verticalShift;
          }
        } else {
          if (!left.locked) {
            left.x -= leftVector.x * shift;
          }
          if (!right.locked) {
            right.x += rightVector.x * shift;
          }
        }

        moved = true;
      }
    }

    if (!moved) break;
  }

  return resolved;
}

function resolveLineageColumn(kind: UmlAssetKind, leftLoad: number, rightLoad: number): Exclude<LineageColumn, "center"> {
  if (LEFT_INNER_KINDS.includes(kind)) return "leftInner";
  if (LEFT_OUTER_KINDS.includes(kind)) return "leftOuter";
  if (RIGHT_INNER_KINDS.includes(kind)) return "rightInner";
  if (RIGHT_OUTER_KINDS.includes(kind)) return "rightOuter";
  return leftLoad <= rightLoad ? "leftOuter" : "rightOuter";
}

function assignSlots(
  entities: ResolvedUmlAssetEntity[],
  scale: number,
): PlacedLineageEntity[] {
  const ordered = [...entities].sort((left, right) => getLineageEntitySortKey(left) - getLineageEntitySortKey(right));
  const grouped = {
    leftInner: [] as ResolvedUmlAssetEntity[],
    leftOuter: [] as ResolvedUmlAssetEntity[],
    rightInner: [] as ResolvedUmlAssetEntity[],
    rightOuter: [] as ResolvedUmlAssetEntity[],
  };

  let leftLoad = 0;
  let rightLoad = 0;
  ordered.forEach((entity) => {
    if (entity.kind === "protocol" || entity.kind === "source") return;
    const column = resolveLineageColumn(entity.kind, leftLoad, rightLoad);
    grouped[column].push(entity);
    if (column.startsWith("left")) {
      leftLoad += 1;
    } else {
      rightLoad += 1;
    }
  });

  const offsetsByColumn = {
    leftInner: buildBalancedOffsets(grouped.leftInner.length, LINEAGE_COLUMN_STEP_Y.leftInner * scale),
    leftOuter: buildBalancedOffsets(grouped.leftOuter.length, LINEAGE_COLUMN_STEP_Y.leftOuter * scale),
    rightInner: buildBalancedOffsets(grouped.rightInner.length, LINEAGE_COLUMN_STEP_Y.rightInner * scale),
    rightOuter: buildBalancedOffsets(grouped.rightOuter.length, LINEAGE_COLUMN_STEP_Y.rightOuter * scale),
  };

  const indexByColumn = {
    leftInner: 0,
    leftOuter: 0,
    rightInner: 0,
    rightOuter: 0,
  };

  const placed: PlacedLineageEntity[] = [];
  ordered.forEach((entity) => {
    if (entity.kind === "protocol") {
      const protocolY = -126;
      placed.push({
        ...entity,
        x: -(entity.width / 2),
        y: protocolY - (entity.height / 2),
        anchorX: 0,
        anchorY: protocolY,
        locked: true,
        slotId: "protocol",
        column: "center",
      });
      return;
    }

    if (entity.kind === "source") {
      const sourceY = 118;
      placed.push({
        ...entity,
        x: -(entity.width / 2),
        y: sourceY - (entity.height / 2),
        anchorX: 0,
        anchorY: sourceY,
        locked: true,
        slotId: "source",
        column: "center",
      });
      return;
    }

    const column = resolveLineageColumn(entity.kind, leftLoad, rightLoad);
    const columnIndex = indexByColumn[column];
    indexByColumn[column] += 1;
    const anchorX = LINEAGE_COLUMN_CENTER_X[column] * scale;
    const anchorY = offsetsByColumn[column][columnIndex] ?? 0;

    placed.push({
      ...entity,
      x: anchorX - (entity.width / 2),
      y: anchorY - (entity.height / 2),
      anchorX,
      anchorY,
      locked: false,
      slotId: `${column}:${columnIndex}`,
      column,
    });
  });

  return placed;
}

function hasCollisions(entities: ResolvedUmlAssetEntity[]): boolean {
  for (let index = 0; index < entities.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < entities.length; nextIndex += 1) {
      if (intersects(entities[index], entities[nextIndex], LINEAGE_MIN_GAP_X, LINEAGE_MIN_GAP_Y)) {
        return true;
      }
    }
  }
  return false;
}

function layoutWithExpansion(entities: ResolvedUmlAssetEntity[]): PlacedLineageEntity[] {
  let scale = 1;
  let placed: PlacedLineageEntity[] = [];

  for (let pass = 0; pass < LINEAGE_MAX_EXPANSION_PASSES; pass += 1) {
    placed = resolveUmlEntityCollisions(assignSlots(entities, scale), 0, 0, LINEAGE_MIN_GAP_X, LINEAGE_MIN_GAP_Y);
    placed = resolveUmlEntityCollisions(rebalanceLineageFootprint(placed), 0, 0, LINEAGE_MIN_GAP_X, LINEAGE_MIN_GAP_Y);
    if (!hasCollisions(placed)) break;
    scale *= 1.08;
  }

  return placed;
}

export function layoutProtocolSmartUmlLineage(
  protocol: string,
  assetEntities: UmlAssetEntity[],
  relations: UmlAssetRelation[],
): UmlDiagramModel {
  const sizedEntities = assetEntities.map(resolvedEntity);
  const placed = layoutWithExpansion(sizedEntities);
  const actualEntities = placed.map(({ anchorX, anchorY, locked, slotId, column, ...entity }) => entity);

  return {
    title: `${protocol} smart lineage`,
    entities: actualEntities,
    relations,
    bounds: computeLineageBounds(actualEntities),
  };
}

export function layoutProtocolLineage(
  protocol: string,
  assetEntities: UmlAssetEntity[],
  relations: UmlAssetRelation[],
): UmlDiagramModel {
  return layoutProtocolSmartUmlLineage(protocol, assetEntities, relations);
}

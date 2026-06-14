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

const LINEAGE_PADDING = 152;
const LINEAGE_CENTER_X = 1120;
const LINEAGE_CENTER_Y = 760;
const LINEAGE_MIN_GAP_X = 92;
const LINEAGE_MIN_GAP_Y = 74;

type RadialSlot = {
  x: number;
  y: number;
};

type RadialBucket = {
  primary: RadialSlot;
  fallback?: RadialSlot;
};

const RADIAL_SLOTS: Record<string, RadialBucket> = {
  protocol: {
    primary: { x: LINEAGE_CENTER_X - 148, y: LINEAGE_CENTER_Y - 188 },
  },
  source: {
    primary: { x: LINEAGE_CENTER_X - 92, y: LINEAGE_CENTER_Y + 12 },
  },
  specs: {
    primary: { x: LINEAGE_CENTER_X - 458, y: LINEAGE_CENTER_Y - 372 },
  },
  vuldocs: {
    primary: { x: LINEAGE_CENTER_X - 626, y: LINEAGE_CENTER_Y - 214 },
  },
  kb: {
    primary: { x: LINEAGE_CENTER_X - 496, y: LINEAGE_CENTER_Y - 66 },
  },
  seeds: {
    primary: { x: LINEAGE_CENTER_X + 226, y: LINEAGE_CENTER_Y - 348 },
  },
  risk: {
    primary: { x: LINEAGE_CENTER_X + 406, y: LINEAGE_CENTER_Y - 194 },
  },
  instrumented: {
    primary: { x: LINEAGE_CENTER_X + 612, y: LINEAGE_CENTER_Y - 18 },
  },
  jobs: {
    primary: { x: LINEAGE_CENTER_X + 748, y: LINEAGE_CENTER_Y + 132 },
  },
  crash: {
    primary: { x: LINEAGE_CENTER_X + 702, y: LINEAGE_CENTER_Y + 358 },
  },
  debug: {
    primary: { x: LINEAGE_CENTER_X + 446, y: LINEAGE_CENTER_Y + 498 },
  },
  reports: {
    primary: { x: LINEAGE_CENTER_X - 26, y: LINEAGE_CENTER_Y + 516 },
  },
  vulns: {
    primary: { x: LINEAGE_CENTER_X - 454, y: LINEAGE_CENTER_Y + 446 },
  },
  history: {
    primary: { x: LINEAGE_CENTER_X - 624, y: LINEAGE_CENTER_Y + 286 },
  },
  empty: {
    primary: { x: LINEAGE_CENTER_X - 602, y: LINEAGE_CENTER_Y + 556 },
  },
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

  const entities = [root, ...placedProtocols];

  return {
    title: root.title,
    entities,
    relations,
    bounds: getBounds(entities),
  };
}

export function estimateEntitySize(entity: UmlAssetEntity): ResolvedUmlAssetEntity {
  return resolvedEntity(entity);
}

function overlaps(left: ResolvedUmlAssetEntity, right: ResolvedUmlAssetEntity, minGapX: number, minGapY: number): boolean {
  const leftRight = left.x + left.width + minGapX;
  const rightRight = right.x + right.width + minGapX;
  const leftBottom = left.y + left.height + minGapY;
  const rightBottom = right.y + right.height + minGapY;

  return left.x < rightRight
    && leftRight > right.x
    && left.y < rightBottom
    && leftBottom > right.y;
}

export function resolveRadialCollisions(
  entities: ResolvedUmlAssetEntity[],
  minGapX = LINEAGE_MIN_GAP_X,
  minGapY = LINEAGE_MIN_GAP_Y,
): ResolvedUmlAssetEntity[] {
  const sorted = [...entities].sort((left, right) => {
    if (left.y !== right.y) return left.y - right.y;
    return left.x - right.x;
  });

  for (let pass = 0; pass < 8; pass += 1) {
    let moved = false;

    for (let index = 0; index < sorted.length; index += 1) {
      for (let nextIndex = index + 1; nextIndex < sorted.length; nextIndex += 1) {
        const left = sorted[index];
        const right = sorted[nextIndex];
        if (!overlaps(left, right, minGapX, minGapY)) continue;

        const leftCenterX = left.x + (left.width / 2);
        const rightCenterX = right.x + (right.width / 2);
        const leftCenterY = left.y + (left.height / 2);
        const rightCenterY = right.y + (right.height / 2);
        const moveHorizontally = Math.abs(rightCenterX - leftCenterX) >= Math.abs(rightCenterY - leftCenterY);

        if (moveHorizontally) {
          const shift = ((left.width + right.width) / 2) + minGapX - Math.abs(rightCenterX - leftCenterX);
          if (rightCenterX >= leftCenterX) {
            right.x += shift;
          } else {
            right.x -= shift;
          }
        } else {
          const shift = ((left.height + right.height) / 2) + minGapY - Math.abs(rightCenterY - leftCenterY);
          if (rightCenterY >= leftCenterY) {
            right.y += shift;
          } else {
            right.y -= shift;
          }
        }

        moved = true;
      }
    }

    if (!moved) break;
  }

  return sorted;
}

function getRadialSlot(entity: ResolvedUmlAssetEntity, protocol: string): RadialSlot {
  if (entity.id === `protocol:${protocol}` || entity.kind === "protocol") {
    return RADIAL_SLOTS.protocol.primary;
  }

  const key = entity.scope ?? entity.kind;
  return RADIAL_SLOTS[key]?.primary ?? RADIAL_SLOTS.empty.primary;
}

function normalizeLineageEntityOrder(entity: UmlAssetEntity): number {
  const order = [
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
  ];
  const key = entity.scope ?? entity.kind;
  const index = order.indexOf(key);
  return index >= 0 ? index : order.length + 1;
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

export function layoutProtocolLineage(
  protocol: string,
  assetEntities: UmlAssetEntity[],
  relations: UmlAssetRelation[],
): UmlDiagramModel {
  const sizedEntities = assetEntities
    .map(resolvedEntity)
    .sort((left, right) => normalizeLineageEntityOrder(left) - normalizeLineageEntityOrder(right));

  const sectorUsage = new Map<string, number>();
  const placed = sizedEntities.map((entity) => {
    const slotKey = entity.scope ?? entity.kind;
    const slot = getRadialSlot(entity, protocol);
    const usage = sectorUsage.get(slotKey) ?? 0;
    sectorUsage.set(slotKey, usage + 1);

    return {
      ...entity,
      x: slot.x + (usage % 2 === 0 ? 0 : 34),
      y: slot.y + (usage * 30),
    };
  });

  const resolved = resolveRadialCollisions(placed, LINEAGE_MIN_GAP_X, LINEAGE_MIN_GAP_Y);

  return {
    title: `${protocol} radial lineage`,
    entities: resolved,
    relations,
    bounds: computeLineageBounds(resolved),
  };
}

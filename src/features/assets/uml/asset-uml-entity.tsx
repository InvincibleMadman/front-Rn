import { memo } from "react";
import { getUmlKindTone } from "@/features/assets/uml/asset-uml-theme";
import {
  getUmlEntityHeaderHeight,
  getVisibleUmlAttributes,
  resolveUmlEntitySize,
  type UmlAssetAttribute,
  type UmlAssetEntity,
} from "@/features/assets/uml/asset-uml-types";

interface AssetUmlEntityProps {
  entity: UmlAssetEntity;
  selected?: boolean;
  onEntitySelect?: (entity: UmlAssetEntity) => void;
}

function truncateText(value: string | number, maxChars: number): string {
  const text = String(value ?? "").trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(4, maxChars - 1))}…`;
}

function getAttributeColor(attribute: UmlAssetAttribute): string | undefined {
  if (attribute.tone === "success") return "hsl(var(--chart-3))";
  if (attribute.tone === "warning") return "hsl(var(--accent-orange))";
  if (attribute.tone === "danger") return "hsl(var(--chart-4))";
  if (attribute.tone === "info") return "hsl(var(--accent-blue))";
  if (attribute.muted) return "hsl(var(--muted-foreground))";
  return undefined;
}

export const AssetUmlEntity = memo(function AssetUmlEntity({
  entity,
  selected = false,
  onEntitySelect,
}: AssetUmlEntityProps): JSX.Element {
  const size = resolveUmlEntitySize(entity);
  const tone = getUmlKindTone(entity.kind, entity.status);
  const headerHeight = getUmlEntityHeaderHeight(entity);
  const contentWidth = size.width - 22;
  const rowYStart = headerHeight + 18;
  const rowX = 12;
  const separatorY = headerHeight;
  const titleMaxChars = Math.max(16, Math.floor((contentWidth - 16) / 7.2));
  const subtitleMaxChars = Math.max(14, Math.floor(contentWidth / 7.2));
  const attributeMaxChars = Math.max(18, Math.floor(contentWidth / 6.2));
  const visible = getVisibleUmlAttributes(entity.attributes);
  const rows = [...visible.rows];

  if (visible.hiddenCount > 0) {
    rows.push({
      key: "+more",
      value: `+${visible.hiddenCount} more`,
      muted: true,
    });
  }

  return (
    <g
      transform={`translate(${entity.x},${entity.y})`}
      data-uml-entity
      role="button"
      tabIndex={0}
      style={{ cursor: onEntitySelect ? "pointer" : "default" }}
      onClick={(event) => {
        event.stopPropagation();
        onEntitySelect?.(entity);
      }}
      onKeyDown={(event) => {
        if (!onEntitySelect) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onEntitySelect(entity);
      }}
    >
      <rect
        x={0}
        y={0}
        width={size.width}
        height={size.height}
        rx={2}
        fill={tone.bodyFill}
        stroke={selected ? tone.accent : tone.border}
        strokeWidth={selected ? 2 : 1.2}
      />
      <rect x={0} y={0} width={size.width} height={headerHeight} rx={2} fill={tone.headerFill} />
      {selected ? <rect x={0} y={0} width={4} height={size.height} rx={1} fill={tone.accent} /> : null}
      <line x1={0} y1={separatorY} x2={size.width} y2={separatorY} stroke={tone.border} strokeWidth={1} />

      {entity.stereotype ? (
        <text x={12} y={16} fill={tone.mutedText} fontSize={10} fontWeight={600}>
          {truncateText(entity.stereotype, titleMaxChars)}
        </text>
      ) : null}

      <text x={12} y={entity.stereotype ? 33 : 24} fill={tone.text} fontSize={13} fontWeight={700}>
        {truncateText(entity.title, titleMaxChars)}
      </text>

      {entity.subtitle ? (
        <text x={12} y={headerHeight - 10} fill={tone.mutedText} fontSize={10.5}>
          {truncateText(entity.subtitle, subtitleMaxChars)}
        </text>
      ) : null}

      {rows.map((attribute, index) => {
        const rowY = rowYStart + (index * 18);
        const valueColor = getAttributeColor(attribute) ?? tone.text;
        const fullText = attribute.key === "+more"
          ? truncateText(attribute.value, attributeMaxChars)
          : `${attribute.key}: ${attribute.value}`;

        return (
          <text
            key={`${entity.id}:${attribute.key}:${index}`}
            x={rowX}
            y={rowY}
            fill={attribute.key === "+more" ? tone.mutedText : valueColor}
            fontSize={10.5}
          >
            {truncateText(fullText, attributeMaxChars)}
          </text>
        );
      })}
    </g>
  );
});

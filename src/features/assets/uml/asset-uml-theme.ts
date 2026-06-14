import type { UmlAssetKind, UmlAssetStatus } from "@/features/assets/uml/asset-uml-types";

export interface UmlKindTone {
  headerFill: string;
  bodyFill: string;
  border: string;
  text: string;
  mutedText: string;
  accent: string;
  edge: string;
}

export function umlCssHsl(variableName: string, alpha?: number): string {
  return alpha === undefined
    ? `hsl(var(${variableName}))`
    : `hsl(var(${variableName}) / ${alpha})`;
}

function getKindColorToken(kind: UmlAssetKind): string {
  switch (kind) {
    case "catalog":
      return "--accent-blue";
    case "protocol":
      return "--chart-1";
    case "source":
    case "specs":
    case "seeds":
    case "jobs":
    case "reports":
      return "--chart-2";
    case "risk":
    case "crash":
    case "vulns":
      return kind === "vulns" ? "--chart-4" : "--accent-orange";
    case "kb":
    case "vuldocs":
    case "debug":
      return "--chart-5";
    case "instrumented":
      return "--chart-3";
    case "history":
      return "--chart-4";
    case "empty":
      return "--muted-foreground";
    default:
      return "--chart-3";
  }
}

export function getUmlKindTone(kind: UmlAssetKind, status: UmlAssetStatus = "available"): UmlKindTone {
  if (status === "empty" || kind === "empty") {
    return {
      headerFill: umlCssHsl("--background"),
      bodyFill: umlCssHsl("--card"),
      border: umlCssHsl("--border"),
      text: umlCssHsl("--muted-foreground"),
      mutedText: umlCssHsl("--muted-foreground", 0.84),
      accent: umlCssHsl("--muted-foreground", 0.46),
      edge: umlCssHsl("--muted-foreground", 0.42),
    };
  }

  const baseToken = getKindColorToken(kind);
  const accentToken = status === "running" ? "--accent-blue" : status === "degraded" ? "--accent-orange" : baseToken;
  const accent = umlCssHsl(accentToken);
  const isAlertKind = kind === "risk" || kind === "crash" || kind === "vulns";
  const isCoreKind = kind === "protocol" || kind === "source" || kind === "specs";
  const isSupportKind = kind === "kb" || kind === "vuldocs" || kind === "debug" || kind === "reports" || kind === "history";
  const headerAlpha = status === "degraded"
    ? 0.28
    : isAlertKind
      ? 0.26
      : isCoreKind
        ? 0.24
        : isSupportKind
          ? 0.22
          : kind === "catalog"
            ? 0.2
            : 0.2;
  const bodyAlpha = isAlertKind ? 0.12 : isCoreKind ? 0.08 : 0.06;
  const borderAlpha = status === "degraded" ? 0.72 : isAlertKind ? 0.7 : isCoreKind ? 0.64 : 0.58;

  return {
    headerFill: umlCssHsl(accentToken, headerAlpha),
    bodyFill: `color-mix(in oklab, ${umlCssHsl("--card")} 92%, ${umlCssHsl(accentToken, bodyAlpha)})`,
    border: umlCssHsl(accentToken, borderAlpha),
    text: umlCssHsl("--foreground"),
    mutedText: umlCssHsl("--muted-foreground"),
    accent,
    edge: umlCssHsl(accentToken, isAlertKind ? 0.68 : 0.6),
  };
}

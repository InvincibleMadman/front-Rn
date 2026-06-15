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

type ToneConfig = {
  token: string;
  bodyToken?: string;
  borderToken?: string;
  accentToken?: string;
  edgeToken?: string;
  headerLight: number;
  headerDark: number;
  bodyLight: number;
  bodyDark: number;
  borderLight: number;
  borderDark: number;
  edgeLight: number;
  edgeDark: number;
};

function isDarkTheme(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

export function umlCssHsl(variableName: string, alpha?: number): string {
  return alpha === undefined ? `hsl(var(${variableName}))` : `hsl(var(${variableName}) / ${alpha})`;
}

function toneFill(variableName: string, alpha: number): string {
  return umlCssHsl(variableName, alpha);
}

function makeTone(config: ToneConfig, status: UmlAssetStatus): UmlKindTone {
  const dark = isDarkTheme();
  const isAlert = status === "degraded";
  const headerAlpha = dark ? config.headerDark : config.headerLight;
  const bodyAlpha = dark ? config.bodyDark : config.bodyLight;
  const borderAlpha = dark ? config.borderDark : config.borderLight;
  const edgeAlpha = dark ? config.edgeDark : config.edgeLight;
  const headerBoost = status === "running" ? 0.02 : isAlert ? 0.03 : 0;
  const bodyBoost = status === "running" ? 0.015 : isAlert ? 0.02 : 0;
  const borderBoost = status === "running" ? 0.05 : isAlert ? 0.08 : 0;
  const edgeBoost = status === "running" ? 0.04 : isAlert ? 0.08 : 0;

  return {
    headerFill: toneFill(config.token, Math.min(0.3, headerAlpha + headerBoost)),
    bodyFill: toneFill(config.bodyToken ?? config.token, Math.min(0.2, bodyAlpha + bodyBoost)),
    border: toneFill(config.borderToken ?? config.token, Math.min(0.7, borderAlpha + borderBoost)),
    text: umlCssHsl("--foreground"),
    mutedText: umlCssHsl("--muted-foreground"),
    accent: umlCssHsl(config.accentToken ?? config.token),
    edge: toneFill(config.edgeToken ?? config.borderToken ?? config.token, Math.min(0.74, edgeAlpha + edgeBoost)),
  };
}

const UML_KIND_TONES: Record<UmlAssetKind, ToneConfig> = {
  catalog: {
    token: "--accent-blue",
    bodyToken: "--accent-blue",
    borderToken: "--accent-blue",
    accentToken: "--accent-blue",
    edgeToken: "--accent-blue",
    headerLight: 0.17,
    headerDark: 0.22,
    bodyLight: 0.11,
    bodyDark: 0.16,
    borderLight: 0.36,
    borderDark: 0.46,
    edgeLight: 0.42,
    edgeDark: 0.54,
  },
  protocol: {
    token: "--accent-blue",
    bodyToken: "--accent-blue",
    borderToken: "--accent-blue",
    accentToken: "--accent-blue",
    edgeToken: "--accent-blue",
    headerLight: 0.18,
    headerDark: 0.23,
    bodyLight: 0.12,
    bodyDark: 0.17,
    borderLight: 0.38,
    borderDark: 0.5,
    edgeLight: 0.44,
    edgeDark: 0.56,
  },
  source: {
    token: "--success",
    bodyToken: "--success",
    borderToken: "--success",
    accentToken: "--success",
    edgeToken: "--success",
    headerLight: 0.17,
    headerDark: 0.22,
    bodyLight: 0.12,
    bodyDark: 0.17,
    borderLight: 0.38,
    borderDark: 0.5,
    edgeLight: 0.44,
    edgeDark: 0.56,
  },
  specs: {
    token: "--accent-blue",
    bodyToken: "--accent-blue",
    borderToken: "--accent-blue",
    accentToken: "--accent-blue",
    edgeToken: "--accent-blue",
    headerLight: 0.16,
    headerDark: 0.21,
    bodyLight: 0.11,
    bodyDark: 0.16,
    borderLight: 0.38,
    borderDark: 0.5,
    edgeLight: 0.44,
    edgeDark: 0.56,
  },
  vuldocs: {
    token: "--accent-pink",
    bodyToken: "--accent-pink",
    borderToken: "--accent-pink",
    accentToken: "--accent-pink",
    edgeToken: "--accent-pink",
    headerLight: 0.16,
    headerDark: 0.21,
    bodyLight: 0.11,
    bodyDark: 0.15,
    borderLight: 0.36,
    borderDark: 0.48,
    edgeLight: 0.42,
    edgeDark: 0.54,
  },
  kb: {
    token: "--accent-pink",
    bodyToken: "--accent-pink",
    borderToken: "--accent-pink",
    accentToken: "--accent-pink",
    edgeToken: "--accent-pink",
    headerLight: 0.17,
    headerDark: 0.22,
    bodyLight: 0.12,
    bodyDark: 0.16,
    borderLight: 0.38,
    borderDark: 0.48,
    edgeLight: 0.44,
    edgeDark: 0.54,
  },
  seeds: {
    token: "--success",
    bodyToken: "--success",
    borderToken: "--success",
    accentToken: "--success",
    edgeToken: "--success",
    headerLight: 0.17,
    headerDark: 0.22,
    bodyLight: 0.12,
    bodyDark: 0.17,
    borderLight: 0.38,
    borderDark: 0.5,
    edgeLight: 0.44,
    edgeDark: 0.56,
  },
  risk: {
    token: "--accent-orange",
    bodyToken: "--accent-orange",
    borderToken: "--accent-orange",
    accentToken: "--accent-orange",
    edgeToken: "--accent-orange",
    headerLight: 0.2,
    headerDark: 0.26,
    bodyLight: 0.13,
    bodyDark: 0.18,
    borderLight: 0.5,
    borderDark: 0.66,
    edgeLight: 0.58,
    edgeDark: 0.72,
  },
  instrumented: {
    token: "--accent-blue",
    bodyToken: "--accent-blue",
    borderToken: "--accent-blue",
    accentToken: "--accent-blue",
    edgeToken: "--accent-blue",
    headerLight: 0.16,
    headerDark: 0.21,
    bodyLight: 0.11,
    bodyDark: 0.16,
    borderLight: 0.38,
    borderDark: 0.5,
    edgeLight: 0.44,
    edgeDark: 0.56,
  },
  jobs: {
    token: "--accent-blue",
    bodyToken: "--chart-6",
    borderToken: "--accent-blue",
    accentToken: "--accent-blue",
    edgeToken: "--accent-blue",
    headerLight: 0.16,
    headerDark: 0.21,
    bodyLight: 0.11,
    bodyDark: 0.16,
    borderLight: 0.36,
    borderDark: 0.48,
    edgeLight: 0.42,
    edgeDark: 0.54,
  },
  crash: {
    token: "--accent-orange",
    bodyToken: "--accent-orange",
    borderToken: "--accent-orange",
    accentToken: "--accent-orange",
    edgeToken: "--accent-orange",
    headerLight: 0.21,
    headerDark: 0.27,
    bodyLight: 0.14,
    bodyDark: 0.19,
    borderLight: 0.54,
    borderDark: 0.7,
    edgeLight: 0.6,
    edgeDark: 0.76,
  },
  debug: {
    token: "--accent-blue",
    bodyToken: "--accent-blue",
    borderToken: "--accent-blue",
    accentToken: "--accent-blue",
    edgeToken: "--accent-blue",
    headerLight: 0.16,
    headerDark: 0.21,
    bodyLight: 0.11,
    bodyDark: 0.16,
    borderLight: 0.38,
    borderDark: 0.5,
    edgeLight: 0.44,
    edgeDark: 0.56,
  },
  reports: {
    token: "--accent-blue",
    bodyToken: "--accent-blue",
    borderToken: "--accent-blue",
    accentToken: "--accent-blue",
    edgeToken: "--accent-blue",
    headerLight: 0.16,
    headerDark: 0.21,
    bodyLight: 0.11,
    bodyDark: 0.16,
    borderLight: 0.36,
    borderDark: 0.48,
    edgeLight: 0.42,
    edgeDark: 0.54,
  },
  vulns: {
    token: "--danger",
    bodyToken: "--danger",
    borderToken: "--danger",
    accentToken: "--danger",
    edgeToken: "--danger",
    headerLight: 0.18,
    headerDark: 0.24,
    bodyLight: 0.12,
    bodyDark: 0.17,
    borderLight: 0.42,
    borderDark: 0.54,
    edgeLight: 0.48,
    edgeDark: 0.6,
  },
  history: {
    token: "--muted-foreground",
    bodyToken: "--card",
    borderToken: "--accent-blue",
    accentToken: "--accent-blue",
    edgeToken: "--accent-blue",
    headerLight: 0.12,
    headerDark: 0.16,
    bodyLight: 0.1,
    bodyDark: 0.14,
    borderLight: 0.36,
    borderDark: 0.54,
    edgeLight: 0.42,
    edgeDark: 0.58,
  },
  empty: {
    token: "--muted-foreground",
    bodyToken: "--muted-foreground",
    borderToken: "--border",
    accentToken: "--muted-foreground",
    edgeToken: "--muted-foreground",
    headerLight: 0.09,
    headerDark: 0.14,
    bodyLight: 0.05,
    bodyDark: 0.08,
    borderLight: 0.26,
    borderDark: 0.34,
    edgeLight: 0.3,
    edgeDark: 0.38,
  },
};

export function getUmlKindTone(kind: UmlAssetKind, status: UmlAssetStatus = "available"): UmlKindTone {
  if (kind === "empty") {
    return {
      headerFill: umlCssHsl("--muted-foreground", isDarkTheme() ? 0.12 : 0.08),
      bodyFill: umlCssHsl("--muted-foreground", isDarkTheme() ? 0.11 : 0.09),
      border: umlCssHsl("--border", isDarkTheme() ? 0.52 : 0.34),
      text: umlCssHsl("--muted-foreground"),
      mutedText: umlCssHsl("--muted-foreground", 0.9),
      accent: umlCssHsl("--muted-foreground", 0.72),
      edge: umlCssHsl("--muted-foreground", isDarkTheme() ? 0.4 : 0.3),
    };
  }

  if (status === "empty") {
    const tone = makeTone(UML_KIND_TONES[kind], status);
    return {
      ...tone,
      headerFill: umlCssHsl(UML_KIND_TONES[kind].token, isDarkTheme() ? 0.12 : 0.09),
      bodyFill: umlCssHsl(UML_KIND_TONES[kind].bodyToken ?? UML_KIND_TONES[kind].token, isDarkTheme() ? 0.1 : 0.08),
      border: umlCssHsl(UML_KIND_TONES[kind].borderToken ?? UML_KIND_TONES[kind].token, isDarkTheme() ? 0.3 : 0.22),
      text: umlCssHsl("--muted-foreground"),
      edge: umlCssHsl(UML_KIND_TONES[kind].edgeToken ?? UML_KIND_TONES[kind].token, isDarkTheme() ? 0.32 : 0.24),
    };
  }

  return makeTone(UML_KIND_TONES[kind], status);
}

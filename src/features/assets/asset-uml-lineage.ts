import type { ProtocolAssetSummary } from "@/types/api/assets";
import type { AssetGraphModel } from "@/features/assets/asset-utils";
import { buildWorkspaceRef, normalizeProtocol } from "@/features/assets/asset-utils";
import { layoutProtocolSmartUmlLineage } from "@/features/assets/uml/asset-uml-layout";
import type {
  UmlAssetEntity,
  UmlAssetRelation,
  UmlAssetStatus,
  UmlDiagramModel,
} from "@/features/assets/uml/asset-uml-types";

interface CountSnapshot {
  source: number;
  specs: number;
  vuldocs: number;
  kb: number;
  seeds: number;
  risk: number;
  instrumented: number;
  jobs: number;
  crash: number;
  debug: number;
  reports: number;
  vulns: number;
  history: number;
}

function countOf(model: AssetGraphModel, key: keyof CountSnapshot): number {
  if (key === "crash") {
    return Math.max(0, model.counts.crash ?? model.counts.vulns ?? 0);
  }

  if (key === "history") {
    return Math.max(0, model.counts.vulns ?? 0);
  }

  return Math.max(0, model.counts[key] ?? 0);
}

function statusOf(
  model: AssetGraphModel,
  key: keyof CountSnapshot | "protocol",
  fallbackReady = false,
): UmlAssetStatus {
  const raw = String(model.statuses[key] ?? "").trim().toLowerCase();
  if (raw === "ready" || raw === "available" || raw === "empty" || raw === "degraded" || raw === "running") {
    return raw;
  }

  if (key === "protocol") {
    return fallbackReady || Object.values(model.counts).some((value) => Number(value) > 0) ? "ready" : "empty";
  }

  return countOf(model, key) > 0
    ? (fallbackReady && key === "source" ? "ready" : "available")
    : "empty";
}

function createEntity(partial: Omit<UmlAssetEntity, "x" | "y">): UmlAssetEntity {
  return {
    ...partial,
    x: 0,
    y: 0,
  };
}

function hasNonZeroRenderableAttributeValue(value: string | number): boolean {
  if (typeof value === "number") {
    return Number.isFinite(value) && value !== 0;
  }

  const trimmed = String(value ?? "").trim();
  if (!trimmed) return false;
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) && numeric !== 0;
}

function filterRenderableLineageEntities(protocol: string, entities: UmlAssetEntity[]): UmlAssetEntity[] {
  if (normalizeProtocol(protocol) === "legacy-default") {
    return entities;
  }

  return entities.filter((entity) => entity.attributes.some((attribute) => hasNonZeroRenderableAttributeValue(attribute.value)));
}

function buildCounts(model: AssetGraphModel): CountSnapshot {
  return {
    source: countOf(model, "source"),
    specs: countOf(model, "specs"),
    vuldocs: countOf(model, "vuldocs"),
    kb: countOf(model, "kb"),
    seeds: countOf(model, "seeds"),
    risk: countOf(model, "risk"),
    instrumented: countOf(model, "instrumented"),
    jobs: countOf(model, "jobs"),
    crash: countOf(model, "crash"),
    debug: countOf(model, "debug"),
    reports: countOf(model, "reports"),
    vulns: countOf(model, "vulns"),
    history: countOf(model, "history"),
  };
}

function buildProtocolAssetEntities(
  protocol: string,
  model: AssetGraphModel,
  summary?: ProtocolAssetSummary | null,
): UmlAssetEntity[] {
  const normalizedProtocol = normalizeProtocol(protocol);
  const counts = buildCounts(model);
  const protocolStatus = statusOf(model, "protocol", summary?.ready);
  const sourceRef = buildWorkspaceRef(normalizedProtocol, "source");
  const specsRef = buildWorkspaceRef(normalizedProtocol, "specs");
  const vuldocsRef = buildWorkspaceRef(normalizedProtocol, "vuldocs");
  const kbRef = buildWorkspaceRef(normalizedProtocol, "kb");
  const seedsRef = buildWorkspaceRef(normalizedProtocol, "seeds");
  const riskRef = buildWorkspaceRef(normalizedProtocol, "risk");
  const buildRef = buildWorkspaceRef(normalizedProtocol, "build");
  const jobsRef = buildWorkspaceRef(normalizedProtocol, "jobs");
  const debugRef = buildWorkspaceRef(normalizedProtocol, "debug");
  const reportsRef = buildWorkspaceRef(normalizedProtocol, "reports");
  const historyRef = buildWorkspaceRef(normalizedProtocol, "history");

  return [
    createEntity({
      id: `protocol:${normalizedProtocol}`,
      title: normalizedProtocol,
      stereotype: "<<protocol>>",
      kind: "protocol",
      status: protocolStatus,
      protocol: normalizedProtocol,
      scope: "source",
      attributes: [
        { key: "status", value: protocolStatus },
        { key: "source files", value: counts.source, tone: "info" },
        { key: "jobs", value: counts.jobs },
        { key: "crash", value: counts.crash, tone: "warning" },
        { key: "vulns", value: counts.vulns, tone: "danger" },
      ],
    }),
    createEntity({
      id: `source:${normalizedProtocol}`,
      title: "SourceWorkspace",
      stereotype: "<<source>>",
      kind: "source",
      status: statusOf(model, "source", summary?.ready),
      protocol: normalizedProtocol,
      scope: "source",
      workspaceRef: sourceRef,
      attributes: [
        { key: "files", value: counts.source, tone: "info" },
        { key: "type", value: "source root" },
        { key: "ref", value: sourceRef, muted: true },
      ],
    }),
    createEntity({
      id: `specs:${normalizedProtocol}`,
      title: "ProtocolSpec",
      stereotype: "<<analysis>>",
      kind: "specs",
      status: statusOf(model, "specs"),
      protocol: normalizedProtocol,
      scope: "specs",
      workspaceRef: specsRef,
      attributes: [
        { key: "specs", value: counts.specs },
        { key: "type", value: "protocol facts" },
      ],
    }),
    createEntity({
      id: `vuldocs:${normalizedProtocol}`,
      title: "VulDoc",
      stereotype: "<<document>>",
      kind: "vuldocs",
      status: statusOf(model, "vuldocs"),
      protocol: normalizedProtocol,
      scope: "vuldocs",
      workspaceRef: vuldocsRef,
      attributes: [
        { key: "docs", value: counts.vuldocs },
        { key: "type", value: "raw/distilled" },
      ],
    }),
    createEntity({
      id: `kb:${normalizedProtocol}`,
      title: "KnowledgeBase",
      stereotype: "<<kb>>",
      kind: "kb",
      status: statusOf(model, "kb"),
      protocol: normalizedProtocol,
      scope: "kb",
      workspaceRef: kbRef,
      attributes: [
        { key: "entries", value: counts.kb },
        { key: "type", value: "vuln facts" },
      ],
    }),
    createEntity({
      id: `seeds:${normalizedProtocol}`,
      title: "SeedCorpus",
      stereotype: "<<seed>>",
      kind: "seeds",
      status: statusOf(model, "seeds"),
      protocol: normalizedProtocol,
      scope: "seeds",
      workspaceRef: seedsRef,
      attributes: [
        { key: "seeds", value: counts.seeds },
        { key: "type", value: "text/bin" },
      ],
    }),
    createEntity({
      id: `risk:${normalizedProtocol}`,
      title: "RiskAnalysis",
      stereotype: "<<risk>>",
      kind: "risk",
      status: statusOf(model, "risk"),
      protocol: normalizedProtocol,
      scope: "risk",
      workspaceRef: riskRef,
      attributes: [
        { key: "analyses", value: counts.risk, tone: "warning" },
        { key: "type", value: "risk paths" },
      ],
    }),
    createEntity({
      id: `instrumented:${normalizedProtocol}`,
      title: "InstrumentedBuild",
      stereotype: "<<instrumented>>",
      kind: "instrumented",
      status: statusOf(model, "instrumented"),
      protocol: normalizedProtocol,
      scope: "build",
      workspaceRef: buildRef,
      attributes: [
        { key: "artifacts", value: counts.instrumented },
        { key: "type", value: "instrumented" },
      ],
    }),
    createEntity({
      id: `jobs:${normalizedProtocol}`,
      title: "FuzzJob",
      stereotype: "<<job>>",
      kind: "jobs",
      status: statusOf(model, "jobs"),
      protocol: normalizedProtocol,
      scope: "jobs",
      workspaceRef: jobsRef,
      attributes: [
        { key: "jobs", value: counts.jobs },
        { key: "status", value: counts.jobs > 0 ? "total" : "empty" },
      ],
    }),
    createEntity({
      id: `crash:${normalizedProtocol}`,
      title: "CrashArtifact",
      stereotype: "<<crash>>",
      kind: "crash",
      status: statusOf(model, "crash"),
      protocol: normalizedProtocol,
      scope: "jobs",
      workspaceRef: jobsRef,
      attributes: [
        { key: "crash", value: counts.crash, tone: "warning" },
        { key: "type", value: "crash output" },
      ],
    }),
    createEntity({
      id: `debug:${normalizedProtocol}`,
      title: "DebugSession",
      stereotype: "<<debug>>",
      kind: "debug",
      status: statusOf(model, "debug"),
      protocol: normalizedProtocol,
      scope: "debug",
      workspaceRef: debugRef,
      attributes: [
        { key: "sessions", value: counts.debug },
        { key: "type", value: "gdb/llm" },
      ],
    }),
    createEntity({
      id: `reports:${normalizedProtocol}`,
      title: "Report",
      stereotype: "<<report>>",
      kind: "reports",
      status: statusOf(model, "reports"),
      protocol: normalizedProtocol,
      scope: "reports",
      workspaceRef: reportsRef,
      attributes: [
        { key: "reports", value: counts.reports },
        { key: "type", value: "task report" },
      ],
    }),
    createEntity({
      id: `vulns:${normalizedProtocol}`,
      title: "VulnerabilityRecord",
      stereotype: "<<vulnerability>>",
      kind: "vulns",
      status: statusOf(model, "vulns"),
      protocol: normalizedProtocol,
      scope: "history",
      workspaceRef: historyRef,
      attributes: [
        { key: "vulns", value: counts.vulns, tone: "danger" },
        { key: "type", value: "confirmed/recorded" },
      ],
    }),
    createEntity({
      id: `history:${normalizedProtocol}`,
      title: "History",
      stereotype: "<<history>>",
      kind: "history",
      status: statusOf(model, "history"),
      protocol: normalizedProtocol,
      scope: "history",
      workspaceRef: historyRef,
      attributes: [
        { key: "records", value: counts.history },
        { key: "type", value: model.empty ? "real lineage will appear after source import and processing" : "protocol timeline" },
      ],
    }),
  ];
}

interface RelationRule {
  source: string;
  target: string;
  label: string;
  kind: NonNullable<UmlAssetRelation["kind"]>;
  description: string;
  inferred?: boolean;
}

export function buildProtocolUmlRelations(
  entities: UmlAssetEntity[],
  counts: CountSnapshot,
): UmlAssetRelation[] {
  const entityIds = new Set(entities.map((entity) => entity.id));
  const protocolId = entities.find((entity) => entity.kind === "protocol")?.id ?? "";
  const sourceId = entities.find((entity) => entity.kind === "source")?.id ?? "";
  const specsId = entities.find((entity) => entity.kind === "specs")?.id ?? "";
  const vuldocsId = entities.find((entity) => entity.kind === "vuldocs")?.id ?? "";
  const kbId = entities.find((entity) => entity.kind === "kb")?.id ?? "";
  const seedsId = entities.find((entity) => entity.kind === "seeds")?.id ?? "";
  const riskId = entities.find((entity) => entity.kind === "risk")?.id ?? "";
  const instrumentedId = entities.find((entity) => entity.kind === "instrumented")?.id ?? "";
  const jobsId = entities.find((entity) => entity.kind === "jobs")?.id ?? "";
  const crashId = entities.find((entity) => entity.kind === "crash")?.id ?? "";
  const debugId = entities.find((entity) => entity.kind === "debug")?.id ?? "";
  const reportsId = entities.find((entity) => entity.kind === "reports")?.id ?? "";
  const vulnsId = entities.find((entity) => entity.kind === "vulns")?.id ?? "";

  const rules: RelationRule[] = [
    {
      source: protocolId,
      target: sourceId,
      label: "contains",
      kind: "composition",
      description: "Protocol contains the source workspace as its root asset.",
    },
    {
      source: protocolId,
      target: specsId,
      label: "owns analysis",
      kind: "composition",
      description: "Protocol-level analysis results belong to this protocol.",
    },
    {
      source: protocolId,
      target: vuldocsId,
      label: "owns docs",
      kind: "composition",
      description: "Raw or distilled vulnerability documents stay inside the protocol workspace.",
    },
    {
      source: protocolId,
      target: kbId,
      label: "owns kb",
      kind: "composition",
      description: "Knowledge base entries are protocol-scoped assets.",
    },
    {
      source: sourceId,
      target: specsId,
      label: "extract",
      kind: "dependency",
      description: "Protocol facts are extracted from the source workspace.",
    },
    {
      source: vuldocsId,
      target: kbId,
      label: "distill",
      kind: "dependency",
      description: "Documents are distilled into reusable knowledge base facts.",
    },
    {
      source: sourceId,
      target: seedsId,
      label: "seed gen",
      kind: "dependency",
      description: "Source workspace guides seed generation.",
    },
    {
      source: kbId,
      target: seedsId,
      label: "kb guide",
      kind: "dependency",
      description: "Knowledge base facts constrain and improve generated seeds.",
    },
    {
      source: sourceId,
      target: riskId,
      label: "risk scan",
      kind: "dependency",
      description: "Source workspace is scanned for protocol risks and hot paths.",
    },
    {
      source: riskId,
      target: instrumentedId,
      label: "instrument",
      kind: "dependency",
      description: "Risk analysis guides what should be instrumented.",
    },
    {
      source: sourceId,
      target: instrumentedId,
      label: "build input",
      kind: "dependency",
      description: "Source workspace is the build input for the instrumented target.",
    },
    {
      source: seedsId,
      target: jobsId,
      label: "fuzz input",
      kind: "flow",
      description: "Seeds flow into fuzz jobs as the runtime input corpus.",
    },
    {
      source: instrumentedId,
      target: jobsId,
      label: "target",
      kind: "flow",
      description: "The instrumented build is the execution target of fuzz jobs.",
    },
    {
      source: jobsId,
      target: crashId,
      label: "crash/hang",
      kind: "flow",
      description: "Fuzz jobs may produce crashes or hangs.",
      inferred: counts.crash === 0,
    },
    {
      source: crashId,
      target: debugId,
      label: "debug",
      kind: "dependency",
      description: "Crash artifacts are debugged to identify root cause and exploitability.",
      inferred: counts.crash === 0 && counts.debug === 0,
    },
    {
      source: debugId,
      target: vulnsId,
      label: "classify",
      kind: "dependency",
      description: "Debug results classify whether a crash becomes a confirmed vulnerability record.",
      inferred: counts.vulns === 0,
    },
    {
      source: crashId,
      target: vulnsId,
      label: "may confirm",
      kind: "dependency",
      description: "A crash is only a signal. It may confirm a vulnerability after follow-up analysis.",
      inferred: counts.vulns === 0,
    },
    {
      source: jobsId,
      target: reportsId,
      label: "report",
      kind: "dependency",
      description: "Fuzz jobs produce task or stage reports.",
      inferred: counts.reports === 0,
    },
    {
      source: reportsId,
      target: vulnsId,
      label: "reference",
      kind: "dependency",
      description: "Reports reference confirmed vulnerability records when available.",
      inferred: counts.vulns === 0,
    },
    {
      source: vulnsId,
      target: protocolId,
      label: "recorded in",
      kind: "aggregation",
      description: "Vulnerability records belong to the protocol history. Not every crash becomes a vulnerability.",
      inferred: counts.vulns === 0,
    },
  ];

  return rules
    .filter((rule) => Boolean(rule.source) && Boolean(rule.target) && entityIds.has(rule.source) && entityIds.has(rule.target))
    .map((rule) => ({
      id: `${rule.source}->${rule.target}:${rule.label}`,
      source: rule.source,
      target: rule.target,
      label: rule.label,
      kind: rule.kind,
      description: rule.description,
      inferred: rule.inferred,
    }));
}

export function buildProtocolLineageDiagram(
  protocol: string,
  model: AssetGraphModel,
  summary?: ProtocolAssetSummary | null,
): UmlDiagramModel {
  const normalizedProtocol = normalizeProtocol(protocol);
  const entities = filterRenderableLineageEntities(
    normalizedProtocol,
    buildProtocolAssetEntities(normalizedProtocol, model, summary),
  );
  const relations = buildProtocolUmlRelations(entities, buildCounts(model));
  return layoutProtocolSmartUmlLineage(normalizedProtocol, entities, relations);
}

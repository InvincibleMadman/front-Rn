import type { ProtocolAssetSummary } from "@/types/api/assets";
import type { AssetGraphModel } from "@/features/assets/asset-utils";
import { buildWorkspaceRef, normalizeProtocol } from "@/features/assets/asset-utils";
import {
  layoutProtocolLineage,
} from "@/features/assets/uml/asset-uml-layout";
import type {
  UmlAssetEntity,
  UmlAssetRelation,
  UmlDiagramModel,
  UmlAssetStatus,
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
    // Crash output may be absent in older mindmap payloads; fall back to vulns-derived count.
    return Math.max(0, model.counts.crash ?? model.counts.vulns ?? 0);
  }

  if (key === "history") {
    return Math.max(0, model.counts.vulns ?? 0);
  }

  return Math.max(0, model.counts[key] ?? 0);
}

function statusOf(model: AssetGraphModel, key: keyof CountSnapshot | "protocol", fallbackReady = false): UmlAssetStatus {
  const raw = String(model.statuses[key] ?? "").trim().toLowerCase();
  if (raw === "ready" || raw === "available" || raw === "empty" || raw === "degraded" || raw === "running") {
    return raw;
  }

  if (key === "protocol") {
    return fallbackReady || Object.values(model.counts).some((value) => Number(value) > 0) ? "ready" : "empty";
  }

  return countOf(model, key as keyof CountSnapshot) > 0 ? (fallbackReady && key === "source" ? "ready" : "available") : "empty";
}

function entity(
  partial: Omit<UmlAssetEntity, "x" | "y">,
): UmlAssetEntity {
  return {
    ...partial,
    x: 0,
    y: 0,
  };
}

function buildProtocolAssetEntities(
  protocol: string,
  model: AssetGraphModel,
  summary?: ProtocolAssetSummary | null,
): UmlAssetEntity[] {
  const normalizedProtocol = normalizeProtocol(protocol);
  const counts: CountSnapshot = {
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

  return [
    entity({
      id: `protocol:${normalizedProtocol}`,
      title: normalizedProtocol,
      stereotype: "<<protocol>>",
      kind: "protocol",
      status: statusOf(model, "protocol", summary?.ready),
      protocol: normalizedProtocol,
      scope: "source",
      attributes: [
        { key: "status", value: statusOf(model, "protocol", summary?.ready) },
        { key: "source files", value: counts.source, tone: "info" },
        { key: "jobs", value: counts.jobs },
        { key: "crash", value: counts.crash, tone: "warning" },
        { key: "vulns", value: counts.vulns, tone: "danger" },
      ],
    }),
    entity({
      id: `source:${normalizedProtocol}`,
      title: "SourceWorkspace",
      stereotype: "<<source>>",
      kind: "source",
      status: statusOf(model, "source", summary?.ready),
      protocol: normalizedProtocol,
      scope: "source",
      workspaceRef: buildWorkspaceRef(normalizedProtocol, "source"),
      attributes: [
        { key: "files", value: counts.source, tone: "info" },
        { key: "type", value: "source root" },
        { key: "ref", value: buildWorkspaceRef(normalizedProtocol, "source"), muted: true },
      ],
    }),
    entity({
      id: `specs:${normalizedProtocol}`,
      title: "ProtocolSpec",
      stereotype: "<<analysis>>",
      kind: "specs",
      status: statusOf(model, "specs"),
      protocol: normalizedProtocol,
      scope: "specs",
      workspaceRef: buildWorkspaceRef(normalizedProtocol, "specs"),
      attributes: [
        { key: "specs", value: counts.specs },
        { key: "type", value: "protocol facts" },
      ],
    }),
    entity({
      id: `vuldocs:${normalizedProtocol}`,
      title: "VulDoc",
      stereotype: "<<document>>",
      kind: "vuldocs",
      status: statusOf(model, "vuldocs"),
      protocol: normalizedProtocol,
      scope: "vuldocs",
      workspaceRef: buildWorkspaceRef(normalizedProtocol, "vuldocs"),
      attributes: [
        { key: "docs", value: counts.vuldocs },
        { key: "type", value: "raw/distilled" },
      ],
    }),
    entity({
      id: `kb:${normalizedProtocol}`,
      title: "KnowledgeBase",
      stereotype: "<<kb>>",
      kind: "kb",
      status: statusOf(model, "kb"),
      protocol: normalizedProtocol,
      scope: "kb",
      workspaceRef: buildWorkspaceRef(normalizedProtocol, "kb"),
      attributes: [
        { key: "entries", value: counts.kb },
        { key: "type", value: "vuln facts" },
      ],
    }),
    entity({
      id: `seeds:${normalizedProtocol}`,
      title: "SeedCorpus",
      stereotype: "<<seed>>",
      kind: "seeds",
      status: statusOf(model, "seeds"),
      protocol: normalizedProtocol,
      scope: "seeds",
      workspaceRef: buildWorkspaceRef(normalizedProtocol, "seeds"),
      attributes: [
        { key: "seeds", value: counts.seeds },
        { key: "type", value: "text/bin" },
      ],
    }),
    entity({
      id: `risk:${normalizedProtocol}`,
      title: "RiskAnalysis",
      stereotype: "<<risk>>",
      kind: "risk",
      status: statusOf(model, "risk"),
      protocol: normalizedProtocol,
      scope: "risk",
      workspaceRef: buildWorkspaceRef(normalizedProtocol, "risk"),
      attributes: [
        { key: "analyses", value: counts.risk, tone: "warning" },
        { key: "type", value: "risk paths" },
      ],
    }),
    entity({
      id: `instrumented:${normalizedProtocol}`,
      title: "InstrumentedBuild",
      stereotype: "<<instrumented>>",
      kind: "instrumented",
      status: statusOf(model, "instrumented"),
      protocol: normalizedProtocol,
      scope: "build",
      workspaceRef: buildWorkspaceRef(normalizedProtocol, "build"),
      attributes: [
        { key: "artifacts", value: counts.instrumented },
        { key: "type", value: "instrumented" },
      ],
    }),
    entity({
      id: `jobs:${normalizedProtocol}`,
      title: "FuzzJob",
      stereotype: "<<job>>",
      kind: "jobs",
      status: statusOf(model, "jobs"),
      protocol: normalizedProtocol,
      scope: "jobs",
      workspaceRef: buildWorkspaceRef(normalizedProtocol, "jobs"),
      attributes: [
        { key: "jobs", value: counts.jobs },
        { key: "status", value: counts.jobs > 0 ? "total" : "empty" },
      ],
    }),
    entity({
      id: `crash:${normalizedProtocol}`,
      title: "CrashArtifact",
      stereotype: "<<crash>>",
      kind: "crash",
      status: statusOf(model, "crash"),
      protocol: normalizedProtocol,
      scope: "jobs",
      workspaceRef: buildWorkspaceRef(normalizedProtocol, "jobs"),
      attributes: [
        { key: "crash", value: counts.crash, tone: "warning" },
        { key: "type", value: "crash output" },
      ],
    }),
    entity({
      id: `debug:${normalizedProtocol}`,
      title: "DebugSession",
      stereotype: "<<debug>>",
      kind: "debug",
      status: statusOf(model, "debug"),
      protocol: normalizedProtocol,
      scope: "debug",
      workspaceRef: buildWorkspaceRef(normalizedProtocol, "debug"),
      attributes: [
        { key: "sessions", value: counts.debug },
        { key: "type", value: "gdb/llm" },
      ],
    }),
    entity({
      id: `reports:${normalizedProtocol}`,
      title: "Report",
      stereotype: "<<report>>",
      kind: "reports",
      status: statusOf(model, "reports"),
      protocol: normalizedProtocol,
      scope: "reports",
      workspaceRef: buildWorkspaceRef(normalizedProtocol, "reports"),
      attributes: [
        { key: "reports", value: counts.reports },
        { key: "type", value: "task report" },
      ],
    }),
    entity({
      id: `vulns:${normalizedProtocol}`,
      title: "VulnerabilityRecord",
      stereotype: "<<vulnerability>>",
      kind: "vulns",
      status: statusOf(model, "vulns"),
      protocol: normalizedProtocol,
      scope: "history",
      workspaceRef: buildWorkspaceRef(normalizedProtocol, "history"),
      attributes: [
        { key: "vulns", value: counts.vulns, tone: "danger" },
        { key: "type", value: "confirmed/recorded" },
      ],
    }),
    entity({
      id: `history:${normalizedProtocol}`,
      title: "History",
      stereotype: "<<history>>",
      kind: "history",
      status: statusOf(model, "history"),
      protocol: normalizedProtocol,
      scope: "history",
      workspaceRef: buildWorkspaceRef(normalizedProtocol, "history"),
      attributes: [
        { key: "records", value: counts.history },
        { key: "type", value: model.empty ? "导入源码并完成流程后生成真实资产关系" : "protocol timeline" },
      ],
    }),
  ];
}

export function buildProtocolAssetRelations(protocol: string): UmlAssetRelation[] {
  const normalizedProtocol = normalizeProtocol(protocol);
  const protocolId = `protocol:${normalizedProtocol}`;
  return [
    {
      id: `${protocolId}->source`,
      source: protocolId,
      target: `source:${normalizedProtocol}`,
      label: "contains",
      kind: "composition",
      description: "协议项目包含源码工作区，这是所有后续资产的源头。",
    },
    {
      id: `${protocolId}->specs`,
      source: protocolId,
      target: `specs:${normalizedProtocol}`,
      label: "owns analysis",
      kind: "composition",
      description: "协议级分析结果属于该协议。",
    },
    {
      id: `${protocolId}->vuldocs`,
      source: protocolId,
      target: `vuldocs:${normalizedProtocol}`,
      label: "owns docs",
      kind: "composition",
      description: "协议文档资产属于该协议。",
    },
    {
      id: `${protocolId}->kb`,
      source: protocolId,
      target: `kb:${normalizedProtocol}`,
      label: "owns kb",
      kind: "composition",
      description: "知识库资产归属于该协议。",
    },
    {
      id: `source->specs:${normalizedProtocol}`,
      source: `source:${normalizedProtocol}`,
      target: `specs:${normalizedProtocol}`,
      label: "extract",
      kind: "dependency",
      description: "源码被分析后提取出协议事实。",
    },
    {
      id: `vuldocs->kb:${normalizedProtocol}`,
      source: `vuldocs:${normalizedProtocol}`,
      target: `kb:${normalizedProtocol}`,
      label: "distill",
      kind: "dependency",
      description: "漏洞文档蒸馏为结构化知识条目。",
    },
    {
      id: `source->seeds:${normalizedProtocol}`,
      source: `source:${normalizedProtocol}`,
      target: `seeds:${normalizedProtocol}`,
      label: "seed gen",
      kind: "dependency",
      description: "源码或协议事实指导种子生成。",
    },
    {
      id: `kb->seeds:${normalizedProtocol}`,
      source: `kb:${normalizedProtocol}`,
      target: `seeds:${normalizedProtocol}`,
      label: "kb guide",
      kind: "dependency",
      description: "知识库为种子设计提供约束和提示。",
    },
    {
      id: `source->risk:${normalizedProtocol}`,
      source: `source:${normalizedProtocol}`,
      target: `risk:${normalizedProtocol}`,
      label: "risk scan",
      kind: "dependency",
      description: "源码被风险分析流程扫描，形成路径与热点。",
    },
    {
      id: `risk->instrumented:${normalizedProtocol}`,
      source: `risk:${normalizedProtocol}`,
      target: `instrumented:${normalizedProtocol}`,
      label: "instrument",
      kind: "dependency",
      description: "风险分析指导插桩与构建加工。",
    },
    {
      id: `source->instrumented:${normalizedProtocol}`,
      source: `source:${normalizedProtocol}`,
      target: `instrumented:${normalizedProtocol}`,
      label: "build input",
      kind: "dependency",
      description: "源码是插桩构建的输入。",
    },
    {
      id: `seeds->jobs:${normalizedProtocol}`,
      source: `seeds:${normalizedProtocol}`,
      target: `jobs:${normalizedProtocol}`,
      label: "fuzz input",
      kind: "flow",
      description: "种子语料流入 fuzz 任务作为输入。",
    },
    {
      id: `instrumented->jobs:${normalizedProtocol}`,
      source: `instrumented:${normalizedProtocol}`,
      target: `jobs:${normalizedProtocol}`,
      label: "target",
      kind: "flow",
      description: "插桩构建产物是 fuzz 任务的目标。",
    },
    {
      id: `jobs->crash:${normalizedProtocol}`,
      source: `jobs:${normalizedProtocol}`,
      target: `crash:${normalizedProtocol}`,
      label: "crash/hang",
      kind: "flow",
      description: "fuzz 任务可能产出 crash 或 hang。",
    },
    {
      id: `crash->vulns:${normalizedProtocol}`,
      source: `crash:${normalizedProtocol}`,
      target: `vulns:${normalizedProtocol}`,
      label: "may confirm",
      kind: "dependency",
      description: "Crash 只是异常信号，后续分析后才可能确认漏洞。",
    },
    {
      id: `crash->debug:${normalizedProtocol}`,
      source: `crash:${normalizedProtocol}`,
      target: `debug:${normalizedProtocol}`,
      label: "debug",
      kind: "dependency",
      description: "Crash 进入调试会话以定位成因。",
    },
    {
      id: `debug->vulns:${normalizedProtocol}`,
      source: `debug:${normalizedProtocol}`,
      target: `vulns:${normalizedProtocol}`,
      label: "classify",
      kind: "dependency",
      description: "调试结果帮助判定是否形成漏洞记录。",
    },
    {
      id: `jobs->reports:${normalizedProtocol}`,
      source: `jobs:${normalizedProtocol}`,
      target: `reports:${normalizedProtocol}`,
      label: "report",
      kind: "dependency",
      description: "任务执行会产出阶段性或最终报告。",
    },
    {
      id: `reports->vulns:${normalizedProtocol}`,
      source: `reports:${normalizedProtocol}`,
      target: `vulns:${normalizedProtocol}`,
      label: "reference",
      kind: "dependency",
      description: "报告会引用漏洞记录或确认结论。",
    },
    {
      id: `vulns->protocol:${normalizedProtocol}`,
      source: `vulns:${normalizedProtocol}`,
      target: protocolId,
      label: "recorded in",
      kind: "aggregation",
      description: "漏洞记录属于协议级历史，不代表每个 crash 都是漏洞。",
    },
    {
      id: `vulns->history:${normalizedProtocol}`,
      source: `vulns:${normalizedProtocol}`,
      target: `history:${normalizedProtocol}`,
      label: "timeline",
      kind: "association",
      description: "漏洞记录进入协议历史时间线。",
    },
  ];
}

export function buildProtocolLineageDiagram(
  protocol: string,
  model: AssetGraphModel,
  summary?: ProtocolAssetSummary | null,
): UmlDiagramModel {
  const entities = buildProtocolAssetEntities(protocol, model, summary);
  const relations = buildProtocolAssetRelations(protocol);
  return layoutProtocolLineage(normalizeProtocol(protocol), entities, relations);
}

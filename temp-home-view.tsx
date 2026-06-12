import type { JSX } from "react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Bug, Gauge, Radar, Sparkles, TerminalSquare, Workflow } from "lucide-react";
import { DiscoveryFlowPanel } from "./discovery-flow-panel";
import { systemApi } from "@/lib/api/services/system";
import { cn } from "@/lib/utils/cn";
import { useUiStore } from "@/stores/ui-store";

interface ParticleDot { x: number; y: number; vx: number; vy: number; radius: number; }
interface MetricItem { label: string; value: number; suffix?: string; }
interface DonutSegment { label: string; value: number; color: string; }
interface NodeItem { name: string; value: number; status: string; }
interface DemoScreen {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  accent: string;
  accentSoft: string;
  metrics: MetricItem[];
  trend: number[];
  donut?: DonutSegment[];
  bars?: number[];
  barLabels?: string[];
  nodes?: NodeItem[];
  footerTags: string[];
}

const HOME_ENTRY_LINKS = [
  { to: "/console", title: "控制台总览", description: "实时任务、节点切换、全局日志和结果汇聚入口。", icon: Gauge },
  { to: "/offline?tab=protocol", title: "离线工作台", description: "协议提取、种子生成、风险分析与插桩处理。", icon: Sparkles },
  { to: "/jobs", title: "任务编排", description: "任务队列、状态过滤、崩溃产物与运行节奏。", icon: Workflow },
  { to: "/debug", title: "GDB 调试", description: "从 crash seed 进入证据链和函数定位视图。", icon: Bug },
] as const;

const HOME_DEMO_SCREENS: DemoScreen[] = [
  {
    id: "coverage-ramp",
    badge: "Coverage Ramp",
    title: "覆盖率趋势与种子推进",
    subtitle: "覆盖率、执行速度与样本吞吐在前台视图内同步抬升。",
    accent: "hsl(var(--accent-blue))",
    accentSoft: "hsl(var(--accent-blue-light))",
    metrics: [
      { label: "Coverage", value: 94, suffix: "%" },
      { label: "Exec/s", value: 18420 },
      { label: "Seeds", value: 128 },
    ],
    trend: [6, 11, 18, 27, 35, 46, 59, 68, 75, 82, 89, 94],
    donut: [
      { label: "Crash", value: 36, color: "hsl(var(--color-danger))" },
      { label: "Hang", value: 18, color: "hsl(var(--color-warning))" },
      { label: "Risk", value: 46, color: "hsl(var(--accent-blue))" },
    ],
    footerTags: ["coverage", "mutation", "replay"],
  },
  {
    id: "risk-atlas",
    badge: "Risk Atlas",
    title: "风险命中柱图与协议异常曲线",
    subtitle: "协议异常曲线、风险命中柱图与结果密度并排对照。",
    accent: "hsl(var(--accent-orange))",
    accentSoft: "hsl(var(--accent-orange-light))",
    metrics: [
      { label: "Critical", value: 17 },
      { label: "Warnings", value: 64 },
      { label: "Findings", value: 231 },
    ],
    trend: [8, 13, 21, 18, 29, 36, 49, 45, 58, 66, 61, 77],
    bars: [56, 82, 41, 69],
    barLabels: ["Modbus", "S7", "OPC UA", "DNP3"],
    footerTags: ["hits", "anomaly", "triage"],
  },
  {
    id: "cluster-watch",
    badge: "Cluster Watch",
    title: "crash / hang / risk 分布与节点状态",
    subtitle: "崩溃分布、节点负载和调度状态收束进同一层总览。",
    accent: "hsl(var(--accent-pink))",
    accentSoft: "hsl(var(--accent-pink-soft))",
    metrics: [
      { label: "Nodes", value: 12 },
      { label: "Active", value: 9 },
      { label: "Queued", value: 27 },
    ],
    trend: [12, 18, 19, 29, 26, 35, 43, 49, 46, 59, 68, 72],
    donut: [
      { label: "Crash", value: 42, color: "hsl(var(--color-danger))" },
      { label: "Hang", value: 23, color: "hsl(var(--color-warning))" },
      { label: "Risk", value: 35, color: "hsl(var(--accent-pink))" },
    ],
    nodes: [
      { name: "SH-01", value: 86, status: "stable" },
      { name: "HZ-04", value: 91, status: "stable" },
      { name: "NJ-07", value: 48, status: "spike" },
      { name: "WH-11", value: 64, status: "watch" },
    ],
    footerTags: ["dispatch", "cluster", "crash"],
  },
];

function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (): void => setReducedMotion(mediaQuery.matches);
    handleChange();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);
  return reducedMotion;
}

function useParticleNetwork(canvasRef: React.RefObject<HTMLCanvasElement | null>, reducedMotion: boolean): void {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const pointer = { x: 0, y: 0, active: false };
    const particles: ParticleDot[] = [];
    let width = 0;
    let height = 0;
    let rafId = 0;
    const createParticle = (): ParticleDot => ({ x: Math.random() * width, y: Math.random() * height, vx: (Math.random() - 0.5) * 0.22, vy: (Math.random() - 0.5) * 0.22, radius: Math.random() * 1.6 + 0.8 });
    const resizeCanvas = (): void => {
      width = window.innerWidth;
      height = window.innerHeight;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * pixelRatio);
      canvas.height = Math.floor(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      const count = Math.max(28, Math.min(76, Math.floor((width * height) / 28000)));
      particles.length = 0;
      for (let index = 0; index < count; index += 1) particles.push(createParticle());
    };
    const drawFrame = (): void => {
      context.clearRect(0, 0, width, height);
      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index];
        if (!reducedMotion) {
          particle.x += particle.vx; particle.y += particle.vy;
          if (particle.x <= 0 || particle.x >= width) particle.vx *= -1;
          if (particle.y <= 0 || particle.y >= height) particle.vy *= -1;
          particle.x = Math.max(0, Math.min(width, particle.x));
          particle.y = Math.max(0, Math.min(height, particle.y));
        }
        for (let peerIndex = index + 1; peerIndex < particles.length; peerIndex += 1) {
          const peer = particles[peerIndex];
          const dx = particle.x - peer.x;
          const dy = particle.y - peer.y;
          const distance = Math.sqrt((dx * dx) + (dy * dy));
          if (distance > 120) continue;
          context.beginPath(); context.moveTo(particle.x, particle.y); context.lineTo(peer.x, peer.y);
          context.strokeStyle = `rgba(99, 102, 241, ${0.08 * (1 - (distance / 120))})`; context.lineWidth = 1; context.stroke();
        }
        if (pointer.active) {
          const px = particle.x - pointer.x; const py = particle.y - pointer.y; const pointerDistance = Math.sqrt((px * px) + (py * py));
          if (pointerDistance < 140) {
            context.beginPath(); context.moveTo(particle.x, particle.y); context.lineTo(pointer.x, pointer.y);
            context.strokeStyle = `rgba(249, 115, 22, ${0.12 * (1 - (pointerDistance / 140))})`; context.lineWidth = 1; context.stroke();
          }
        }
        context.beginPath(); context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2); context.fillStyle = "rgba(59, 130, 246, 0.55)"; context.fill();
      }
    };
    const animate = (): void => { drawFrame(); rafId = window.requestAnimationFrame(animate); };
    const handlePointerMove = (event: PointerEvent): void => { pointer.x = event.clientX; pointer.y = event.clientY; pointer.active = true; if (reducedMotion) drawFrame(); };
    const clearPointer = (): void => { pointer.active = false; if (reducedMotion) drawFrame(); };
    resizeCanvas(); drawFrame();
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("blur", clearPointer);
    document.addEventListener("mouseleave", clearPointer);
    if (!reducedMotion) rafId = window.requestAnimationFrame(animate);
    return () => { window.cancelAnimationFrame(rafId); window.removeEventListener("resize", resizeCanvas); window.removeEventListener("pointermove", handlePointerMove); window.removeEventListener("blur", clearPointer); document.removeEventListener("mouseleave", clearPointer); };
  }, [canvasRef, reducedMotion]);
}

function useRevealProgress(active: boolean, animationKey: string, reducedMotion: boolean): number {
  const [progress, setProgress] = useState(active && !reducedMotion ? 0 : 1);
  useEffect(() => {
    if (!active || reducedMotion) { setProgress(1); return; }
    let rafId = 0; const startedAt = performance.now(); const duration = 920;
    const tick = (now: number): void => { const elapsed = Math.min(1, (now - startedAt) / duration); const eased = 1 - Math.pow(1 - elapsed, 3); setProgress(eased); if (elapsed < 1) rafId = window.requestAnimationFrame(tick); };
    setProgress(0); rafId = window.requestAnimationFrame(tick); return () => window.cancelAnimationFrame(rafId);
  }, [active, animationKey, reducedMotion]);
  return progress;
}

function buildForwardOrder(targetIndex: number, count: number): number[] { return Array.from({ length: count }, (_, offset) => (targetIndex + offset) % count); }
function useDeckRotation(count: number, reducedMotion: boolean): { order: number[]; frontCycle: number; selectSlide: (index: number) => void } {
  const [order, setOrder] = useState<number[]>(() => buildForwardOrder(0, count));
  const [frontCycle, setFrontCycle] = useState(1);
  const orderRef = useRef(order);
  useEffect(() => { orderRef.current = order; }, [order]);
  const rotate = useCallback((): void => { const currentOrder = orderRef.current; if (currentOrder.length < 3) return; const nextOrder = [currentOrder[1], currentOrder[2], currentOrder[0]]; orderRef.current = nextOrder; setOrder(nextOrder); setFrontCycle((value) => value + 1); }, []);
  const selectSlide = useCallback((index: number): void => { if (index === orderRef.current[0]) return; const nextOrder = buildForwardOrder(index, count); orderRef.current = nextOrder; setOrder(nextOrder); setFrontCycle((value) => value + 1); }, [count]);
  useEffect(() => { if (count < 3) return; const interval = window.setInterval(rotate, reducedMotion ? 7200 : 3600); return () => window.clearInterval(interval); }, [count, reducedMotion, rotate]);
  return { order, frontCycle, selectSlide };
}

function formatMetric(value: number, suffix: string | undefined, progress: number): string {
  const nextValue = value * progress;
  if (suffix === "%") return `${Math.round(nextValue)}%`;
  if (nextValue >= 1000) return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: nextValue < 10000 ? 1 : 0 }).format(nextValue);
  return `${Math.round(nextValue)}`;
}

function linePath(values: number[], width: number, height: number, progress: number): { line: string; area: string } {
  const animatedValues = values.map((value) => value * progress);
  const max = Math.max(...animatedValues, 1);
  const stepX = width / Math.max(animatedValues.length - 1, 1);
  const points = animatedValues.map((value, index) => {
    const x = index * stepX;
    const y = height - ((value / max) * (height - 10)) - 5;
    return { x, y };
  });
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
  const area = `${line} L ${width} ${height} L 0 ${height} Z`;
  return { line, area };
}

function MiniLineChart({ values, color, glowColor, progress }: { values: number[]; color: string; glowColor: string; progress: number }): JSX.Element {
  const gradientId = useId().replace(/:/g, "");
  const { line, area } = linePath(values, 320, 148, progress);
  return (
    <svg viewBox="0 0 320 148" className="h-full w-full">
      <defs>
        <linearGradient id={gradientId} x1="0%" x2="0%" y1="0%" y2="100%">
          <stop offset="0%" stopColor={glowColor} stopOpacity="0.44" />
          <stop offset="100%" stopColor={glowColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.2, 0.4, 0.6, 0.8].map((ratio) => (
        <line key={ratio} x1={0} x2={320} y1={148 * ratio} y2={148 * ratio} stroke="currentColor" strokeOpacity="0.08" strokeDasharray="4 8" />
      ))}
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MiniBarChart({ values, labels, progress, accent }: { values: number[]; labels: string[]; progress: number; accent: string }): JSX.Element {
  const max = Math.max(...values, 1);
  return (
    <div className="grid h-full grid-cols-4 gap-3">
      {values.map((value, index) => {
        const heightRatio = Math.max(0.08, (value * progress) / max);
        return (
          <div key={`${labels[index]}-${value}`} className="flex h-full flex-col justify-end gap-2">
            <div className="relative flex-1 overflow-hidden rounded-[1rem] bg-slate-900/6 dark:bg-[hsl(var(--bg-primary)/0.9)]">
              <div className="absolute inset-x-0 bottom-0 rounded-t-[1rem]" style={{ height: `${heightRatio * 100}%`, background: `linear-gradient(180deg, ${accent}, color-mix(in srgb, ${accent} 58%, transparent))` }} />
            </div>
            <span className="text-center text-[11px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">{labels[index]}</span>
          </div>
        );
      })}
    </div>
  );
}

function MiniDonutChart({ segments, progress }: { segments: DonutSegment[]; progress: number }): JSX.Element {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, item) => sum + item.value, 0) || 1;
  let offset = 0;
  return (
    <svg viewBox="0 0 92 92" className="h-24 w-24 shrink-0 -rotate-90">
      <circle cx="46" cy="46" r={radius} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="10" />
      {segments.map((segment) => {
        const ratio = segment.value / total;
        const length = circumference * ratio * progress;
        const currentOffset = offset;
        offset += circumference * ratio;
        return <circle key={segment.label} cx="46" cy="46" r={radius} fill="none" stroke={segment.color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${length} ${circumference}`} strokeDashoffset={-currentOffset} />;
      })}
    </svg>
  );
}

function NodeStatusRail({ nodes, progress, accent }: { nodes: NodeItem[]; progress: number; accent: string }): JSX.Element {
  return (
    <div className="space-y-2.5">
      {nodes.map((node) => (
        <div key={node.name} className="rounded-2xl border border-white/12 bg-white/14 px-3.5 py-2.5 dark:border-[hsl(var(--border)/0.92)] dark:bg-[hsl(var(--bg-surface-elevated)/0.92)]">
          <div className="flex items-center justify-between gap-3 text-[12px] uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">
            <span>{node.name}</span>
            <span>{node.status}</span>
          </div>
          <div className="mt-2.5 h-2 rounded-full bg-slate-900/8 dark:bg-[hsl(var(--bg-primary)/0.9)]">
            <div className="h-2 rounded-full" style={{ width: `${node.value * progress}%`, background: `linear-gradient(90deg, ${accent}, color-mix(in srgb, ${accent} 58%, white))` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function DeckMetric({ item, progress }: { item: MetricItem; progress: number }): JSX.Element {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/16 px-3.5 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] dark:border-[hsl(var(--border)/0.9)] dark:bg-[hsl(var(--bg-surface-elevated)/0.94)]">
      <p className="text-[11px] uppercase tracking-[0.22em] text-[hsl(var(--text-tertiary))]">{item.label}</p>
      <p className="mt-2 text-xl font-semibold tracking-tight text-[hsl(var(--text-primary))]">{formatMetric(item.value, item.suffix, progress)}</p>
    </div>
  );
}

function DemoScreenCard({ screen, state, active, animationKey, reducedMotion }: { screen: DemoScreen; state: "front" | "middle" | "back"; active: boolean; animationKey: string; reducedMotion: boolean }): JSX.Element {
  const progress = useRevealProgress(active, animationKey, reducedMotion);
  return (
    <article
      className={cn(
        "absolute inset-0 isolate overflow-hidden rounded-[2rem] border transition-[transform,opacity,box-shadow] duration-500",
        state === "front" && "z-30 border-white/24 opacity-100 shadow-[0_32px_110px_rgba(15,23,42,0.28)] dark:border-[hsl(var(--border)/0.96)] dark:shadow-[0_28px_90px_rgba(0,0,0,0.48)]",
        state === "middle" && "z-20 border-white/16 opacity-82 shadow-[0_20px_60px_rgba(15,23,42,0.16)] dark:border-[hsl(var(--border)/0.9)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.38)]",
        state === "back" && "z-10 opacity-58 shadow-[0_16px_44px_rgba(15,23,42,0.12)] dark:border-[hsl(var(--border)/0.82)] dark:shadow-[0_16px_44px_rgba(0,0,0,0.3)]",
      )}
      style={{ background: state === "front" ? `linear-gradient(160deg, color-mix(in srgb, ${screen.accentSoft} 32%, hsl(var(--bg-surface-elevated))) 0%, hsl(var(--bg-surface)) 46%, hsl(var(--bg-surface-elevated)) 100%)` : `linear-gradient(160deg, color-mix(in srgb, ${screen.accentSoft} 54%, hsl(var(--bg-surface-elevated))) 0%, hsl(var(--bg-surface)) 44%, hsl(var(--bg-surface-elevated)) 100%)`, transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.72),transparent_34%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_34%)]" />
      <div className="absolute inset-x-0 top-0 h-28 opacity-70" style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${screen.accent} 20%, transparent), transparent)` }} />
      <div className="relative flex h-full flex-col p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-[hsl(var(--text-tertiary))]">{screen.badge}</p>
            <h3 className="mt-2 text-[1.2rem] font-semibold tracking-tight text-[hsl(var(--text-primary))] lg:text-[1.32rem]">{screen.title}</h3>
          </div>
          <span className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ borderColor: `color-mix(in srgb, ${screen.accent} 42%, transparent)`, color: screen.accent, backgroundColor: `color-mix(in srgb, ${screen.accent} 10%, hsl(var(--bg-surface)))` }}>live</span>
        </div>
        <p className="mt-3 text-[15px] leading-7 text-[hsl(var(--text-secondary))] lg:text-base">{screen.subtitle}</p>
        <div className="mt-5 grid grid-cols-3 gap-3">{screen.metrics.map((item) => <DeckMetric key={`${screen.id}-${item.label}`} item={item} progress={active ? progress : 1} />)}</div>
        <div className="mt-5 grid min-h-0 flex-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[1.6rem] border border-white/12 bg-white/66 px-4 py-4 backdrop-blur-sm dark:border-[hsl(var(--border)/0.92)] dark:bg-[hsl(var(--bg-surface-elevated)/0.92)]">
            <div><p className="text-[11px] uppercase tracking-[0.22em] text-[hsl(var(--text-tertiary))]">signal lane</p><p className="mt-1 text-[15px] font-medium text-[hsl(var(--text-primary))]">core monitoring surface</p></div>
            <div className="mt-4 h-40 text-[hsl(var(--text-primary))]"><MiniLineChart values={screen.trend} color={screen.accent} glowColor={screen.accent} progress={active ? progress : 1} /></div>
          </div>
          <div className="flex min-h-0 flex-col gap-4">
            {screen.bars && screen.barLabels ? <div className="flex-1 rounded-[1.6rem] border border-white/12 bg-white/66 px-4 py-4 backdrop-blur-sm dark:border-[hsl(var(--border)/0.92)] dark:bg-[hsl(var(--bg-surface-elevated)/0.92)]"><p className="text-[11px] uppercase tracking-[0.22em] text-[hsl(var(--text-tertiary))]">risk hits</p><div className="mt-3 h-[8.75rem]"><MiniBarChart values={screen.bars} labels={screen.barLabels} accent={screen.accent} progress={active ? progress : 1} /></div></div> : null}
            {screen.donut ? <div className="rounded-[1.6rem] border border-white/12 bg-white/66 px-4 py-4 backdrop-blur-sm dark:border-[hsl(var(--border)/0.92)] dark:bg-[hsl(var(--bg-surface-elevated)/0.92)]"><div className="flex items-center gap-4"><MiniDonutChart segments={screen.donut} progress={active ? progress : 1} /><div className="space-y-2.5">{screen.donut.map((segment) => <div key={`${screen.id}-${segment.label}`} className="flex items-center gap-2 text-[13px] text-[hsl(var(--text-secondary))]"><span className="size-2.5 rounded-full" style={{ backgroundColor: segment.color }} /><span className="min-w-[3.6rem]">{segment.label}</span><span className="font-semibold text-[hsl(var(--text-primary))]">{Math.round(segment.value * (active ? progress : 1))}%</span></div>)}</div></div></div> : null}
            {screen.nodes ? <div className="rounded-[1.6rem] border border-white/12 bg-white/66 px-4 py-4 backdrop-blur-sm dark:border-[hsl(var(--border)/0.92)] dark:bg-[hsl(var(--bg-surface-elevated)/0.92)]"><p className="text-[11px] uppercase tracking-[0.22em] text-[hsl(var(--text-tertiary))]">node status</p><div className="mt-3"><NodeStatusRail nodes={screen.nodes} progress={active ? progress : 1} accent={screen.accent} /></div></div> : null}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2.5">{screen.footerTags.map((tag) => <span key={`${screen.id}-${tag}`} className="rounded-full border border-white/14 bg-white/30 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--text-secondary))] dark:border-[hsl(var(--border)/0.82)] dark:bg-[hsl(var(--bg-surface-elevated)/0.88)]">{tag}</span>)}</div>
      </div>
    </article>
  );
}

function PreviewDeck({ reducedMotion }: { reducedMotion: boolean }): JSX.Element {
  const { order, frontCycle, selectSlide } = useDeckRotation(HOME_DEMO_SCREENS.length, reducedMotion);
  const resolveState = (index: number): "front" | "middle" | "back" => index === order[0] ? "front" : index === order[1] ? "middle" : "back";
  return (
    <section className="mx-auto w-full max-w-[76rem]">
      <div className="relative mx-auto h-[21rem] w-full max-w-[60rem] sm:h-[25rem] lg:h-[29rem]">
        <div className="pointer-events-none absolute inset-x-[10%] inset-y-[10%] rounded-[2.8rem] border border-white/18 bg-white/22 shadow-[0_20px_80px_rgba(15,23,42,0.08)] dark:border-[hsl(var(--border)/0.88)] dark:bg-[hsl(var(--bg-surface)/0.56)]" />
        <div className="absolute inset-y-0 left-1/2 w-[78%] max-w-[42rem] -translate-x-[56%]">
          {HOME_DEMO_SCREENS.map((screen, index) => {
            const state = resolveState(index);
            const isActive = state === "front";
            const animationKey = isActive ? `${screen.id}-${frontCycle}` : `${screen.id}-idle`;
            return <div key={screen.id} className={cn("absolute inset-0 origin-center transition-[transform,opacity,filter] duration-700", state === "front" && "z-30 translate-x-0 translate-y-0 scale-100 opacity-100", state === "middle" && "z-20 translate-x-[12%] -translate-y-[6%] scale-[0.93] opacity-100", state === "back" && "z-10 translate-x-[24%] -translate-y-[12%] scale-[0.86] opacity-100")} style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)", filter: state === "front" ? "none" : state === "middle" ? "saturate(0.92) brightness(0.96)" : "saturate(0.84) brightness(0.9)" }}><DemoScreenCard screen={screen} state={state} active={isActive} animationKey={animationKey} reducedMotion={reducedMotion} /></div>;
          })}
        </div>
      </div>
      <div className="mt-8 flex items-center justify-center gap-3">{HOME_DEMO_SCREENS.map((screen, index) => { const active = order[0] === index; return <button key={screen.id} type="button" aria-label={`切换到 ${screen.title}`} aria-pressed={active} onClick={() => selectSlide(index)} className="group relative flex size-4 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent-blue))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"><span className={cn("absolute inset-0 rounded-full border transition-all duration-300", active ? "scale-100 border-[hsl(var(--accent-blue)/0.26)]" : "scale-75 border-transparent group-hover:border-[hsl(var(--accent-blue)/0.16)]")} /><span className={cn("block rounded-full transition-all duration-300", active ? "size-2.5 bg-[hsl(var(--accent-blue))] shadow-[0_0_0_6px_hsl(var(--accent-blue)/0.12)]" : "size-2 bg-[hsl(var(--text-tertiary)/0.34)] group-hover:bg-[hsl(var(--accent-blue)/0.56)]")} /></button>; })}</div>
    </section>
  );
}

export function HomeView(): JSX.Element {
  const apiBaseUrl = useUiStore((state) => state.apiBaseUrl);
  const reducedMotion = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useParticleNetwork(canvasRef, reducedMotion);
  const healthQuery = useQuery({ queryKey: ["health", apiBaseUrl], queryFn: systemApi.getHealth, retry: 0, refetchInterval: 30_000 });
  const backendStatus = useMemo(() => {
    if (healthQuery.data?.ok) return { label: "后端在线", tone: "text-[hsl(var(--color-success))]", dot: "bg-[hsl(var(--color-success))]" };
    if (healthQuery.isError) return { label: "后端离线", tone: "text-[hsl(var(--color-danger))]", dot: "bg-[hsl(var(--color-danger))]" };
    return { label: "状态探测中", tone: "text-[hsl(var(--color-warning))]", dot: "bg-[hsl(var(--color-warning))]" };
  }, [healthQuery.data?.ok, healthQuery.isError]);

  return (
    <div className="console-scrollbar relative h-full overflow-y-auto">
      <style>{`
        @keyframes homePacketBurst { 0% { transform: translateX(0) scale(0.96); opacity: 0; } 10% { opacity: 1; } 78% { opacity: 1; } 100% { transform: translateX(calc(100% + 0.5rem)) scale(1.02); opacity: 0; } }
        @keyframes homePulseRing { 0%, 100% { box-shadow: 0 0 0 0 rgba(236, 72, 153, 0.18); transform: scale(1); } 50% { box-shadow: 0 0 0 14px rgba(236, 72, 153, 0); transform: scale(1.06); } }
        @keyframes homeAlarmBlink { 0%, 100% { opacity: 1; filter: brightness(1); } 50% { opacity: 0.42; filter: brightness(1.24); } }
        @keyframes homeStatusBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0.38; } }
        @keyframes homeThroughputDrop { 0%, 32% { transform: scaleX(1); } 54% { transform: scaleX(0.68); } 78% { transform: scaleX(0.16); } 100% { transform: scaleX(0.06); } }
        @keyframes homeCabinetAlarm { 0%, 100% { transform: translateY(0); box-shadow: 0 24px 48px rgba(15,23,42,0.3); } 22% { transform: translate3d(1px,-1px,0); } 36% { transform: translate3d(-2px,1px,0); } 52% { transform: translate3d(2px,0,0); box-shadow: 0 28px 56px rgba(239,68,68,0.16); } 68% { transform: translate3d(-1px,1px,0); } }
        @keyframes homeScreenFlicker { 0%, 100% { opacity: 1; } 16% { opacity: 0.98; } 18% { opacity: 0.84; } 20% { opacity: 0.98; } 62% { opacity: 1; } 64% { opacity: 0.78; } 66% { opacity: 0.96; } }
      `}</style>
      <div className="relative isolate min-h-screen overflow-hidden bg-[linear-gradient(180deg,hsl(var(--bg-primary))_0%,color-mix(in_srgb,hsl(var(--bg-primary-alt))_88%,white)_100%)]">
        <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 -z-30 h-full w-full" />
        <div className="pointer-events-none fixed inset-0 -z-20">
          <div className="absolute left-[8%] top-[7%] h-72 w-72 rounded-full bg-[hsl(var(--accent-blue)/0.12)] blur-[140px]" />
          <div className="absolute right-[4%] top-[16%] h-80 w-80 rounded-full bg-[hsl(var(--accent-orange)/0.12)] blur-[160px]" />
          <div className="absolute bottom-[8%] left-[45%] h-72 w-72 rounded-full bg-[hsl(var(--accent-pink)/0.12)] blur-[160px]" />
          <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.34),transparent_34%,transparent_68%,rgba(59,130,246,0.05))]" />
        </div>
        <header className="absolute inset-x-0 top-0 z-20">
          <div className="mx-auto flex w-full max-w-[90rem] flex-wrap items-center justify-between gap-4 px-6 pt-8 sm:px-8 lg:px-10">
            <div className="flex items-center gap-3"><div className="flex size-12 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,hsl(var(--accent-blue)),hsl(var(--accent-pink)))] text-white shadow-[0_18px_34px_rgba(59,130,246,0.24)]"><TerminalSquare className="size-6" /></div><div><p className="text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--text-tertiary))]">ICP Fuzz</p><p className="mt-1 text-base font-medium text-[hsl(var(--text-secondary))]">Industrial Control Protocol Fuzzing Console</p></div></div>
            <div className="rounded-full border border-border/70 bg-white/72 px-4 py-2 shadow-sm backdrop-blur-md dark:bg-[hsl(var(--bg-surface)/0.88)]"><div className="flex items-center gap-2.5 text-sm font-medium"><span className={cn("size-2 rounded-full", backendStatus.dot)} /><span className={backendStatus.tone}>{backendStatus.label}</span><span className="text-[hsl(var(--text-tertiary))]">·</span><span className="font-mono text-[hsl(var(--text-secondary))]">{apiBaseUrl.replace(/^https?:\/\//, "")}</span></div></div>
          </div>
        </header>
        <div className="mx-auto w-full max-w-[90rem] px-6 pb-16 sm:px-8 lg:px-10">
          <section className="flex min-h-screen flex-col items-center justify-center py-24 text-center sm:py-28"><div className="max-w-[48rem]"><div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[hsl(var(--accent-blue)/0.18)] bg-[hsl(var(--accent-blue-light)/0.86)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[hsl(var(--accent-blue))] dark:bg-[hsl(var(--accent-blue-light)/0.18)]"><Radar className="size-3.5" />上线前模糊通信测试</div><h1 className="mt-7 text-5xl font-bold tracking-[-0.05em] text-[hsl(var(--text-primary))] sm:text-6xl lg:text-7xl">ICP Fuzz</h1><p className="mt-5 text-xl text-[hsl(var(--text-secondary))] sm:text-2xl">工业控制协议模糊测试与崩溃定位平台</p><p className="mt-3 text-[15px] uppercase tracking-[0.26em] text-[hsl(var(--text-tertiary))]">Pre-Launch Protocol Fuzzing | Crash Discovery | Function Localization</p><div className="mt-8 inline-flex items-center gap-2.5 rounded-full border border-border/70 bg-white/74 px-5 py-2.5 text-sm backdrop-blur-sm dark:bg-[hsl(var(--bg-surface)/0.88)]"><span className={cn("size-2 rounded-full", backendStatus.dot)} /><span className={backendStatus.tone}>{backendStatus.label}</span><span className="text-[hsl(var(--text-tertiary))]">·</span><span className="font-mono text-[hsl(var(--text-secondary))]">{apiBaseUrl.replace(/^https?:\/\//, "")}</span></div><div className="mt-10 flex items-center justify-center"><Link to="/console" className="group inline-flex items-center gap-3 rounded-full bg-[hsl(var(--accent-blue))] px-8 py-3.5 text-base font-semibold text-white shadow-[0_18px_36px_rgba(59,130,246,0.28)] transition hover:bg-[hsl(var(--accent-blue-hover))]">进入控制台<ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></Link></div></div></section>
          <div className="relative -mt-4 space-y-16 pb-8 sm:-mt-8 lg:-mt-10"><PreviewDeck reducedMotion={reducedMotion} /><DiscoveryFlowPanel reducedMotion={reducedMotion} /><section className="mx-auto w-full max-w-[76rem]"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{HOME_ENTRY_LINKS.map((entry) => { const Icon = entry.icon; return <Link key={entry.to} to={entry.to} className="group rounded-[1.8rem] border border-border/70 bg-white/72 p-5 shadow-[0_14px_40px_rgba(15,23,42,0.08)] transition hover:-translate-y-1 hover:border-[hsl(var(--accent-blue))] hover:shadow-[0_18px_48px_rgba(59,130,246,0.12)] dark:bg-[hsl(var(--bg-surface)/0.9)]"><div className="flex size-11 items-center justify-center rounded-2xl bg-[hsl(var(--accent-blue-light))] text-[hsl(var(--accent-blue))] transition group-hover:bg-[hsl(var(--accent-blue))] group-hover:text-white dark:bg-[hsl(var(--accent-blue-light)/0.2)]"><Icon className="size-5" /></div><p className="mt-5 text-lg font-semibold tracking-tight text-[hsl(var(--text-primary))]">{entry.title}</p><p className="mt-2 text-[15px] leading-7 text-[hsl(var(--text-secondary))]">{entry.description}</p><div className="mt-6 inline-flex items-center gap-2 text-base font-medium text-[hsl(var(--accent-blue))]">打开入口<ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></div></Link>; })}</div></section></div>
        </div>
      </div>
    </div>
  );
}

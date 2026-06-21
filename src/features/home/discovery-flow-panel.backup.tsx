import type { JSX } from "react";
import { Activity, Radar, Target } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type DiscoveryFlowPanelProps = {
  reducedMotion: boolean;
};

const deviceMetrics = [
  { label: "Frames / min", value: "182k" },
  { label: "Malformed", value: "7.4k" },
  { label: "Line speed", value: "0 rpm" },
] as const;

const deviceSignals = [
  { label: "Station", value: "PLC-Station A" },
  { label: "Guard", value: "Protective stop" },
  { label: "Primary fault", value: "Parser overload" },
] as const;

const stormMetrics = [
  { label: "exec/s", value: "18.4k" },
  { label: "queue depth", value: "128" },
  { label: "drop ratio", value: "96%" },
] as const;

const stormStages = [
  { label: "Mutation", value: "Length / sequence / field crossovers" },
  { label: "Replay", value: "Rotating multi-protocol regression" },
  { label: "Impact", value: "Throughput collapse and crash trigger" },
] as const;

const packetBursts = [
  { label: "MBAP LEN+3", top: "16%", delay: "0s", tone: "blue" },
  { label: "FUNC 0x11", top: "30%", delay: "0.4s", tone: "orange" },
  { label: "SEQ BURST", top: "44%", delay: "0.8s", tone: "pink" },
  { label: "CRC FLIP", top: "58%", delay: "1.2s", tone: "blue" },
  { label: "PDU VAR", top: "72%", delay: "1.6s", tone: "orange" },
] as const;

const rackModules = [
  { label: "CPU", leds: ["green", "green", "red"] },
  { label: "COMM", leds: ["amber", "green", "off"] },
  { label: "DI", leds: ["green", "green", "green"] },
  { label: "DO", leds: ["green", "off", "red"] },
] as const;

const functionFrames = [
  "parser_handle_frame()",
  "decode_session_payload()",
  "normalize_reply_length()",
] as const;

const outageEvents = [
  { id: "queue:id:00042", signal: "signal 11", value: 84 },
  { id: "queue:id:00071", signal: "timeout", value: 61 },
  { id: "queue:id:00103", signal: "asan", value: 49 },
] as const;

function DeviceTrend(): JSX.Element {
  return (
    <svg viewBox="0 0 240 88" className="h-full w-full">
      {[18, 36, 54, 72].map((y) => (
        <line
          key={y}
          x1="0"
          x2="240"
          y1={y}
          y2={y}
          stroke="currentColor"
          strokeOpacity="0.12"
          strokeDasharray="4 8"
        />
      ))}
      <defs>
        <linearGradient id="device-trend-fill" x1="0%" x2="0%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(96,165,250,0.34)" />
          <stop offset="100%" stopColor="rgba(96,165,250,0)" />
        </linearGradient>
      </defs>
      <path
        d="M0 12 L28 10 L56 16 L84 18 L112 28 L140 44 L168 58 L196 76 L240 82 L240 88 L0 88 Z"
        fill="url(#device-trend-fill)"
      />
      <path
        d="M0 12 L28 10 L56 16 L84 18 L112 28 L140 44 L168 58 L196 76 L240 82"
        fill="none"
        stroke="rgba(125,211,252,0.95)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function toneClass(tone: "blue" | "orange" | "pink"): string {
  if (tone === "blue") return "border-sky-400/30 bg-sky-400/12 text-sky-200";
  if (tone === "orange") return "border-orange-300/30 bg-orange-300/12 text-orange-200";
  return "border-pink-400/30 bg-pink-400/12 text-pink-200";
}

function ledClass(tone: "green" | "amber" | "red" | "off"): string {
  if (tone === "green") return "bg-emerald-300";
  if (tone === "amber") return "bg-amber-300";
  if (tone === "red") return "bg-red-400";
  return "bg-slate-600";
}

export function DiscoveryFlowPanel({ reducedMotion }: DiscoveryFlowPanelProps): JSX.Element {
  return (
    <section className="mx-auto w-full">
      <div className="rounded-[2.25rem] border border-border/70 bg-white/82 p-5 shadow-[0_24px_64px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-[hsl(var(--border)/0.94)] dark:bg-[hsl(var(--bg-surface)/0.94)] sm:p-6">
        <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
          {["预发布通信压测", "高密度模糊输入", "崩溃停机定位"].map((item) => (
            <span
              key={item}
              className="rounded-full border border-border/70 bg-background/88 px-4 py-2 text-[13px] font-semibold tracking-[0.18em] text-[hsl(var(--text-secondary))] dark:bg-[hsl(var(--bg-surface-elevated)/0.9)]"
            >
              {item}
            </span>
          ))}
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_1.34fr_1.16fr]">
          <div className="rounded-[1.9rem] border border-border/60 bg-background/90 p-4 dark:bg-[hsl(var(--bg-surface-elevated)/0.96)]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-[1.05rem] font-semibold text-[hsl(var(--text-primary))]">
                <Radar className="size-4 text-[hsl(var(--accent-blue))]" />
                工控设备示意
              </div>
              <span className="rounded-full border border-[hsl(var(--color-danger)/0.2)] bg-[hsl(var(--color-danger)/0.08)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[hsl(var(--color-danger))]">
                line halted
              </span>
            </div>

            <div className="mt-4 overflow-hidden rounded-[1.45rem] border border-slate-300/70 bg-[linear-gradient(180deg,#eef2f7,#dde6ef)] px-3 py-3 shadow-[0_18px_36px_rgba(15,23,42,0.06)] dark:border-slate-700/80 dark:bg-[linear-gradient(180deg,rgba(71,85,105,0.34),rgba(30,41,59,0.18))]">
              <img
                src="/home-device.svg"
                alt="工控设备示意图"
                className="block h-auto w-full"
                draggable={false}
              />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[1.45rem] border border-slate-300/70 bg-[linear-gradient(180deg,#edf2f8,#d9e1eb)] p-3 shadow-[0_20px_40px_rgba(15,23,42,0.08)] dark:border-slate-700/80 dark:bg-[linear-gradient(180deg,rgba(71,85,105,0.94),rgba(30,41,59,0.98))]">
                <div className="rounded-[1.12rem] border border-slate-300/70 bg-white/92 p-3 dark:border-slate-700/80 dark:bg-slate-950/74">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                        Physical Unit
                      </p>
                      <p className="mt-1 text-base font-semibold text-slate-800 dark:text-slate-100">
                        PLC-Station A
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <span className="size-2.5 rounded-full bg-emerald-400/70" />
                      <span className="size-2.5 rounded-full bg-amber-300/80" />
                      <span
                        className="size-2.5 rounded-full bg-red-400"
                        style={{ animation: reducedMotion ? "none" : "homeAlarmBlink 1.4s ease-in-out infinite" }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 rounded-[1rem] border border-slate-200/90 bg-slate-100/94 p-3 dark:border-slate-800/80 dark:bg-slate-900/92">
                    <div className="grid grid-cols-[0.92fr_1.08fr] gap-2.5">
                      <div className="rounded-[0.92rem] border border-slate-200/80 bg-white/94 px-2.5 py-3 dark:border-slate-700/80 dark:bg-slate-800/90">
                        <div className="rounded-[0.72rem] border border-slate-300/80 bg-[linear-gradient(180deg,#dbeafe,#bfdbfe)] p-2 dark:border-slate-600/80 dark:bg-[linear-gradient(180deg,rgba(37,99,235,0.2),rgba(30,41,59,0.4))]">
                          <div className="h-10 rounded-md border border-dashed border-slate-300/90 bg-white/60 dark:border-slate-600/80 dark:bg-slate-900/52" />
                        </div>
                        <p className="mt-2 text-center text-[10px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                          hmi panel
                        </p>
                      </div>

                      <div className="rounded-[0.92rem] border border-slate-200/80 bg-white/94 px-2.5 py-3 dark:border-slate-700/80 dark:bg-slate-800/90">
                        <div className="space-y-2">
                          {[0, 1, 2].map((row) => (
                            <div key={row} className="grid grid-cols-4 gap-1.5">
                              {[0, 1, 2, 3].map((cell) => (
                                <span
                                  key={`${row}-${cell}`}
                                  className="h-2 rounded-full bg-slate-300/90 dark:bg-slate-600/90"
                                />
                              ))}
                            </div>
                          ))}
                        </div>
                        <p className="mt-2 text-center text-[10px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                          io rack
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 rounded-[0.9rem] border border-slate-200/80 bg-white/94 px-2.5 py-2.5 dark:border-slate-700/80 dark:bg-slate-800/90">
                      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                        <span>Comms</span>
                        <span className="text-red-400">unstable</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700">
                        <div className="h-2 w-1/4 rounded-full bg-[linear-gradient(90deg,#f59e0b,#ef4444)]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid gap-4 lg:grid-cols-[0.88fr_1.12fr]">
                  <div
                    className="rounded-[1.45rem] border border-slate-700/90 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] p-3 shadow-[0_18px_40px_rgba(2,6,23,0.32)]"
                    style={{ animation: reducedMotion ? "none" : "homeScreenFlicker 4.8s linear infinite" }}
                  >
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      <span>HMI-01</span>
                      <span className="text-rose-300">production stop</span>
                    </div>
                    <div className="mt-3 h-20 text-slate-200">
                      <DeviceTrend />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {[
                        { label: "Pump", value: "OFF" },
                        { label: "Valve", value: "ERR" },
                        { label: "Output", value: "0%" },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="rounded-xl border border-slate-700/80 bg-slate-900/75 px-2.5 py-2 text-center"
                        >
                          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                          <p className="mt-1 text-sm font-semibold text-slate-100">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="relative mx-auto w-full max-w-[16rem]">
                    <div className="absolute inset-x-[10%] bottom-0 h-4 rounded-full bg-slate-950/18 blur-xl" />
                    <div
                      className="rounded-[1.65rem] border border-slate-700/80 bg-[linear-gradient(180deg,rgba(51,65,85,0.98),rgba(15,23,42,0.98))] p-3 shadow-[0_24px_48px_rgba(15,23,42,0.3)]"
                      style={{ animation: reducedMotion ? "none" : "homeCabinetAlarm 1.8s cubic-bezier(0.32,0,0.18,1) infinite" }}
                    >
                      <div className="rounded-[1.18rem] border border-slate-600/80 bg-slate-950/86 p-3">
                        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-slate-400">
                          <span>PLC rack</span>
                          <span className="text-rose-300">fault</span>
                        </div>
                        <div className="mt-3 grid grid-cols-4 gap-2">
                          {rackModules.map((module) => (
                            <div
                              key={module.label}
                              className="rounded-[0.92rem] border border-slate-700/80 bg-slate-900/88 px-2 py-3"
                            >
                              <p className="text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                {module.label}
                              </p>
                              <div className="mt-3 space-y-1.5">
                                {module.leds.map((led, index) => (
                                  <span
                                    key={`${module.label}-${led}-${index}`}
                                    className={cn("block h-1.5 rounded-full", ledClass(led))}
                                    style={{
                                      opacity: led === "off" ? 0.75 : 1,
                                      animation:
                                        (led === "red" || led === "amber") && !reducedMotion
                                          ? `homeStatusBlink 1.1s ease-in-out ${index * 0.12}s infinite`
                                          : "none",
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-3 rounded-[1rem] border border-slate-700/70 bg-slate-950/74 px-3 py-3">
                        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-slate-500">
                          <span>Station-A</span>
                          <span className="text-rose-300">maintenance stop</span>
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-slate-800/90">
                          <div
                            className="h-2 origin-left rounded-full bg-[linear-gradient(90deg,#f97316,#ef4444)]"
                            style={{
                              width: "100%",
                              transform: reducedMotion ? "scaleX(0.08)" : undefined,
                              animation:
                                reducedMotion ? "none" : "homeThroughputDrop 4s cubic-bezier(0.34,1,0.64,1) infinite",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-[1.35rem] border border-border/60 bg-card/78 px-4 py-3 dark:bg-[hsl(var(--bg-surface)/0.96)]">
                  <div className="flex flex-col gap-2 rounded-full bg-slate-950/88 px-2 py-2">
                    {["green", "amber", "red"].map((tone, index) => (
                      <span
                        key={tone}
                        className={cn(
                          "size-3 rounded-full",
                          tone === "green" && "bg-emerald-400/40",
                          tone === "amber" && "bg-amber-300/40",
                          tone === "red" && "bg-red-400",
                        )}
                        style={{
                          boxShadow: tone === "red" ? "0 0 18px rgba(248,113,113,0.56)" : "none",
                          animation:
                            tone === "red" && !reducedMotion
                              ? `homeAlarmBlink 1.35s ease-in-out ${index * 0.08}s infinite`
                              : "none",
                        }}
                      />
                    ))}
                  </div>
                  <div>
                    <p className="text-base font-semibold text-[hsl(var(--text-primary))]">设备进入保护停机态</p>
                    <p className="mt-1 text-[14px] leading-6 text-[hsl(var(--text-tertiary))]">
                      通信输入洪流击穿解析路径后，控制输出撤离，现场设备切换为停机保护。
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr]">
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-2">
                {deviceMetrics.map((item) => (
                  <div
                    key={item.label}
                    className={cn(
                      "rounded-2xl border border-border/60 bg-card/78 px-3 py-3 text-center dark:bg-[hsl(var(--bg-surface)/0.96)]",
                      item.label === "Line speed" && "col-span-2",
                    )}
                  >
                    <p className="text-[11px] uppercase tracking-[0.14em] text-[hsl(var(--text-tertiary))]">{item.label}</p>
                    <p className="mt-2 text-[1.02rem] font-semibold text-[hsl(var(--text-primary))]">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {deviceSignals.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-border/60 bg-card/78 px-3.5 py-3 dark:bg-[hsl(var(--bg-surface)/0.96)]"
                  >
                    <p className="text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--text-tertiary))]">{item.label}</p>
                    <p className="mt-2 text-[14px] font-medium text-[hsl(var(--text-primary))]">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[1.9rem] border border-border/60 bg-background/90 p-4 dark:bg-[hsl(var(--bg-surface-elevated)/0.96)]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-[1.05rem] font-semibold text-[hsl(var(--text-primary))]">
                <Activity className="size-4 text-[hsl(var(--accent-orange))]" />
                模糊输入洪流
              </div>
              <span className="rounded-full border border-[hsl(var(--accent-orange)/0.16)] bg-[hsl(var(--accent-orange-light)/0.24)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[hsl(var(--accent-orange))]">
                packet storm
              </span>
            </div>

            <div className="mt-4 rounded-[1.55rem] border border-border/60 bg-[linear-gradient(180deg,rgba(15,23,42,0.04),rgba(15,23,42,0.08))] p-3 dark:bg-[linear-gradient(180deg,rgba(8,10,18,0.82),rgba(18,20,34,0.94))]">
              <div className="grid gap-4 lg:grid-cols-[0.78fr_1.22fr]">
                <div className="space-y-3">
                  {[
                    "长度、字段、时序交叉变异",
                    "多协议轮转持续回放",
                    "高密度批量通信压测",
                  ].map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-border/60 bg-card/78 px-3 py-3 text-[15px] leading-7 text-[hsl(var(--text-secondary))] dark:bg-[hsl(var(--bg-surface)/0.96)]"
                    >
                      {item}
                    </div>
                  ))}
                </div>

                <div className="relative h-[16rem] overflow-hidden rounded-[1.35rem] border border-slate-800/20 bg-[linear-gradient(180deg,rgba(15,23,42,0.95),rgba(2,6,23,0.98))]">
                  <div className="absolute inset-x-5 top-5 flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-slate-400">
                    <span>mutator bus</span>
                    <span className="text-rose-300">parser overload</span>
                  </div>

                  {[18, 34, 50, 66, 82].map((top) => (
                    <span
                      key={top}
                      className="absolute left-6 right-20 h-px bg-[linear-gradient(90deg,rgba(59,130,246,0.12),rgba(249,115,22,0.18),rgba(236,72,153,0.12))]"
                      style={{ top: `${top}%` }}
                    />
                  ))}

                  {packetBursts.map((packet) => (
                    <span
                      key={`${packet.label}-${packet.delay}`}
                      className={cn(
                        "absolute left-5 rounded-full border px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.16em]",
                        toneClass(packet.tone),
                      )}
                      style={{
                        top: packet.top,
                        animation: reducedMotion ? "none" : `homePacketBurst 3.6s linear ${packet.delay} infinite`,
                      }}
                    >
                      {packet.label}
                    </span>
                  ))}

                  <div className="absolute right-4 top-1/2 w-[5.6rem] -translate-y-1/2 rounded-[1.25rem] border border-red-400/30 bg-[linear-gradient(180deg,rgba(127,29,29,0.52),rgba(69,10,10,0.86))] p-3 shadow-[0_0_0_1px_rgba(248,113,113,0.12)]">
                    <div
                      className="rounded-[0.95rem] border border-red-300/24 bg-red-950/50 px-3 py-4 text-center"
                      style={{ animation: reducedMotion ? "none" : "homeAlarmBlink 1.5s ease-in-out infinite" }}
                    >
                      <p className="text-[10px] uppercase tracking-[0.18em] text-red-200/80">fault gate</p>
                      <p className="mt-2 text-sm font-semibold text-red-50">segfault</p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-red-200/70">signal 11</p>
                    </div>
                  </div>

                  <div className="absolute inset-x-5 bottom-4">
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      <span>throughput</span>
                      <span className="text-red-300">182k/min -&gt; 0</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-800/90">
                      <div
                        className="h-2 origin-left rounded-full bg-[linear-gradient(90deg,#38bdf8,#f97316,#ef4444)]"
                        style={{
                          width: "100%",
                          transform: reducedMotion ? "scaleX(0.06)" : undefined,
                          animation:
                            reducedMotion ? "none" : "homeThroughputDrop 3.4s cubic-bezier(0.34,1,0.64,1) infinite",
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {stormMetrics.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-border/60 bg-card/78 px-3.5 py-4 dark:bg-[hsl(var(--bg-surface)/0.96)]"
                  >
                    <p className="text-[11px] uppercase tracking-[0.16em] text-[hsl(var(--text-tertiary))]">{item.label}</p>
                    <p className="mt-2 whitespace-nowrap text-[1.05rem] font-semibold text-[hsl(var(--text-primary))]">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {stormStages.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-border/60 bg-card/78 px-3.5 py-4 dark:bg-[hsl(var(--bg-surface)/0.96)]"
                  >
                    <p className="text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--text-tertiary))]">{item.label}</p>
                    <p className="mt-2 text-[14px] leading-6 text-[hsl(var(--text-primary))]">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[1.9rem] border border-border/60 bg-background/90 p-4 dark:bg-[hsl(var(--bg-surface-elevated)/0.96)]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-[1.05rem] font-semibold text-[hsl(var(--text-primary))]">
                <Target className="size-4 text-[hsl(var(--accent-pink))]" />
                崩溃点与函数定位
              </div>
              <span className="rounded-full border border-[hsl(var(--accent-pink)/0.2)] bg-[hsl(var(--accent-pink)/0.1)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[hsl(var(--accent-pink))]">
                root cause
              </span>
            </div>

            <div className="mt-4 rounded-[1.35rem] border border-[hsl(var(--color-danger)/0.18)] bg-[linear-gradient(180deg,hsl(var(--color-danger)/0.08),transparent)] px-4 py-3 dark:bg-[linear-gradient(180deg,hsl(var(--color-danger)/0.14),transparent)]">
              <p className="text-base font-semibold text-[hsl(var(--color-danger))]">产线停机保护已触发</p>
              <p className="mt-1 text-[14px] leading-6 text-[hsl(var(--text-tertiary))]">
                异常输入命中核心解析路径，输出回路撤离，需回放样本并定位崩溃函数。
              </p>
            </div>

            <div className="mt-4 space-y-3">
              {functionFrames.map((item, index) => (
                <div
                  key={item}
                  className={cn(
                    "rounded-2xl border px-3 py-3 transition-all",
                    index === 1
                      ? "border-[hsl(var(--accent-pink)/0.4)] bg-[hsl(var(--accent-pink)/0.1)] shadow-[0_0_0_1px_rgba(236,72,153,0.12)]"
                      : "border-border/60 bg-card/78 dark:bg-[hsl(var(--bg-surface)/0.96)]",
                  )}
                  style={{
                    animation: index === 1 && !reducedMotion ? "homePulseRing 2.2s ease-in-out infinite" : "none",
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[15px] font-medium text-[hsl(var(--text-primary))]">{item}</p>
                    <span className="rounded-full bg-background/80 px-2 py-1 font-mono text-[11px] text-[hsl(var(--text-tertiary))] dark:bg-[hsl(var(--bg-primary)/0.9)]">
                      frame {index + 3}
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] leading-6 text-[hsl(var(--text-tertiary))]">
                    {index === 1 ? "崩溃样本命中主解析分支，参数回溯已锁定。" : "回溯栈帧与调用参数映射已建立。"}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-3">
              {outageEvents.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-border/60 bg-card/78 p-3 dark:bg-[hsl(var(--bg-surface)/0.96)]"
                >
                  <div className="flex items-center justify-between text-[13px] text-[hsl(var(--text-secondary))]">
                    <span>{item.id}</span>
                    <span>{item.signal}</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-slate-900/8 dark:bg-white/6">
                    <div
                      className="h-2 rounded-full bg-[linear-gradient(90deg,hsl(var(--accent-orange)),hsl(var(--color-danger)))]"
                      style={{ width: `${item.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-[1.35rem] border border-border/60 bg-card/78 p-3 dark:bg-[hsl(var(--bg-surface)/0.96)]">
              <p className="text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--text-tertiary))]">trace</p>
              <div className="mt-3 flex items-center gap-2 text-[13px] text-[hsl(var(--text-secondary))]">
                <span className="rounded-full bg-[hsl(var(--accent-pink)/0.12)] px-2.5 py-1 text-[hsl(var(--accent-pink))]">
                  pc+0x2f
                </span>
                <span className="text-[hsl(var(--text-tertiary))]">-&gt;</span>
                <span>payload.len &gt; header.len</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

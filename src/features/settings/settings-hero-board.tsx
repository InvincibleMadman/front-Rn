import type { ReactNode } from "react";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  SettingsCapabilityGrid,
  type SettingsCapabilityItem,
} from "@/features/settings/settings-capability-grid";
import {
  SettingsSecurityPosture,
  type SettingsSecurityCheck,
} from "@/features/settings/settings-security-posture";
import {
  SettingsStatusChip,
  type SettingsStatusTone,
} from "@/features/settings/settings-status-chip";

export interface SettingsHeroChip {
  label: string;
  value?: string;
  tone?: SettingsStatusTone;
}

export interface SettingsHeroSignalItem {
  label: string;
  value: string;
  tone?: SettingsStatusTone;
  mono?: boolean;
}

export interface SettingsHeroSignalPanel {
  id: string;
  eyebrow: string;
  title: string;
  value: string;
  description: string;
  tone?: SettingsStatusTone;
  items: SettingsHeroSignalItem[];
}

export function SettingsHeroBoard({
  eyebrow,
  title,
  description,
  chips,
  actions,
  signalPanels,
  securityPosture,
  capabilities,
}: {
  eyebrow: string;
  title: string;
  description: string;
  chips: SettingsHeroChip[];
  actions: ReactNode;
  signalPanels: SettingsHeroSignalPanel[];
  securityPosture: {
    score: number;
    passed: number;
    total: number;
    available: boolean;
    checks: SettingsSecurityCheck[];
    highlightDefaultSecretWarning: boolean;
  };
  capabilities: SettingsCapabilityItem[];
}): JSX.Element {
  return (
    <section className="settings-hero-board">
      <div className="settings-hero-board__bg" aria-hidden="true" />
      <div className="settings-hero-board__mesh" aria-hidden="true" />

      <div className="relative space-y-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_auto] lg:items-start">
          <div className="space-y-4">
            <CardHeader className="space-y-3 p-0">
              <div className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">{eyebrow}</div>
              <div className="space-y-2">
                <CardTitle className="text-[clamp(1.8rem,3vw,2.8rem)] leading-none tracking-tight">{title}</CardTitle>
                <CardDescription className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
                  {description}
                </CardDescription>
              </div>
            </CardHeader>

            <div className="flex flex-wrap gap-2.5">
              {chips.map((chip) => (
                <SettingsStatusChip
                  key={`${chip.label}-${chip.value ?? ""}`}
                  label={chip.label}
                  value={chip.value}
                  tone={chip.tone}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 lg:justify-end">{actions}</div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {signalPanels.map((panel) => (
            <div key={panel.id} className="settings-hero-panel">
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{panel.eyebrow}</p>
                  <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{panel.title}</p>
                      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{panel.value}</p>
                    </div>
                    <SettingsStatusChip
                      label={panel.tone === "danger" ? "warning" : panel.tone === "success" ? "ready" : "status"}
                      value={panel.tone === "danger" ? "attention" : panel.tone === "success" ? "stable" : "live"}
                      tone={panel.tone}
                    />
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{panel.description}</p>
                </div>

                <div className="grid gap-2">
                  {panel.items.map((item) => (
                    <div
                      key={`${panel.id}-${item.label}`}
                      className="flex flex-col gap-1.5 rounded-[var(--radius-lg)] border border-border/55 bg-background/55 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
                    >
                      <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{item.label}</span>
                      <span
                        className={[
                          "text-right text-sm font-medium",
                          item.mono ? "break-all font-mono text-[12px]" : "",
                          item.tone === "success"
                            ? "text-success"
                            : item.tone === "warning"
                              ? "text-warning"
                              : item.tone === "danger"
                                ? "text-danger"
                                : item.tone === "info"
                                  ? "text-primary"
                                  : "text-foreground",
                        ].join(" ")}
                      >
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)]">
          <SettingsSecurityPosture
            score={securityPosture.score}
            passed={securityPosture.passed}
            total={securityPosture.total}
            available={securityPosture.available}
            checks={securityPosture.checks}
            highlightDefaultSecretWarning={securityPosture.highlightDefaultSecretWarning}
          />
          <SettingsCapabilityGrid items={capabilities} />
        </div>
      </div>
    </section>
  );
}

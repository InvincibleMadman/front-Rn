import { useEffect, useRef, type ComponentType } from "react";
import { cn } from "@/lib/utils/cn";

export interface SettingsTabsBarItem {
  id: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  badge?: {
    tone: "warning" | "partial";
    label: string;
  };
}

export function SettingsTabsBar({
  items,
  activeTab,
  onChange,
}: {
  items: SettingsTabsBarItem[];
  activeTab: string;
  onChange: (tab: string) => void;
}): JSX.Element {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const activeElement = scrollRef.current?.querySelector<HTMLButtonElement>('[data-active="true"]');
    if (!activeElement) return;

    const prefersReducedMotion =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    activeElement.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeTab]);

  return (
    <div className="settings-tabs-bar">
      <div
        ref={scrollRef}
        className="settings-tabs-bar__scroll console-scrollbar"
        role="tablist"
        aria-label="系统设置分区"
      >
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.id === activeTab;

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-current={active ? "page" : undefined}
              onClick={() => onChange(item.id)}
              className={cn("settings-tab-pill", active && "settings-tab-pill--active")}
              data-active={active ? "true" : "false"}
              title={item.description}
            >
              <span className="settings-tab-pill__icon">
                <Icon className="size-4" />
              </span>
              <span className="settings-tab-pill__label">{item.label}</span>
              {item.badge ? (
                <>
                  <span className="settings-tab-pill__badge" data-tone={item.badge.tone} aria-hidden="true" />
                  <span className="sr-only">{item.badge.label}</span>
                </>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export interface AssetFileTypeOption {
  value: string;
  label: string;
  count?: number;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface AssetFileTypeOverflowSelectorProps {
  options: AssetFileTypeOption[];
  value: string;
  onValueChange: (value: string) => void;
  actionSlot?: ReactNode;
  className?: string;
  moreLabel?: string;
}

const SELECTOR_GAP = 12;
const BUTTON_GAP = 6;
const FALLBACK_MORE_WIDTH = 78;

function estimateOptionWidth(option: AssetFileTypeOption): number {
  const labelWidth = Math.max(42, option.label.length * 14);
  const countWidth = option.count === undefined ? 0 : String(option.count).length * 8 + 18;
  const iconWidth = option.icon ? 18 : 0;
  return labelWidth + countWidth + iconWidth + 32;
}

function sameWidthRecord(left: Record<string, number>, right: Record<string, number>): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => left[key] === right[key]);
}

function buildOptionButtonClass(active: boolean, disabled = false): string {
  return cn(
    buttonVariants({ variant: "outline", size: "sm" }),
    "max-w-full shrink-0 gap-1.5 rounded-full border px-3",
    active
      ? "border-[hsl(var(--accent-blue)/0.40)] bg-[hsl(var(--accent-blue)/0.10)] text-foreground hover:bg-[hsl(var(--accent-blue)/0.14)]"
      : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
    disabled && "pointer-events-none opacity-50",
  );
}

function buildMenuItemClass(active: boolean, disabled = false): string {
  return cn(
    "flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-transparent px-3 py-2 text-left text-sm transition-colors",
    active
      ? "bg-[hsl(var(--accent-blue)/0.10)] text-foreground"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
    disabled && "pointer-events-none opacity-50",
  );
}

function renderOptionContent(option: AssetFileTypeOption, active: boolean): JSX.Element {
  return (
    <>
      {option.icon ? <span className={cn("shrink-0", active ? "text-[hsl(var(--accent-blue))]" : "text-muted-foreground")}>{option.icon}</span> : null}
      <span className="truncate">{option.label}</span>
      {option.count !== undefined ? (
        <span className={cn("shrink-0 text-[11px]", active ? "text-foreground/80" : "text-muted-foreground")}>
          {option.count}
        </span>
      ) : null}
    </>
  );
}

export function AssetFileTypeOverflowSelector({
  options,
  value,
  onValueChange,
  actionSlot,
  className,
  moreLabel = "更多",
}: AssetFileTypeOverflowSelectorProps): JSX.Element {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const actionsRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  const [itemWidths, setItemWidths] = useState<Record<string, number>>({});
  const [moreWidth, setMoreWidth] = useState(FALLBACK_MORE_WIDTH);
  const [menuOpen, setMenuOpen] = useState(false);

  const resolvedOptions = useMemo(() => {
    if (options.length === 0) return [] as AssetFileTypeOption[];
    const selected = options.find((item) => item.value === value);
    if (selected) return options;
    return [{ value, label: value }, ...options];
  }, [options, value]);

  const selectedOption = useMemo(
    () => resolvedOptions.find((item) => item.value === value) ?? resolvedOptions[0] ?? null,
    [resolvedOptions, value],
  );

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const update = (): void => {
      const rootWidth = root.getBoundingClientRect().width;
      const actionsWidth = actionsRef.current?.getBoundingClientRect().width ?? 0;
      setAvailableWidth(Math.max(0, rootWidth - actionsWidth - SELECTOR_GAP));
    };

    update();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(update);
      observer.observe(root);
      if (actionsRef.current) observer.observe(actionsRef.current);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [actionSlot]);

  useLayoutEffect(() => {
    const measureRoot = measureRef.current;
    if (!measureRoot) return;

    const nextWidths: Record<string, number> = {};
    measureRoot.querySelectorAll<HTMLElement>("[data-measure-value]").forEach((element) => {
      const key = element.dataset.measureValue;
      if (!key) return;
      nextWidths[key] = Math.ceil(element.getBoundingClientRect().width);
    });

    const measuredMoreWidth = measureRoot.querySelector<HTMLElement>("[data-measure-more]")?.getBoundingClientRect().width;

    setItemWidths((current) => (sameWidthRecord(current, nextWidths) ? current : nextWidths));
    if (measuredMoreWidth) {
      const width = Math.ceil(measuredMoreWidth);
      setMoreWidth((current) => (current === width ? current : width));
    }
  }, [resolvedOptions, moreLabel, value, actionSlot]);

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: MouseEvent): void => {
      const target = event.target as Node | null;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }
      setMenuOpen(false);
    };

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  const { visibleOptions, hiddenOptions } = useMemo(() => {
    if (resolvedOptions.length === 0) {
      return {
        visibleOptions: [] as AssetFileTypeOption[],
        hiddenOptions: [] as AssetFileTypeOption[],
      };
    }

    const visible: AssetFileTypeOption[] = [];
    const hidden: AssetFileTypeOption[] = [];
    let used = 0;

    for (const item of resolvedOptions) {
      const width = itemWidths[item.value] ?? estimateOptionWidth(item);
      const gap = visible.length > 0 ? BUTTON_GAP : 0;
      if (used + gap + width <= availableWidth || visible.length === 0) {
        visible.push(item);
        used += gap + width;
      } else {
        hidden.push(item);
      }
    }

    if (hidden.length > 0) {
      const reservedWidth = moreWidth + BUTTON_GAP;
      while (visible.length > 1 && used + reservedWidth > availableWidth) {
        const moved = visible.pop();
        if (!moved) break;
        hidden.unshift(moved);
        used = visible.reduce((total, item, index) => {
          const width = itemWidths[item.value] ?? estimateOptionWidth(item);
          return total + width + (index > 0 ? BUTTON_GAP : 0);
        }, 0);
      }
    }

    return {
      visibleOptions: visible,
      hiddenOptions: hidden,
    };
  }, [availableWidth, itemWidths, moreWidth, resolvedOptions, selectedOption]);

  useEffect(() => {
    if (hiddenOptions.length === 0 && menuOpen) {
      setMenuOpen(false);
    }
  }, [hiddenOptions.length, menuOpen]);

  return (
    <div ref={rootRef} className={cn("relative flex min-h-0 min-w-0 items-start gap-3", className)}>
      <div className="min-h-0 min-w-0 flex-1">
        {resolvedOptions.length === 0 ? (
          <div className="flex h-8 items-center text-sm text-muted-foreground">暂无类型</div>
        ) : (
          <div className="flex min-h-0 min-w-0 items-center gap-1.5">
            <div className="flex min-h-0 min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
              {visibleOptions.map((option) => {
                const active = option.value === selectedOption?.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={buildOptionButtonClass(active, option.disabled)}
                    onClick={() => {
                      if (option.disabled) return;
                      onValueChange(option.value);
                      setMenuOpen(false);
                    }}
                    title={option.label}
                  >
                    {renderOptionContent(option, active)}
                  </button>
                );
              })}
            </div>

            {hiddenOptions.length > 0 ? (
              <div className="relative shrink-0 overflow-visible">
                <button
                  ref={triggerRef}
                  type="button"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "gap-1.5 rounded-full border border-border bg-background px-3 text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((current) => !current)}
                >
                  <span>{moreLabel}</span>
                  <ChevronDown className="size-3.5" />
                </button>

                {menuOpen ? (
                  <div
                    ref={menuRef}
                    className="absolute left-0 top-full z-20 mt-2 w-[min(17.5rem,calc(100vw-2rem))] max-h-80 overflow-y-auto rounded-[var(--radius-lg)] border border-border bg-popover p-1.5 text-popover-foreground shadow-console"
                    role="menu"
                  >
                    {hiddenOptions.map((option) => {
                      const active = option.value === selectedOption?.value;
                      return (
                        <button
                          key={`hidden-${option.value}`}
                          type="button"
                          className={buildMenuItemClass(active, option.disabled)}
                          role="menuitem"
                          onClick={() => {
                            if (option.disabled) return;
                            onValueChange(option.value);
                            setMenuOpen(false);
                          }}
                        >
                          <span className="flex min-w-0 flex-1 items-center gap-3">
                            {option.icon ? <span className="shrink-0 text-muted-foreground">{option.icon}</span> : null}
                            <span className="truncate text-foreground">{option.label}</span>
                          </span>
                          {option.count !== undefined ? (
                            <span className="shrink-0 text-xs text-muted-foreground">{option.count}</span>
                          ) : null}
                          {active ? <Check className="size-4 shrink-0 text-[hsl(var(--accent-blue))]" /> : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div ref={actionsRef} className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {actionSlot}
      </div>

      <div ref={measureRef} className="pointer-events-none fixed left-[-10000px] top-[-10000px] z-[-1] flex items-center gap-1.5 opacity-0">
        {resolvedOptions.map((option) => {
          const active = option.value === selectedOption?.value;
          return (
            <button
              key={`measure-${option.value}`}
              type="button"
              data-measure-value={option.value}
              className={buildOptionButtonClass(active, option.disabled)}
            >
              {renderOptionContent(option, active)}
            </button>
          );
        })}
        <button
          type="button"
          data-measure-more
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "gap-1.5 rounded-full border border-border bg-background px-3 text-muted-foreground",
          )}
        >
          <span>{moreLabel}</span>
          <ChevronDown className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

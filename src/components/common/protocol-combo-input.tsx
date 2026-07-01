import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

function normalizeProtocolText(value?: string | null): string {
  return value?.trim() ?? "";
}

export function resolveExistingProtocol(value: string, options: string[]): string | null {
  const current = normalizeProtocolText(value).toLowerCase();
  if (!current) return null;
  const matched = options.find((item) => item.trim().toLowerCase() === current);
  return matched ? matched.trim() : null;
}

export function ProtocolComboInput({
  value,
  options,
  placeholder = "输入并匹配已有协议名",
  onValueChange,
  onCommit,
  onOpen,
}: {
  value: string;
  options: string[];
  placeholder?: string;
  onValueChange: (value: string) => void;
  onCommit?: (value: string) => void | Promise<void>;
  onOpen?: () => void | Promise<void>;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const current = normalizeProtocolText(value);
  const matched = resolveExistingProtocol(current, options);

  const filtered = useMemo(() => {
    const keyword = current.toLowerCase();
    const source = options.map((item) => item.trim()).filter(Boolean);
    const unique = Array.from(new Set(source));

    if (!keyword) return unique.slice(0, 12);

    return unique.filter((item) => item.toLowerCase().includes(keyword)).slice(0, 12);
  }, [current, options]);

  const toggleDropdown = (): void => {
    setOpen((prev) => {
      const next = !prev;
      if (next) void onOpen?.();
      return next;
    });
  };

  const openDropdown = (): void => {
    setOpen(true);
    void onOpen?.();
  };

  const commit = async (nextValue?: string): Promise<void> => {
    const normalized = normalizeProtocolText(nextValue ?? current);
    const exact = resolveExistingProtocol(normalized, options);
    if (!exact) {
      setOpen(false);
      return;
    }

    onValueChange(exact);
    setOpen(false);
    await onCommit?.(exact);
  };

  return (
    <div className="relative w-full overflow-visible">
      <Input
        value={value}
        placeholder={placeholder}
        className={cn(
          "pr-10 focus-visible:ring-inset",
          current && !matched && "border-warning/60 text-warning focus-visible:ring-warning/40",
        )}
        onChange={(event) => {
          onValueChange(event.target.value);
          openDropdown();
        }}
        onBlur={() => {
          window.setTimeout(() => {
            setOpen(false);
            void commit();
          }, 120);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void commit(current);
          }

          if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      <button
        type="button"
        className="absolute inset-y-0 right-2 inline-flex items-center justify-center rounded-md px-1 text-muted-foreground hover:text-foreground"
        onMouseDown={(event) => event.preventDefault()}
        onClick={toggleDropdown}
        aria-label="展开协议列表"
      >
        <ChevronDown className="size-4" />
      </button>

      {open ? (
        <div className="absolute inset-x-0 top-[calc(100%+0.25rem)] z-50 max-h-60 w-full overflow-y-auto rounded-[var(--radius-lg)] border border-border bg-popover p-1 shadow-console">
          {filtered.length ? (
            filtered.map((protocol) => (
              <button
                key={protocol}
                type="button"
                className="flex w-full min-w-0 items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void commit(protocol)}
              >
                <span className="min-w-0 truncate">{protocol}</span>
                <span className="shrink-0 text-xs text-muted-foreground">已有</span>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-muted-foreground">暂无匹配协议</div>
          )}
        </div>
      ) : null}

      {current && !matched ? (
        <p className="mt-2 text-xs text-warning">必须完全匹配已有协议资产名后才能提交。</p>
      ) : null}
    </div>
  );
}

import { Search, Sparkles } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AssetSearchSuggestions } from "@/features/assets/asset-search-suggestions";
import {
  ASSET_QUERY_EXAMPLES,
  buildAssetQuerySuggestions,
  type AssetQuerySuggestion,
} from "@/features/assets/asset-utils";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

interface AssetQueryInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  pathSuggestions?: string[];
  placeholder?: string;
  className?: string;
  showContentHint?: boolean;
}

export function AssetQueryInput({
  value,
  onChange,
  onSubmit,
  pathSuggestions = [],
  placeholder = "输入文件名或 key:value 查询",
  className,
  showContentHint = false,
}: AssetQueryInputProps): JSX.Element {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const suggestions = useMemo(
    () => buildAssetQuerySuggestions(value, pathSuggestions),
    [pathSuggestions, value],
  );

  useEffect(() => {
    setHighlightedIndex(0);
  }, [suggestions]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const applySuggestion = (suggestion: AssetQuerySuggestion): void => {
    onChange(suggestion.insertValue);
    setOpen(false);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      if (onSubmit && suggestion.kind === "example") {
        onSubmit(suggestion.insertValue);
      }
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setHighlightedIndex((current) => (current + 1) % Math.max(suggestions.length, 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setHighlightedIndex((current) => (current - 1 + Math.max(suggestions.length, 1)) % Math.max(suggestions.length, 1));
      return;
    }

    if (event.key === "Escape") {
      setOpen(false);
      return;
    }

    if (event.key === "Enter") {
      if (open && suggestions[highlightedIndex]) {
        event.preventDefault();
        applySuggestion(suggestions[highlightedIndex]);
        return;
      }
      onSubmit?.(value);
    }
  };

  return (
    <div ref={rootRef} className={cn("relative min-w-0", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="h-11 rounded-[var(--radius-xl)] border-border/80 bg-background/70 pl-10 pr-3 font-mono text-sm"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
        />
      </div>

      {!value.trim() ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>示例：</span>
          {ASSET_QUERY_EXAMPLES.slice(0, 4).map((example) => (
            <button
              key={example}
              type="button"
              className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 font-mono hover:bg-muted"
              onClick={() => {
                onChange(example);
                onSubmit?.(example);
              }}
            >
              {example}
            </button>
          ))}
        </div>
      ) : null}

      {showContentHint ? (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="size-3.5 text-[hsl(var(--accent-orange))]" />
          <span>只有写入 `content:` 或手动开启内容搜索时，才会请求后端内容搜索。</span>
        </div>
      ) : null}

      <div id={listId}>
        <AssetSearchSuggestions
          open={open}
          suggestions={suggestions}
          highlightedIndex={highlightedIndex}
          onSelect={applySuggestion}
        />
      </div>
    </div>
  );
}

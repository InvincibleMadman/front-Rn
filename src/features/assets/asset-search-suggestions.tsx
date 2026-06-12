import { FileSearch, FolderTree, Search, Shapes, Sparkles } from "lucide-react";
import type { AssetQuerySuggestion } from "@/features/assets/asset-utils";
import { cn } from "@/lib/utils/cn";

function suggestionIcon(kind: AssetQuerySuggestion["kind"]): JSX.Element {
  switch (kind) {
    case "scope":
      return <FolderTree className="size-4" />;
    case "ext":
      return <FileSearch className="size-4" />;
    case "type":
      return <Shapes className="size-4" />;
    case "content":
      return <Sparkles className="size-4" />;
    case "path":
      return <FolderTree className="size-4" />;
    case "example":
    default:
      return <Search className="size-4" />;
  }
}

interface AssetSearchSuggestionsProps {
  open: boolean;
  suggestions: AssetQuerySuggestion[];
  highlightedIndex: number;
  onSelect: (suggestion: AssetQuerySuggestion) => void;
}

export function AssetSearchSuggestions({
  open,
  suggestions,
  highlightedIndex,
  onSelect,
}: AssetSearchSuggestionsProps): JSX.Element | null {
  if (!open || suggestions.length === 0) return null;

  return (
    <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-[var(--radius-xl)] border border-border bg-popover shadow-console">
      <div className="max-h-72 overflow-y-auto p-2">
        {suggestions.map((suggestion, index) => (
          <button
            key={suggestion.id}
            type="button"
            className={cn(
              "flex w-full items-start gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left transition-colors",
              index === highlightedIndex ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
            )}
            onMouseDown={(event) => {
              event.preventDefault();
              onSelect(suggestion);
            }}
          >
            <span className="mt-0.5 shrink-0 text-[hsl(var(--accent-blue))]">{suggestionIcon(suggestion.kind)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-mono text-sm text-foreground">{suggestion.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{suggestion.description}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

import type { ReportSectionPreview } from "@/types/api/reports";

export function ReportSectionPreviewTabs({
  sections,
  activeId,
  onChange,
}: {
  sections: ReportSectionPreview[];
  activeId?: string;
  onChange: (id: string) => void;
}): JSX.Element {
  return (
    <div className="flex flex-wrap gap-2">
      {sections.map((section) => (
        <button key={section.id} type="button" onClick={() => onChange(section.id)} className={`rounded-full border px-3 py-1.5 text-sm ${section.id === activeId ? "border-foreground/20 bg-foreground/[0.06]" : "border-border/60 bg-background/60"}`}>
          {section.title}
        </button>
      ))}
    </div>
  );
}

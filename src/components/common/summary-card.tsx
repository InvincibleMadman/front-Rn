import { ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

interface SummaryCardProps {
  title: string;
  value: string;
  hint?: string;
  trend?: string;
  valueClassName?: string;
  statusColor?:
    | "primary"
    | "success"
    | "danger"
    | "warning"
    | "secondary"
    | "info"
    | "neutral"
    | "slate"
    | "gray"
    | "zinc"
    | "red"
    | "rose"
    | "pink"
    | "fuchsia"
    | "purple"
    | "violet"
    | "indigo"
    | "blue"
    | "sky"
    | "cyan"
    | "teal"
    | "emerald"
    | "green"
    | "lime"
    | "yellow"
    | "amber"
    | "orange"
    | "coral"
    | "gold"
    | "brown";
}

const statusClassMap: Record<
  NonNullable<SummaryCardProps["statusColor"]>,
  string
> = {
  primary: "summary-card-primary",
  success: "summary-card-success",
  danger: "summary-card-danger",
  warning: "summary-card-warning",
  secondary: "summary-card-secondary",
  info: "summary-card-info",
  neutral: "summary-card-neutral",
  slate: "summary-card-slate",
  gray: "summary-card-gray",
  zinc: "summary-card-zinc",
  red: "summary-card-red",
  rose: "summary-card-rose",
  pink: "summary-card-pink",
  fuchsia: "summary-card-fuchsia",
  purple: "summary-card-purple",
  violet: "summary-card-violet",
  indigo: "summary-card-indigo",
  blue: "summary-card-blue",
  sky: "summary-card-sky",
  cyan: "summary-card-cyan",
  teal: "summary-card-teal",
  emerald: "summary-card-emerald",
  green: "summary-card-green",
  lime: "summary-card-lime",
  yellow: "summary-card-yellow",
  amber: "summary-card-amber",
  orange: "summary-card-orange",
  coral: "summary-card-coral",
  gold: "summary-card-gold",
  brown: "summary-card-brown",
};

export function SummaryCard({
  title,
  value,
  hint,
  trend,
  valueClassName,
  statusColor = "primary",
}: SummaryCardProps): JSX.Element {
  return (
    <Card
      className={cn(
        "summary-card-shell relative overflow-hidden border-0",
        statusClassMap[statusColor],
      )}
    >
      <div className="summary-card-orb" />
      <CardContent className="relative p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="summary-card-title break-words text-xs uppercase leading-5 tracking-[0.08em]">
              {title}
            </p>
            <div
              className={cn(
                "summary-card-value mt-3 break-words text-3xl font-semibold leading-tight tracking-tight",
                valueClassName,
              )}
            >
              {value}
            </div>
            {hint ? (
              <p className="summary-card-copy mt-2 break-words text-sm leading-5">{hint}</p>
            ) : null}
          </div>
          {trend ? (
            <div
              className="flex items-center gap-1 rounded-full px-2 py-1 text-xs backdrop-blur-sm"
              style={{
                border: "1px solid var(--summary-card-chip-border)",
                background: "var(--summary-card-chip-bg)",
                color: "var(--summary-card-chip-color)",
              }}
            >
              <ArrowUpRight className="size-3.5" />
              <span>{trend}</span>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

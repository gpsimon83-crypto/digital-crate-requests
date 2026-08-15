import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type StatusTone = "pending" | "approved" | "played" | "declined" | "urgent" | "paid" | "muted";

interface StatusChipProps {
  tone: StatusTone;
  children: ReactNode;
  /** "solid" = filled rounded pill, for cards and low-density lists. "dot" = compact dot + text, for dense table rows. */
  variant?: "solid" | "dot";
  className?: string;
}

const DOT_COLOR: Record<StatusTone, string> = {
  pending: "bg-status-pending",
  approved: "bg-status-approved",
  played: "bg-status-played",
  declined: "bg-status-declined",
  urgent: "bg-status-urgent",
  paid: "bg-gold",
  muted: "bg-muted"
};

const SOLID_CLASSES: Record<StatusTone, string> = {
  pending: "bg-status-pending text-[#1A140A]",
  approved: "bg-status-approved text-[#0A0A0A]",
  played: "bg-status-played text-white",
  declined: "bg-status-declined text-white",
  urgent: "bg-status-urgent text-white",
  paid: "bg-gold text-[#1A140A]",
  muted: "bg-panel text-muted border border-border"
};

/**
 * The one status-indicator component — replaces the .status-badge (filled
 * pill) and .status-dot (dot + text) CSS classes, which had drifted into
 * being used inconsistently on different pages for the same kind of state.
 */
export function StatusChip({ tone, children, variant = "solid", className }: StatusChipProps) {
  if (variant === "dot") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold text-foreground", className)}>
        <span className={cn("h-[7px] w-[7px] shrink-0 rounded-full", DOT_COLOR[tone])} />
        {children}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide",
        SOLID_CLASSES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

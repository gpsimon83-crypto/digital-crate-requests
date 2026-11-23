import { CalendarPlus, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { AVAILABILITY_URL } from "@/lib/external-links";

/**
 * Update Availability: opens the existing availability workflow (the
 * members-area Availability tab on digitalcratedjs.com) in a new tab.
 * Takes the place of the admin "+ New" button in the DJ menu.
 */
export function UpdateAvailabilityButton({ variant = "rail", className }: { variant?: "rail" | "sheet" | "inline"; className?: string }) {
  return (
    <a
      href={AVAILABILITY_URL}
      target="_blank"
      rel="noopener noreferrer"
      data-tour="update-availability"
      className={cn(
        "menu-fade-item flex items-center gap-3 rounded-[10px] bg-gold px-3 py-2.5 text-sm font-semibold text-[var(--on-gold,#1a140a)] transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
        variant === "rail" && "mb-2 w-full",
        variant === "sheet" && "w-full",
        variant === "inline" && "w-fit",
        className
      )}
    >
      <CalendarPlus size={18} className="shrink-0" aria-hidden />
      <span className={cn("flex items-center gap-1.5 whitespace-nowrap", variant === "rail" && "opacity-0 transition-opacity delay-75 duration-150 group-hover:opacity-100 group-focus-within:opacity-100")}>
        Update Availability <ExternalLink size={13} aria-hidden />
        <span className="sr-only"> (opens the members-area Availability tab in a new tab)</span>
      </span>
    </a>
  );
}

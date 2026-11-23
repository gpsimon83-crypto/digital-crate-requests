import Link from "next/link";
import { cn } from "@/lib/utils";

export interface TabItem {
  key: string;
  label: string;
}

/**
 * Compact, query-param-driven tab bar shared by every tabbed detail page
 * (admin project detail, portal event page). Each tab is only as wide as
 * its label — no filled backgrounds, no full-width stretch — with a slim
 * gold underline marking the active one.
 */
export function Tabs({
  items,
  active,
  hrefFor,
  className,
  emphasis = false,
  variant = "underline",
  label
}: {
  items: readonly TabItem[];
  active: string;
  hrefFor: (key: string) => string;
  className?: string;
  /** Bolder, roomier labels: active tab bold, others regular weight, underline sitting on the divider (project detail). */
  emphasis?: boolean;
  /** "pill": segmented buttons sized to their labels (planning pages, My Gigs). */
  variant?: "underline" | "pill";
  /** Accessible name for the row. */
  label?: string;
}) {
  if (variant === "pill")
    return (
      // Links to separate addresses, so this is navigation (aria-current), not an ARIA tablist.
      <nav aria-label={label ?? "Sections"} className={cn("-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]", className)}>
        <ul className="flex w-max flex-wrap gap-2 sm:w-auto">
          {items.map((t) => (
            <li key={t.key}>
              <Link
                href={hrefFor(t.key)}
                aria-current={active === t.key ? "page" : undefined}
                className={cn(
                  "inline-flex h-10 items-center whitespace-nowrap rounded-full border px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
                  active === t.key ? "border-gold bg-gold font-semibold text-[var(--on-gold,#1a140a)]" : "border-border text-foreground/85 hover:border-gold/60 hover:text-foreground"
                )}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    );
  if (emphasis)
    return (
      // Divider drawn inside the box (inset shadow) so the active underline can sit on it even while the row scrolls.
      <div className={cn("flex gap-2 overflow-x-auto overflow-y-hidden px-1 shadow-[inset_0_-1px_0_var(--border)] [scrollbar-width:thin] sm:gap-8", className)} role="tablist">
        {items.map((t) => (
          <Link
            key={t.key}
            href={hrefFor(t.key)}
            role="tab"
            aria-selected={active === t.key}
            className={cn(
              "whitespace-nowrap rounded-t-[6px] border-b-2 px-3 pb-3 pt-2 text-[15px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold",
              active === t.key ? "border-gold font-bold text-foreground" : "border-transparent font-normal text-foreground/80 hover:text-foreground"
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>
    );
  return (
    <div className={cn("flex gap-1 overflow-x-auto border-b border-border", className)} role="tablist">
      {items.map((t) => (
        <Link
          key={t.key}
          href={hrefFor(t.key)}
          role="tab"
          aria-selected={active === t.key}
          className={cn(
            "whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50",
            active === t.key ? "border-gold text-foreground" : "border-transparent text-muted hover:text-foreground"
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared page layout pieces for every portal (admin, DJ, client, venue).
 *
 * - Desktop (xl, 1280px+): a 12-column grid. Tablet (md): two columns where
 *   cards fit. Phone: one column in reading order.
 * - 16px gaps on phones, 20px on desktop; cards are padded 20px, 24px from sm.
 * - Pages cap at 1680px wide so nothing stretches across an ultrawide screen.
 * - Colours come from the theme tokens, so light and dark themes both work.
 *
 * Full-width is the exception: tables, calendars, timelines and editors use
 * `span={12}` (or skip the grid) rather than being squeezed into cards.
 */

export const PAGE_MAX = "max-w-[1680px]";

/** Page body: centred, capped width, consistent side padding. */
export function PageShell({ children, className, narrow = false }: { children: React.ReactNode; className?: string; /** Forms and reading pages: cap at ~1100px. */ narrow?: boolean }) {
  return <div className={cn("mx-auto w-full px-6 pb-16 pt-6", narrow ? "max-w-[1100px]" : PAGE_MAX, className)}>{children}</div>;
}

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  if (!items.length) return null;
  return (
    <nav aria-label="Breadcrumb" className={cn("text-sm", className)}>
      <ol className="flex flex-wrap items-center gap-1 text-muted">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex items-center gap-1">
              {c.href && !last ? (
                <Link href={c.href} className="rounded-[4px] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
                  {c.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={cn(last && "font-medium text-gold")}>
                  {c.label}
                </span>
              )}
              {!last && <ChevronRight size={13} aria-hidden className="text-muted/70" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

type Span = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 12;
const XL_SPAN: Record<Span, string> = {
  3: "xl:col-span-3",
  4: "xl:col-span-4",
  5: "xl:col-span-5",
  6: "xl:col-span-6",
  7: "xl:col-span-7",
  8: "xl:col-span-8",
  9: "xl:col-span-9",
  12: "xl:col-span-12"
};

/** The responsive grid: 1 column → 2 (md) → 12 (xl). */
export function Grid({ children, className, as: As = "div", ...rest }: { children: React.ReactNode; className?: string; as?: "div" | "section" | "ul" } & React.HTMLAttributes<HTMLElement>) {
  return (
    <As className={cn("grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-12 xl:gap-5", className)} {...rest}>
      {children}
    </As>
  );
}

/**
 * One grid cell. `span` is the desktop width out of 12; on tablet a span of
 * 7+ (or `wide`) takes both columns, anything smaller takes one.
 */
export function Col({ span = 6, wide, className, children, stretch = false, ...rest }: { span?: Span; /** Force both tablet columns. */ wide?: boolean; className?: string; children: React.ReactNode; /** Fill the row height (cards side by side line up). */ stretch?: boolean } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("min-w-0", XL_SPAN[span], (wide ?? span >= 7) && "md:col-span-2", stretch && "self-stretch [&>*]:h-full", className)} {...rest}>
      {children}
    </div>
  );
}

/** A titled card for one group of content. Grows with its content; never a fixed height. */
export function SectionCard({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
  bodyClassName,
  id,
  as: As = "section",
  ...rest
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
  as?: "section" | "div" | "article";
} & Omit<React.HTMLAttributes<HTMLElement>, "title">) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <As id={id} aria-labelledby={title ? headingId : undefined} className={cn("glass-card flex min-w-0 flex-col gap-4 p-5 sm:p-6", className)} {...rest}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {Icon && (
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-gold/12 text-gold" aria-hidden>
                <Icon size={18} />
              </span>
            )}
            <div className="min-w-0">
              {title && (
                <h2 id={headingId} className="text-base font-semibold leading-snug">
                  {title}
                </h2>
              )}
              {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children !== undefined && <div className={cn("flex min-w-0 flex-col gap-3", bodyClassName)}>{children}</div>}
    </As>
  );
}

/** A small summary tile: icon, label, value. Use a row of these above the main grid. */
export function MetricTile({ icon: Icon, label, value, hint, href, tone = "default", className }: { icon?: LucideIcon; label: string; value: React.ReactNode; hint?: React.ReactNode; href?: string; tone?: "default" | "gold" | "urgent"; className?: string }) {
  const body = (
    <>
      {Icon && (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-gold/12 text-gold" aria-hidden>
          <Icon size={18} />
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-[1.5px] text-muted">{label}</span>
        <span className={cn("mt-0.5 block break-words text-lg font-semibold leading-tight", tone === "gold" && "text-gold", tone === "urgent" && "text-status-urgent")}>{value}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </span>
    </>
  );
  const cls = cn("glass-card flex min-w-0 items-center gap-3 p-4 sm:p-5", className);
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:border-gold/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** A row of metric tiles: 1 → 2 → 4 across. */
export function MetricRow({ children, className, cols = 4 }: { children: React.ReactNode; className?: string; cols?: 2 | 3 | 4 }) {
  return <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 xl:gap-5", cols === 3 && "lg:grid-cols-3", cols === 4 && "xl:grid-cols-4", className)}>{children}</div>;
}

const FIELD_W = { short: "sm:max-w-[12rem]", medium: "sm:max-w-[22rem]", long: "max-w-[48rem]", full: "" } as const;

/**
 * A labelled field. `size` keeps short values (dates, times, counts) narrow
 * and long text readable instead of stretching across the screen.
 */
export function FieldGroup({ label, hint, htmlFor, size = "full", children, className, error }: { label: React.ReactNode; hint?: React.ReactNode; htmlFor?: string; size?: keyof typeof FIELD_W; children: React.ReactNode; className?: string; error?: React.ReactNode }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", FIELD_W[size], className)}>
      <label htmlFor={htmlFor} className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-status-declined">
          {error}
        </p>
      )}
    </div>
  );
}

/** Fields side by side where they fit (2 or 3 across from sm), stacked on phones. */
export function FieldRow({ children, cols = 2, className }: { children: React.ReactNode; cols?: 2 | 3; className?: string }) {
  return <div className={cn("grid gap-3 sm:grid-cols-2", cols === 3 && "lg:grid-cols-3", className)}>{children}</div>;
}

/** A small supporting panel of next steps or actions, for the narrow side column. */
export function ActionPanel({ title, children, className }: { title: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <aside className={cn("glass-card flex min-w-0 flex-col gap-3 p-5 sm:p-6", className)}>
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </aside>
  );
}

/** The input look used across the portals (kept in one place). */
export const INPUT = "w-full rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/40";

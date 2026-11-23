import { Breadcrumbs, PAGE_MAX, type Crumb } from "@/components/layout/grid";
import { cn } from "@/lib/utils";

/**
 * The page header every portal page uses: optional breadcrumb, title,
 * short guidance, the page's own actions (save/status) on the right, and
 * an optional row of compact tabs underneath. Content is capped at the
 * shared page width so it lines up with the grid below on wide screens.
 */
export function PageHeader({
  title,
  subtitle,
  action,
  breadcrumbs,
  tabs,
  className
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  breadcrumbs?: Crumb[];
  /** Compact section tabs (sized to their labels). */
  tabs?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("border-b border-black/8", className)}>
      <div className={cn("mx-auto w-full px-6 pb-5 pt-5 sm:pt-6", PAGE_MAX)}>
        {breadcrumbs && <Breadcrumbs items={breadcrumbs} className="mb-2" />}
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="min-w-0 max-w-3xl">
            <h1 className="font-display text-[32px] font-light leading-tight sm:text-4xl">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
          </div>
          {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
        </div>
        {tabs && <div className="mt-4">{tabs}</div>}
      </div>
    </header>
  );
}

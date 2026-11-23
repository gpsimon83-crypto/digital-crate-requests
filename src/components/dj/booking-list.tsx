"use client";

import { cn } from "@/lib/utils";
import { clientLabel, whenLabel, type MyBooking } from "@/lib/dj/use-my-bookings";

/**
 * The DJ's bookings as a pick list (the left column on Tasks & Planning and
 * Messages). The picked one shows on the right.
 */
export function BookingList({
  bookings,
  picked,
  onPick,
  badge,
  label
}: {
  bookings: MyBooking[];
  picked: string | null;
  onPick: (id: string) => void;
  /** Optional count or note per booking (open tasks, last message). */
  badge?: (b: MyBooking) => React.ReactNode;
  label: string;
}) {
  return (
    <ul aria-label={label} className="flex flex-col gap-2">
      {bookings.map((b) => {
        const on = b.id === picked;
        return (
          <li key={b.id}>
            <button
              type="button"
              onClick={() => onPick(b.id)}
              aria-pressed={on}
              className={cn(
                "flex w-full items-start justify-between gap-3 rounded-[12px] border px-3.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
                on ? "border-gold bg-gold/10" : "border-border hover:border-gold/50"
              )}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{b.title}</span>
                <span className="mt-0.5 block truncate text-xs text-muted">
                  {whenLabel(b.starts_at)}
                  {b.venues?.name ? ` · ${b.venues.name}` : ""}
                  {clientLabel(b.clients) ? ` · ${clientLabel(b.clients)}` : ""}
                </span>
              </span>
              {badge && <span className="shrink-0 text-xs text-muted">{badge(b)}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function ListState({ loading, error, empty, emptyText }: { loading: boolean; error: boolean; empty: boolean; emptyText: string }) {
  if (loading) return <p className="text-sm text-muted">Loading your bookings…</p>;
  if (error)
    return (
      <p role="alert" className="text-sm text-status-declined">
        Your bookings couldn&apos;t load. Refresh to try again.
      </p>
    );
  if (empty) return <p className="rounded-[12px] border border-dashed border-border px-4 py-6 text-center text-sm text-muted">{emptyText}</p>;
  return null;
}

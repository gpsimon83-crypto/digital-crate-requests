"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface EventRow {
  id: string;
  title: string;
  status: string;
  starts_at: string | null;
  djs: { display_name: string } | null;
  venues: { name: string } | null;
}

interface PaymentRow {
  id: string;
  event_id: string;
  amount_cents: number;
  paid_at: string | null;
  events: { title: string } | { title: string }[] | null;
}

type CategoryKey = "booked" | "tentative" | "payments" | "archived";

const CATEGORIES: { key: CategoryKey; label: string; defaultOn: boolean }[] = [
  { key: "booked", label: "Booked Projects", defaultOn: true },
  { key: "tentative", label: "Tentative Projects", defaultOn: true },
  { key: "payments", label: "Payments", defaultOn: true },
  { key: "archived", label: "Archived Projects", defaultOn: false }
];

const TENTATIVE_STATUSES = new Set(["inquiry", "pending_confirmation"]);

function categoryOf(status: string): CategoryKey {
  if (status === "declined") return "archived";
  if (TENTATIVE_STATUSES.has(status)) return "tentative";
  return "booked";
}

function CategorySwatch({ category }: { category: CategoryKey }) {
  if (category === "booked") return <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-gold" />;
  if (category === "payments") return <span className="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-status-approved" />;
  if (category === "archived") return <span className="h-2.5 w-2.5 shrink-0 rounded-[2px] border border-muted" />;
  return (
    <span
      className="h-2.5 w-2.5 shrink-0 rounded-[2px] border border-gold"
      style={{
        backgroundImage:
          "repeating-linear-gradient(45deg, var(--gold) 0px, var(--gold) 1.5px, transparent 1.5px, transparent 4px)"
      }}
    />
  );
}

function eventName(e: PaymentRow["events"]) {
  const row = Array.isArray(e) ? e[0] : e;
  return row?.title ?? "Event";
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function AdminCalendarPage() {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [payments, setPayments] = useState<PaymentRow[] | null>(null);
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState<Date | null>(null);
  const [visible, setVisible] = useState<Set<CategoryKey>>(
    () => new Set(CATEGORIES.filter((c) => c.defaultOn).map((c) => c.key))
  );

  useEffect(() => {
    async function load() {
      const [eventsRes, paymentsRes] = await Promise.all([fetch("/api/admin/events"), fetch("/api/admin/payments")]);
      const eventsData = await eventsRes.json();
      const paymentsData = await paymentsRes.json();
      setEvents(eventsRes.ok ? eventsData.events : []);
      setPayments(paymentsRes.ok ? paymentsData.payments : []);
    }
    load();
  }, []);

  function toggleCategory(key: CategoryKey) {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const eventsWithDate = useMemo(
    () => (events ?? []).filter((e) => e.starts_at && visible.has(categoryOf(e.status))),
    [events, visible]
  );

  const paymentsWithDate = useMemo(
    () => (visible.has("payments") ? (payments ?? []).filter((p) => p.paid_at) : []),
    [payments, visible]
  );

  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const days = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = firstOfMonth.getDay();
    const gridStart = new Date(year, month, 1 - startOffset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      return d;
    });
  }, [cursor]);

  const today = new Date();
  const selectedDay = selected ?? today;
  const dayEvents = eventsWithDate.filter((e) => sameDay(new Date(e.starts_at as string), selectedDay));
  const dayPayments = paymentsWithDate.filter((p) => sameDay(new Date(p.paid_at as string), selectedDay));

  return (
    <>
      <PageHeader title="Calendar" subtitle="Every project and payment, at a glance." />
      <div className="grid gap-6 p-6 lg:grid-cols-[200px_1fr]">
        <GlassCard className="flex h-fit flex-col gap-3">
          <p className="text-sm font-semibold">Show on calendar</p>
          <div className="flex flex-col gap-2.5">
            {CATEGORIES.map((c) => (
              <label key={c.key} className="flex cursor-pointer items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={visible.has(c.key)}
                  onChange={() => toggleCategory(c.key)}
                  className="h-3.5 w-3.5 accent-gold"
                />
                <CategorySwatch category={c.key} />
                <span className={visible.has(c.key) ? "" : "text-muted"}>{c.label}</span>
              </label>
            ))}
          </div>
        </GlassCard>

        <div className="flex flex-col gap-6">
          <GlassCard className="p-4">
            <div className="mb-4 flex items-center justify-between px-1">
              <p className="font-display text-xl font-light">{monthLabel}</p>
              <div className="flex gap-1">
                <button
                  onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
                  className="rounded-[2px] p-1.5 hover:bg-black/5"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setCursor(new Date())}
                  className="rounded-[2px] px-2 text-xs font-medium text-muted hover:bg-black/5"
                >
                  Today
                </button>
                <button
                  onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
                  className="rounded-[2px] p-1.5 hover:bg-black/5"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 border-t border-l border-border">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => (
                <div key={w} className="border-b border-r border-border px-2 py-1.5 text-center text-[11px] text-muted">
                  {w}
                </div>
              ))}
              {days.map((d) => {
                const inMonth = d.getMonth() === cursor.getMonth();
                const isToday = sameDay(d, today);
                const isSelected = sameDay(d, selectedDay);
                const dayItems = eventsWithDate.filter((e) => sameDay(new Date(e.starts_at as string), d));
                const dayPays = paymentsWithDate.filter((p) => sameDay(new Date(p.paid_at as string), d));
                const totalItems = dayItems.length + dayPays.length;
                return (
                  <button
                    key={d.toISOString()}
                    onClick={() => setSelected(d)}
                    className={cn(
                      "flex min-h-[84px] flex-col items-start gap-1 border-b border-r border-border p-1.5 text-left align-top transition-colors hover:bg-black/5",
                      !inMonth && "opacity-40",
                      isSelected && "bg-gold/10"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-[2px] text-xs",
                        isToday && "bg-gold text-black"
                      )}
                    >
                      {d.getDate()}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      {dayItems.slice(0, 2).map((e) => (
                        <span key={e.id} className="flex items-center gap-1 text-[10px] text-muted">
                          <CategorySwatch category={categoryOf(e.status)} />
                          <span className="truncate">{e.title}</span>
                        </span>
                      ))}
                      {dayPays.slice(0, totalItems > 2 ? 0 : 2 - dayItems.length).map((p) => (
                        <span key={p.id} className="flex items-center gap-1 text-[10px] text-muted">
                          <CategorySwatch category="payments" />
                          <span className="truncate">${(p.amount_cents / 100).toFixed(0)} paid</span>
                        </span>
                      ))}
                      {totalItems > 2 && <span className="text-[10px] text-muted">+{totalItems - 2} more</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </GlassCard>

          <GlassCard className="flex h-fit flex-col gap-3">
            <p className="text-sm font-semibold">
              {selectedDay.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </p>
            <div className="flex flex-col divide-y divide-border">
              {dayEvents.length === 0 && dayPayments.length === 0 && (
                <p className="py-2 text-sm text-muted">Nothing scheduled.</p>
              )}
              {dayEvents.map((e) => (
                <Link key={e.id} href="/admin/events" className="group flex items-center gap-2.5 py-2.5 first:pt-0">
                  <CategorySwatch category={categoryOf(e.status)} />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium group-hover:text-gold">{e.title}</span>
                    <span className="text-xs text-muted">
                      {e.djs?.display_name ?? "Unassigned"}
                      {e.venues?.name ? ` · ${e.venues.name}` : ""}
                    </span>
                  </div>
                </Link>
              ))}
              {dayPayments.map((p) => (
                <Link key={p.id} href="/admin/finance" className="group flex items-center gap-2.5 py-2.5 first:pt-0">
                  <CategorySwatch category="payments" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium group-hover:text-gold">
                      ${(p.amount_cents / 100).toFixed(2)} paid
                    </span>
                    <span className="text-xs text-muted">{eventName(p.events)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </>
  );
}

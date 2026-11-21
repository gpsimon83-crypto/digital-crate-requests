"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Repeat2 } from "lucide-react";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";
import { NextGigStrip, ResidencyHeader } from "./residency-header";
import { CoverageTab } from "./coverage-tab";
import { GigDrawer } from "./gig-drawer";
import { AddDateDrawer, ScheduleDrawer } from "./schedule-drawer";
import { BriefTab, RecapsTab } from "./brief-recaps-tabs";
import { FinancialsTab } from "./financials-tab";
import type { ResGig, ResidencyData } from "./types";

export const RESIDENCY_TABS = ["Coverage", "Brief", "Recaps", "Financials"] as const;
export const CLASSIC_TABS = ["Activity", "Files", "Tasks", "Notes", "Details"] as const;
const LABEL: Record<string, string> = { Brief: "Venue Brief" };

/** Header, next-gig strip and tab row for a recurring Bar / Club project. */
export function ResidencyTop({ eventId, data, activeTab, projectPhoto, onAddPhoto, onOpenGig, onSchedule }: { eventId: string; data: ResidencyData; activeTab: string; projectPhoto: string | null; onAddPhoto: () => void; onOpenGig: (g: ResGig, focus?: "dj") => void; onSchedule: () => void }) {
  const [more, setMore] = useState(false);
  const tabs: { key: string; label: string }[] = RESIDENCY_TABS.filter((t) => t !== "Financials" || data.finance).map((t) => ({ key: t, label: LABEL[t] ?? t }));
  const classicActive = (CLASSIC_TABS as readonly string[]).includes(activeTab);
  if (classicActive) tabs.push({ key: activeTab, label: activeTab });
  return (
    <>
      <ResidencyHeader data={data} projectPhoto={projectPhoto} onAddPhoto={onAddPhoto} />
      <div className="mx-4 mt-6 sm:mx-8">
        <NextGigStrip data={data} onOpen={onOpenGig} onSchedule={onSchedule} />
      </div>
      <div className="relative mx-4 mt-6 flex items-end gap-2 sm:mx-8" data-tour="residency-tabs">
        <Tabs items={tabs} active={activeTab} hrefFor={(key) => `/admin/events/${eventId}?tab=${key}`} emphasis className="min-w-0 flex-1" />
        <div className="relative shrink-0 pb-2">
          <button onClick={() => setMore((v) => !v)} aria-expanded={more} className="inline-flex items-center gap-1 rounded-[10px] border border-border px-3 py-1.5 text-xs text-foreground/80 hover:border-gold" data-tour="residency-more">
            Project records <ChevronDown size={13} />
          </button>
          {more && (
            <div className="absolute right-0 z-30 mt-1 w-48 rounded-[12px] border border-border bg-card p-1 shadow-[var(--shadow-card)]" onMouseLeave={() => setMore(false)}>
              {CLASSIC_TABS.map((t) => (
                <Link key={t} href={`/admin/events/${eventId}?tab=${t}`} onClick={() => setMore(false)} className={cn("block rounded-[8px] px-3 py-2 text-sm hover:bg-panel", activeTab === t && "text-gold")}>
                  {t}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/** The four recurring-booking tabs' content, plus the gig / schedule drawers. */
export function ResidencyBody({ eventId, data, activeTab, reload, ledger, drawer, setDrawer }: { eventId: string; data: ResidencyData; activeTab: string; reload: () => void; ledger: React.ReactNode; drawer: Drawer; setDrawer: (d: Drawer) => void }) {
  const search = useSearchParams();
  const focusRecap = search.get("recap");
  const gig = drawer?.kind === "gig" ? (data.gigs.find((g) => g.id === drawer.id) ?? null) : null;
  const close = () => setDrawer(null);
  const done = () => {
    reload();
  };
  return (
    <div className="mx-4 mt-6 sm:mx-8">
      {activeTab === "Coverage" && (
        <CoverageTab data={data} onOpen={(g) => setDrawer({ kind: "gig", id: g.id })} onSchedule={() => setDrawer({ kind: "add" })} onEditSchedule={() => setDrawer({ kind: "schedule" })} briefHref={`/admin/events/${eventId}?tab=Brief`} recapsHref={`/admin/events/${eventId}?tab=Recaps`} />
      )}
      {activeTab === "Brief" && <BriefTab key={JSON.stringify(data.brief)} data={data} onChanged={reload} />}
      {activeTab === "Recaps" && <RecapsTab data={data} focusId={focusRecap} onOpenGig={(g) => setDrawer({ kind: "gig", id: g.id })} />}
      {activeTab === "Financials" && (data.finance ? <FinancialsTab eventId={eventId} ledger={ledger} /> : <p className="text-sm text-muted">Financials are limited to staff with finance access.</p>)}

      {gig && <GigDrawer eventId={eventId} data={data} gig={gig} focus={drawer?.kind === "gig" ? drawer.focus : undefined} onClose={close} onChanged={done} />}
      {drawer?.kind === "schedule" && (
        <ScheduleDrawer eventId={eventId} data={data} today={data.today} djs={data.djs} canManageMoney={data.canManageMoney} onClose={close} onSaved={() => (close(), reload())} />
      )}
      {drawer?.kind === "add" && <AddDateDrawer eventId={eventId} data={data} onClose={close} onSaved={() => (close(), reload())} />}
    </div>
  );
}
export type Drawer = { kind: "gig"; id: string; focus?: "dj" } | { kind: "schedule" } | { kind: "add" } | null;

/** On a one-off Bar / Club project: turn it into a recurring booking. */
export function MakeRecurringCard({ eventId, venueLinked, startsAt, endsAt, timezone, onCreated }: { eventId: string; venueLinked: boolean; startsAt: string | null; endsAt: string | null; timezone: string | null; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [djs, setDjs] = useState<{ id: string; display_name: string }[]>([]);
  const [meta, setMeta] = useState<{ canManageMoney: boolean; today: string } | null>(null);
  const router = useRouter();
  useEffect(() => {
    if (!open) return;
    fetch("/api/admin/djs").then((r) => r.json()).then((j) => setDjs(j.djs ?? [])).catch(() => {});
    fetch(`/api/admin/events/${eventId}/residency`).then((r) => r.json()).then((j) => setMeta({ canManageMoney: !!j.canManageMoney, today: j.today ?? new Date().toISOString().slice(0, 10) })).catch(() => {});
  }, [open, eventId]);
  const tz = timezone || "America/Chicago";
  const at = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso)) : undefined);
  const weekday = startsAt ? new Date(new Date(startsAt).toLocaleString("en-US", { timeZone: tz })).getDay() : undefined;
  return (
    <GlassCard className="flex flex-col gap-3 sm:flex-row sm:items-center" data-tour="make-recurring">
      <Repeat2 size={20} className="shrink-0 text-gold" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Is this a recurring night?</p>
        <p className="text-xs text-muted">Set the schedule (weekly, some weeks of the month, or picked dates) to track every date&rsquo;s DJ, recap and money here.{!venueLinked && " Link the venue in Details first so the brief lives on its record."}</p>
      </div>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        Make it recurring
      </Button>
      {open && meta && (
        <ScheduleDrawer
          eventId={eventId}
          data={null}
          today={meta.today}
          djs={djs}
          canManageMoney={meta.canManageMoney}
          defaults={{ weekday, start: at(startsAt), end: at(endsAt) }}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            onCreated();
            router.replace(`/admin/events/${eventId}?tab=Coverage`);
          }}
        />
      )}
    </GlassCard>
  );
}

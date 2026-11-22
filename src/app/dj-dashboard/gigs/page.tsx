"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Repeat } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";

type Gig = { id: string; date: string; start: string; end: string; night: string; venue: string | null; place: string | null; changeNote: string | null };
type Data = { awaiting: Gig[]; upcoming: Gig[]; recapDue: Gig[] };

const day = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

function Section({ title, hint, gigs, cta }: { title: string; hint: string; gigs: Gig[]; cta: string }) {
  if (!gigs.length) return null;
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-[1.5px] text-muted">
        {title} ({gigs.length})
      </h2>
      <p className="mb-2 text-xs text-muted">{hint}</p>
      <ul className="flex flex-col gap-2">
        {gigs.map((g) => (
          <li key={g.id}>
            <Link href={`/dj-dashboard/gigs/${g.id}`} className="flex items-center gap-3 rounded-[14px] border border-border bg-card p-3 hover:border-gold">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{g.night}{g.venue ? ` · ${g.venue}` : ""}</span>
                <span className="block truncate text-xs text-muted">
                  {day(g.date)} · {g.start}–{g.end}
                  {g.place ? ` · ${g.place}` : ""}
                </span>
                {g.changeNote && <span className="mt-0.5 block text-[11px] text-status-pending">Changed: {g.changeNote}</span>}
              </span>
              <span className="shrink-0 text-xs font-semibold text-gold">{cta}</span>
              <ChevronRight size={15} className="shrink-0 text-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Recurring venue nights assigned to this DJ: to confirm, coming up, and recaps due. */
export default function DjGigsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch("/api/dj/gigs")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setData({ awaiting: d.awaiting ?? [], upcoming: d.upcoming ?? [], recapDue: d.recapDue ?? [] }))
      .catch(() => setError(true));
  }, []);
  const none = data && !data.awaiting.length && !data.upcoming.length && !data.recapDue.length;
  return (
    <>
      <PageHeader title="Recurring gigs" subtitle="Your regular bar and club nights: confirm the ones you're asked to cover, and send a short recap after each." />
      <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-6">
        {error ? (
          <p role="alert" className="text-sm text-status-declined">Your gigs couldn&apos;t load. Refresh to try again.</p>
        ) : !data ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : none ? (
          <GlassCard className="flex flex-col items-center gap-2 py-10 text-center">
            <Repeat size={22} className="text-gold/70" />
            <p className="text-sm text-muted">No recurring gigs assigned to you right now.</p>
          </GlassCard>
        ) : (
          <>
            <Section title="Asking you to cover" hint="Say yes or pass so the venue knows." gigs={data.awaiting} cta="Respond" />
            <Section title="Recaps due" hint="A minute each: how the night went." gigs={data.recapDue} cta="Write recap" />
            <Section title="Coming up" hint="Confirmed nights." gigs={data.upcoming} cta="Details" />
          </>
        )}
      </div>
    </>
  );
}

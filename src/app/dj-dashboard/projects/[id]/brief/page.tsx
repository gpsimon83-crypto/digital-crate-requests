"use client";

import { use as usePromise, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Clock, MapPin, Phone, Printer } from "lucide-react";

type Contact = { role: string; name: string; phone?: string; email?: string };
type Brief = {
  title: string;
  dj: string | null;
  date: string | null;
  hours: string | null;
  arrival: string | null;
  venue: { name: string | null; address: string | null };
  contacts: Contact[];
  loadIn: string | null;
  coverage: string[];
  guests: number | null;
  gear: { name: string; quantity: number; note: string | null }[];
  timeline: { time: string; label: string; note?: string }[];
  keyTracks: { label: string; song: string }[];
  pronunciations: { name: string; say: string }[];
  announcements: string | null;
  mustPlay: string[];
  doNotPlay: string[];
  backup: string | null;
  notes: string | null;
  unresolved: { title: string; owner: string; due: string | null; waiting: string | null }[];
};

function Section({ title, children, tour }: { title: string; children: React.ReactNode; tour?: string }) {
  return (
    <section className="break-inside-avoid rounded-[14px] border border-border bg-card p-4" data-tour={tour}>
      <h2 className="text-[10px] font-semibold uppercase tracking-[2.5px] text-gold">{title}</h2>
      <div className="mt-2 text-sm">{children}</div>
    </section>
  );
}
const Empty = ({ children }: { children: React.ReactNode }) => <p className="text-muted">{children}</p>;

/** The day-before brief: everything the DJ needs on the day, on one phone-friendly page. */
export default function BriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [b, setB] = useState<Brief | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch(`/api/events/${id}/brief`, { cache: "no-store" })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => (ok ? setB(j) : setError(j.error ?? "Couldn't load the brief.")))
      .catch(() => setError("Couldn't load the brief."));
  }, [id]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-5 sm:px-6">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <Link href={`/dj-dashboard/projects/${id}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
          <ArrowLeft size={15} /> Project
        </Link>
        <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-xs hover:border-gold">
          <Printer size={13} /> Print
        </button>
      </div>
      {error && <p className="text-sm text-status-declined">{error}</p>}
      {!b && !error && <p className="text-sm text-muted">Loading the brief…</p>}
      {b && (
        <>
          <header className="rounded-[14px] border border-gold/40 bg-card p-4" data-tour="brief-header">
            <p className="text-[10px] font-semibold uppercase tracking-[2.5px] text-gold">Day-before brief</p>
            <h1 className="mt-1 font-display text-3xl leading-tight">{b.title}</h1>
            <p className="mt-1 text-sm text-muted">{[b.date, b.hours].filter(Boolean).join(" · ") || "Date TBD"}</p>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <p className="flex items-start gap-2">
                <Clock size={15} className="mt-0.5 shrink-0 text-gold" />
                <span>
                  <span className="font-semibold">Arrive</span> {b.arrival ?? "time not set"}
                </span>
              </p>
              <p className="flex items-start gap-2">
                <MapPin size={15} className="mt-0.5 shrink-0 text-gold" />
                <span>
                  <span className="font-semibold">{b.venue.name ?? "Venue TBD"}</span>
                  {b.venue.address && (
                    <>
                      {" · "}
                      <a className="text-gold-dim underline" href={`https://maps.google.com/?q=${encodeURIComponent(b.venue.address)}`} target="_blank" rel="noreferrer">
                        {b.venue.address}
                      </a>
                    </>
                  )}
                </span>
              </p>
            </div>
          </header>

          {b.unresolved.length > 0 && (
            <section className="rounded-[14px] border border-status-pending/40 bg-status-pending/5 p-4" data-tour="brief-unresolved">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-status-pending">
                <AlertTriangle size={15} /> Still open before the day ({b.unresolved.length})
              </h2>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {b.unresolved.map((u, i) => (
                  <li key={i}>
                    {u.title} <span className="text-xs text-muted">· {u.owner}{u.waiting ? ` · ${u.waiting}` : ""}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Section title="Contacts" tour="brief-contacts">
              {b.contacts.length ? (
                <ul className="flex flex-col gap-2">
                  {b.contacts.map((c, i) => (
                    <li key={i} className="flex items-center justify-between gap-2">
                      <span>
                        <span className="block text-xs text-muted">{c.role}</span>
                        {c.name}
                      </span>
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs hover:border-gold">
                          <Phone size={12} /> {c.phone}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>No contacts yet.</Empty>
              )}
            </Section>
            <Section title="Setup">
              <p>
                <span className="text-muted">Coverage:</span> {b.coverage.length ? b.coverage.join(", ") : "not set"}
                {b.guests ? ` · ${b.guests} guests` : ""}
              </p>
              {b.loadIn && <p className="mt-1"><span className="text-muted">Load-in:</span> {b.loadIn}</p>}
              {b.gear.length > 0 ? (
                <ul className="mt-2 flex flex-col gap-0.5">
                  {b.gear.map((g, i) => (
                    <li key={i}>
                      {g.quantity} × {g.name}
                      {g.note ? <span className="text-muted"> · {g.note}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-muted">No gear assigned yet.</p>
              )}
              {b.backup && <p className="mt-2"><span className="text-muted">Weather backup:</span> {b.backup}</p>}
            </Section>
          </div>

          <Section title="Timeline" tour="brief-timeline">
            {b.timeline.length ? (
              <ol className="flex flex-col divide-y divide-border">
                {b.timeline.map((t, i) => (
                  <li key={i} className="flex gap-3 py-1.5 first:pt-0">
                    <span className="w-20 shrink-0 font-semibold tabular-nums">{t.time}</span>
                    <span>
                      {t.label}
                      {t.note && <span className="block text-xs text-muted">{t.note}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <Empty>No timeline yet.</Empty>
            )}
          </Section>

          <div className="grid gap-3 sm:grid-cols-2">
            <Section title="Key songs">
              {b.keyTracks.length ? (
                <ul className="flex flex-col gap-1">
                  {b.keyTracks.map((k) => (
                    <li key={k.label}>
                      <span className="block text-xs text-muted">{k.label}</span>
                      {k.song}
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>No key songs yet.</Empty>
              )}
            </Section>
            <Section title="Names & announcements">
              {b.pronunciations.length > 0 && (
                <ul className="flex flex-col gap-0.5">
                  {b.pronunciations.map((p, i) => (
                    <li key={i}>
                      {p.name} <span className="text-muted">— say “{p.say}”</span>
                    </li>
                  ))}
                </ul>
              )}
              {b.announcements ? <p className="mt-2 whitespace-pre-line">{b.announcements}</p> : !b.pronunciations.length && <Empty>Nothing noted.</Empty>}
            </Section>
            <Section title="Must play">{b.mustPlay.length ? <ul className="list-disc pl-4">{b.mustPlay.map((s, i) => <li key={i}>{s}</li>)}</ul> : <Empty>None listed.</Empty>}</Section>
            <Section title="Do not play">{b.doNotPlay.length ? <ul className="list-disc pl-4">{b.doNotPlay.map((s, i) => <li key={i}>{s}</li>)}</ul> : <Empty>None listed.</Empty>}</Section>
          </div>
          {b.notes && <Section title="Notes"><p className="whitespace-pre-line">{b.notes}</p></Section>}
        </>
      )}
    </div>
  );
}

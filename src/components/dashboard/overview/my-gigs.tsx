"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Disc3, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashLayout } from "@/lib/dashboard-layout";
import type { MyGig } from "@/lib/data/my-gigs";
import { FOCUS, Panel, PanelTitle } from "./widgets";

export type MyGigsState = { djName: string; gigs: MyGig[]; calendarConnected: boolean; loading: boolean; error: boolean; /** Admin only: where to connect Google Calendar. */ connectHref?: string };

const SOURCE: Record<MyGig["source"], { label: string; Icon: typeof Disc3 }> = {
  project: { label: "Project", Icon: FolderOpen },
  venue_night: { label: "Venue night · Google Calendar", Icon: CalendarDays },
  google: { label: "Google Calendar", Icon: CalendarDays }
};

function when(g: MyGig) {
  const [y, m, d] = g.date.split("-").map(Number);
  const day = new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  if (!g.starts_at) return `${day} · all day`;
  const t = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} · ${t(g.starts_at)}${g.ends_at ? `–${t(g.ends_at)}` : ""}`;
}

/**
 * The signed-in admin's own gigs as a DJ (when their login is linked to a DJ
 * profile): projects they're on plus what the shared Google Calendar has for
 * them. Only shown to people who are also DJs.
 */
export function MyGigs({ s, layout }: { s: MyGigsState; layout: DashLayout }) {
  const [all, setAll] = useState(false);
  const shown = all ? s.gigs : s.gigs.slice(0, 6);
  return (
    <Panel layout={layout} aria-labelledby="dash-mygigs" data-tour="dash-mygigs">
      <PanelTitle layout={layout} id="dash-mygigs" action={<span className="text-xs text-muted">{s.djName}</span>}>
        My gigs
      </PanelTitle>
      {s.loading ? (
        <p className="text-sm text-muted">Loading your gigs…</p>
      ) : s.error ? (
        <p role="alert" className="text-sm text-status-declined">Your gigs couldn&apos;t load. Refresh to try again.</p>
      ) : s.gigs.length === 0 ? (
        <p className="text-sm text-muted">Nothing on your schedule for the next four months.</p>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-border">
            {shown.map((g) => {
              const src = SOURCE[g.source];
              const body = (
                <>
                  <src.Icon size={16} className="mt-0.5 shrink-0 text-gold" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{g.title}</span>
                    <span className="block truncate text-xs text-muted">
                      {when(g)}
                      {g.venue ? ` · ${g.venue}` : ""}
                    </span>
                    <span className="block text-[11px] text-muted">
                      {src.label}
                      {g.status === "inquiry" ? " · inquiry" : ""}
                    </span>
                  </span>
                </>
              );
              return (
                <li key={g.key}>
                  {g.href ? (
                    <Link href={g.href} className={cn("flex items-start gap-3 py-2.5 hover:text-gold", FOCUS)}>
                      {body}
                    </Link>
                  ) : (
                    <div className="flex items-start gap-3 py-2.5">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
          {s.gigs.length > 6 && (
            <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all} className={cn("mt-2 text-xs font-semibold text-gold hover:underline", FOCUS)}>
              {all ? "Show fewer" : `Show all ${s.gigs.length}`}
            </button>
          )}
        </>
      )}
      {!s.loading && !s.calendarConnected && (
        <p className="mt-2 text-[11px] text-muted">
          Google Calendar isn&apos;t connected yet, so only venue nights and projects show here.{" "}
          {s.connectHref && (
            <Link href={s.connectHref} className={cn("text-gold hover:underline", FOCUS)}>
              Connect it
            </Link>
          )}
        </p>
      )}
    </Panel>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronRight, CircleAlert, PlayCircle } from "lucide-react";
import { hasTour } from "@/lib/tours";
import { PageHeader } from "@/components/dashboard/page-header";
import { UPDATES, type UpdateArea } from "@/lib/whats-new";
import { markWhatsNewSeen } from "@/lib/use-whats-new";
import { cn } from "@/lib/utils";

type Filter = "all" | UpdateArea | "action";

const fmtDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

export function WhatsNew() {
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    const before = markWhatsNewSeen();
    const i = before ? UPDATES.findIndex((u) => u.id === before) : -1;
    const fresh = UPDATES.slice(0, i === -1 ? UPDATES.length : i).map((u) => u.id);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads browser storage once on open
    setNewIds(new Set(before ? fresh : []));
  }, []);

  const shown = UPDATES.filter((u) => (filter === "all" ? true : filter === "action" ? !!u.action : u.area === filter));
  const byDate = shown.reduce<Record<string, typeof UPDATES>>((acc, u) => {
    (acc[u.date] ??= []).push(u);
    return acc;
  }, {});
  const counts: Record<Filter, number> = {
    all: UPDATES.length,
    CRM: UPDATES.filter((u) => u.area === "CRM").length,
    "Members area": UPDATES.filter((u) => u.area === "Members area").length,
    action: UPDATES.filter((u) => u.action).length
  };

  return (
    <>
      <PageHeader title="What's New" subtitle="Every update to the CRM and the DJ members area, newest first." />
      <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-6">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter updates">
          {([
            ["all", "All"],
            ["CRM", "CRM (cratesdjs.com)"],
            ["Members area", "Members area"],
            ["action", "Needs a step"]
          ] as const).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={filter === k}
              onClick={() => setFilter(k)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                filter === k ? "border-gold bg-gold-soft font-medium" : "border-black/10 hover:border-gold"
              )}
            >
              {label} <span className="text-muted">{counts[k]}</span>
            </button>
          ))}
        </div>

        {Object.entries(byDate).map(([date, items]) => (
          <section key={date}>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[1.5px] text-muted">{fmtDate(date)}</h2>
            <div className="flex flex-col gap-3">
              {items.map((u) => (
                <article key={u.id} className="relative rounded-card border border-border bg-card p-4 shadow-card transition-colors hover:border-gold sm:p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        u.area === "CRM" ? "bg-gold-soft text-gold-dim" : "bg-status-played/10 text-status-played"
                      )}
                    >
                      {u.area}
                    </span>
                    {newIds.has(u.id) && <span className="rounded-full bg-gold px-2 py-0.5 text-[10px] font-semibold text-[#1A140A]">NEW</span>}
                    {hasTour(u.id) && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-gold/40 px-2 py-0.5 text-[10px] font-medium text-gold-dim">
                        <PlayCircle size={11} /> Walkthrough
                      </span>
                    )}
                    <ChevronRight size={16} className="ml-auto text-muted" />
                  </div>
                  <h3 className="mt-2 text-base font-semibold">
                    <Link href={`/admin/whats-new/${u.id}`} className="after:absolute after:inset-0 after:content-['']">
                      {u.title}
                    </Link>
                  </h3>
                  <p className="mt-1 text-sm text-muted">{u.summary}</p>
                  {u.bullets && (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                      {u.bullets.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  )}
                  {u.action && (
                    <p className="mt-3 flex gap-2 rounded-[10px] border border-status-pending/30 bg-status-pending/10 p-2.5 text-xs">
                      <CircleAlert size={14} className="mt-0.5 shrink-0 text-status-pending" />
                      <span>{u.action}</span>
                    </p>
                  )}
                  {u.link &&
                    (u.link.external ? (
                      <a href={u.link.href} target="_blank" rel="noreferrer" className="relative z-10 mt-3 inline-flex items-center gap-1 text-xs font-medium text-gold-dim hover:underline">
                        {u.link.label} <ArrowUpRight size={12} />
                      </a>
                    ) : (
                      <Link href={u.link.href} className="relative z-10 mt-3 inline-flex items-center gap-1 text-xs font-medium text-gold-dim hover:underline">
                        {u.link.label} <ArrowUpRight size={12} />
                      </Link>
                    ))}
                </article>
              ))}
            </div>
          </section>
        ))}
        {!shown.length && <p className="text-sm text-muted">Nothing here.</p>}
      </div>
    </>
  );
}

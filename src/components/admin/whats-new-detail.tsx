"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ArrowUpRight, CircleAlert, PlayCircle } from "lucide-react";
import { UPDATES } from "@/lib/whats-new";
import { MEMBER_TOURS, TOURS } from "@/lib/tours";
import { startTour } from "./guided-tour";
import { cn } from "@/lib/utils";

const fmtDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

export function WhatsNewDetail({ id }: { id: string }) {
  const router = useRouter();
  const i = UPDATES.findIndex((u) => u.id === id);
  const u = UPDATES[i];
  if (!u) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted">That update wasn&apos;t found.</p>
        <Link href="/admin/whats-new" className="mt-2 inline-block text-xs text-gold-dim hover:underline">
          Back to What&apos;s New
        </Link>
      </div>
    );
  }
  const member = MEMBER_TOURS[u.id];
  const steps: { title: string; body: string; adminOnly?: boolean }[] = TOURS[u.id] ?? member?.steps ?? [];
  const startBtn = (extra = "") => {
    const cls = cn("inline-flex items-center gap-2 rounded-[10px] bg-gold px-4 py-2 text-sm font-medium text-[#1A140A] hover:brightness-105", extra);
    return member ? (
      <a href={member.url} target="_blank" rel="noreferrer" className={cls}>
        <PlayCircle size={16} /> Start walkthrough <ArrowUpRight size={14} />
      </a>
    ) : (
      <button onClick={() => startTour(u.id, (href) => router.push(href))} className={cls}>
        <PlayCircle size={16} /> Start walkthrough
      </button>
    );
  };
  const newer = UPDATES[i - 1];
  const older = UPDATES[i + 1];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 p-4 pb-16 sm:p-6">
      <Link href="/admin/whats-new" className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold uppercase tracking-[1.5px] text-muted hover:text-foreground">
        <ArrowLeft size={14} /> What&apos;s New
      </Link>

      <header className="overflow-hidden rounded-card border border-border bg-[linear-gradient(135deg,#1a140a,#2a2010_60%,#3a2c12)] p-6 text-[#f6efe2] shadow-card sm:p-8">
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className={cn("rounded-full px-2 py-0.5 font-semibold uppercase tracking-wide", u.area === "CRM" ? "bg-gold text-[#1A140A]" : "bg-[#4c86ff] text-white")}>{u.area}</span>
          <span className="text-[#d8cfbf]/80">{fmtDate(u.date)}</span>
        </div>
        <h1 className="mt-3 font-display text-3xl font-light sm:text-4xl">{u.title}</h1>
        <p className="mt-2 max-w-xl text-sm text-[#e8dfcf]/85">{u.summary}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {steps.length > 0 && startBtn()}
          {u.link &&
            (u.link.external ? (
              <a href={u.link.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#c99428]/50 px-4 py-2 text-sm hover:bg-white/5">
                {u.link.label} <ArrowUpRight size={14} />
              </a>
            ) : (
              <Link href={u.link.href} className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#c99428]/50 px-4 py-2 text-sm hover:bg-white/5">
                {u.link.label} <ArrowUpRight size={14} />
              </Link>
            ))}
        </div>
      </header>

      {u.action && (
        <p className="flex gap-2 rounded-[12px] border border-status-pending/30 bg-status-pending/10 p-3 text-sm">
          <CircleAlert size={16} className="mt-0.5 shrink-0 text-status-pending" />
          <span>{u.action}</span>
        </p>
      )}

      {u.bullets && (
        <section className="rounded-card border border-border bg-card p-5 shadow-card">
          <h2 className="text-sm font-semibold">What&apos;s included</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {u.bullets.map((b) => (
              <li key={b} className="flex gap-2 rounded-[10px] bg-panel p-3 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                {b}
              </li>
            ))}
          </ul>
        </section>
      )}

      {steps.length > 0 && (
        <section className="rounded-card border border-border bg-card p-5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">In this walkthrough</h2>
            <span className="text-xs text-muted">{steps.length} steps on the real pages{member ? " · opens the members area in a new tab" : ""}</span>
          </div>
          <ol className="mt-3 flex flex-col gap-2">
            {steps.map((s, k) => (
              <li key={k} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gold-soft text-[11px] font-semibold text-gold-dim">{k + 1}</span>
                <div>
                  <p className="text-sm font-medium">
                    {s.title}
                    {s.adminOnly && <span className="ml-2 rounded-full bg-gold-soft px-1.5 py-0.5 text-[10px] font-semibold text-gold-dim">Admins</span>}
                  </p>
                  <p className="text-xs text-muted">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          {startBtn("mt-4")}
        </section>
      )}

      <nav className="grid gap-3 sm:grid-cols-2" aria-label="More updates">
        {newer ? (
          <Link href={`/admin/whats-new/${newer.id}`} className="rounded-card border border-border bg-card p-4 hover:border-gold">
            <span className="flex items-center gap-1 text-[11px] text-muted"><ArrowLeft size={12} /> Newer</span>
            <span className="mt-1 block text-sm font-medium">{newer.title}</span>
          </Link>
        ) : <span />}
        {older && (
          <Link href={`/admin/whats-new/${older.id}`} className="rounded-card border border-border bg-card p-4 text-right hover:border-gold">
            <span className="flex items-center justify-end gap-1 text-[11px] text-muted">Older <ArrowRight size={12} /></span>
            <span className="mt-1 block text-sm font-medium">{older.title}</span>
          </Link>
        )}
      </nav>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";

type Item = { id: string; title: string; nextMove: string | null; status: string; due_date: string | null; link: { label: string; href: string } | null };

/**
 * "Your planning checklist" on the portal Overview: the couple's own steps
 * from the wedding's playbook (the same task records staff and the DJ see).
 * They tick themselves off when the contract is signed, the payment is in,
 * the questionnaire and the music plan are done.
 */
export function PlanningChecklistCard({ eventId, onCount, className }: { eventId: string; /** Told how many steps there are once loaded (0 = the card shows nothing). */ onCount?: (n: number) => void; className?: string }) {
  const [items, setItems] = useState<Item[] | null>(null);
  useEffect(() => {
    fetch(`/api/portal/events/${eventId}/tasks`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { tasks: [] }))
      .then((j) => {
        setItems(j.tasks ?? []);
        onCount?.((j.tasks ?? []).length);
      })
      .catch(() => {
        setItems([]);
        onCount?.(0);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only refetch when the event changes
  }, [eventId]);
  if (!items?.length) return null;
  const done = items.filter((i) => i.status === "done").length;
  return (
    <GlassCard className={cn("flex flex-col gap-2", className)} data-tour="portal-checklist">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[2.5px] text-muted">Your planning checklist</p>
        <span className="text-xs text-muted">
          {done} of {items.length} done
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-panel">
        <div className="h-full rounded-full bg-gold" style={{ width: `${(done / items.length) * 100}%` }} />
      </div>
      <ul className="flex flex-col">
        {items.map((i) => {
          const isDone = i.status === "done";
          const body = (
            <>
              <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border", isDone ? "border-status-approved bg-status-approved text-white" : "border-border")}>{isDone && <Check size={12} />}</span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm", isDone && "text-muted line-through decoration-muted/60")}>{i.title}</span>
                {!isDone && i.due_date && <span className="text-xs text-muted">By {new Date(`${i.due_date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
              </span>
              {!isDone && i.link && <ChevronRight size={15} className="mt-0.5 shrink-0 text-muted" />}
            </>
          );
          return (
            <li key={i.id}>
              {!isDone && i.link ? (
                <Link href={i.link.href} className="flex items-start gap-3 rounded-[10px] px-1 py-2 hover:bg-panel/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
                  {body}
                </Link>
              ) : (
                <div className="flex items-start gap-3 px-1 py-2">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </GlassCard>
  );
}

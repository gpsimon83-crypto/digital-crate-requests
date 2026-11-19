"use client";

import Link from "next/link";
import { ArrowRight, CalendarClock, Check, ChevronRight, ClipboardList, FileSignature, Lock, Music, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";

type Status = "todo" | "done" | "locked";
interface Step {
  key: string;
  icon: LucideIcon;
  title: string;
  description: string;
  status: Status;
  /** Why it isn't open yet ("Opens after your first payment"). */
  lockedNote?: string;
  href?: string;
  onClick?: () => void;
  /** Label for the big button when this is the next thing to do. */
  cta: string;
}

/**
 * Your next steps: the next available action as the page's strongest
 * button, then the other steps as quieter rows showing whether each is done,
 * to do, or not open yet (and why).
 */
export function NextStepsCard({
  eventId,
  questionnaireCompleted,
  isWedding,
  musicPlanOpen,
  firstDanceSongSet,
  timelineSet,
  contractAwaitingSignature,
  balanceDue,
  onOpenMusic,
  onOpenContracts,
  onOpenPayments
}: {
  eventId: string;
  questionnaireCompleted: boolean;
  isWedding: boolean;
  /** The wedding music plan has been sent (first dance and timeline live there). */
  musicPlanOpen: boolean;
  firstDanceSongSet: boolean;
  timelineSet: boolean;
  contractAwaitingSignature: boolean;
  balanceDue: boolean;
  onOpenMusic: () => void;
  onOpenContracts: () => void;
  onOpenPayments: () => void;
}) {
  const notYet = "Opens once your DJ sends your music plan (after your first payment)";
  const steps: Step[] = [
    {
      key: "details",
      icon: ClipboardList,
      title: "Complete your event details",
      description: questionnaireCompleted ? "Thank you! Review or update your answers any time." : "Help us get to know your day, style, and vision.",
      status: questionnaireCompleted ? "done" : "todo",
      href: `/portal/questionnaire/${eventId}`,
      cta: "Start planning"
    }
  ];
  if (contractAwaitingSignature) steps.push({ key: "contract", icon: FileSignature, title: "Sign your contract", description: "Review and sign to lock in your date.", status: "todo", onClick: onOpenContracts, cta: "Review & sign contract" });
  if (isWedding) {
    steps.push({ key: "first-dance", icon: Music, title: "Choose your first dance", description: "Tell us your song and share any special notes.", status: !musicPlanOpen ? "locked" : firstDanceSongSet ? "done" : "todo", lockedNote: notYet, onClick: onOpenMusic, cta: "Choose your first dance" });
    steps.push({ key: "timeline", icon: CalendarClock, title: "Review your event timeline", description: "Key moments and transitions, with real clock times.", status: !musicPlanOpen ? "locked" : timelineSet ? "done" : "todo", lockedNote: notYet, onClick: onOpenMusic, cta: "Review your timeline" });
  }
  if (balanceDue) steps.push({ key: "payment", icon: Wallet, title: "Make a payment", description: "See what's due and pay securely.", status: "todo", onClick: onOpenPayments, cta: "Make a payment" });

  const next = steps.find((s) => s.status === "todo") ?? null;
  const rest = steps.filter((s) => s !== next);
  const btn = "inline-flex items-center justify-center gap-2 rounded-[12px] px-5 py-3 text-[15px] font-semibold text-[var(--on-gold)] shadow-[0_10px_26px_-12px_var(--gold)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)]";
  const btnStyle = { background: "linear-gradient(160deg, var(--gold-light), var(--gold) 60%)" };

  return (
    <GlassCard className="flex flex-col gap-1 p-0" data-tour="portal-next-steps">
      <p className="px-5 pt-5 text-xs font-semibold uppercase tracking-[2.5px] text-muted">Your next steps</p>
      {next ? (
        <div className="mx-5 mt-3 flex flex-col gap-4 rounded-[14px] border border-gold/30 bg-gold-soft/60 p-5 sm:flex-row sm:items-center">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card text-gold">
            <next.icon size={20} strokeWidth={1.6} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl leading-tight">{next.title}</p>
            <p className="mt-0.5 text-sm text-muted">{next.description}</p>
          </div>
          {next.href ? (
            <Link href={next.href} className={btn} style={btnStyle}>
              {next.cta} <ArrowRight size={17} />
            </Link>
          ) : (
            <button type="button" onClick={next.onClick} className={btn} style={btnStyle}>
              {next.cta} <ArrowRight size={17} />
            </button>
          )}
        </div>
      ) : (
        <p className="mx-5 mt-3 flex items-center gap-2 rounded-[14px] border border-border bg-panel/60 p-4 text-sm">
          <Check size={16} className="text-status-approved" /> You&rsquo;re all caught up. We&rsquo;ll let you know when there&rsquo;s something new.
        </p>
      )}

      <ul className="mt-2 flex flex-col px-2 pb-2">
        {rest.map((s) => {
          const open = s.status !== "locked" && (s.href || s.onClick);
          const inner = (
            <>
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", s.status === "done" ? "bg-status-approved/15 text-status-approved" : "bg-panel text-muted")}>
                {s.status === "done" ? <Check size={15} /> : s.status === "locked" ? <Lock size={14} /> : <s.icon size={15} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{s.title}</span>
                <span className="block text-xs text-muted">{s.status === "locked" ? s.lockedNote : s.description}</span>
              </span>
              <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide", s.status === "done" ? "bg-status-approved/15 text-status-approved" : s.status === "locked" ? "bg-panel text-muted" : "bg-gold-soft text-gold-dim")}>
                {s.status === "done" ? "Done" : s.status === "locked" ? "Not open yet" : "To do"}
              </span>
              {open && <ChevronRight size={15} className="shrink-0 text-muted" />}
            </>
          );
          const cls = "flex w-full items-center gap-3 rounded-[10px] px-3 py-3 text-left";
          return (
            <li key={s.key} className="border-t border-border first:border-t-0">
              {!open ? (
                <div className={cls} aria-disabled>
                  {inner}
                </div>
              ) : s.href ? (
                <Link href={s.href} className={cn(cls, "hover:bg-panel/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold")}>
                  {inner}
                </Link>
              ) : (
                <button type="button" onClick={s.onClick} className={cn(cls, "hover:bg-panel/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold")}>
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </GlassCard>
  );
}

"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCircle2, ClipboardList, FileSignature, FileText, Mail, Package, Wallet } from "lucide-react";
import { StageRail } from "./milestone-stepper";
import type { StageAction, StageGuide } from "@/lib/pipeline-guide";
import { cn } from "@/lib/utils";

const ICONS: Record<StageAction["icon"], typeof Mail> = {
  mail: Mail,
  calendar: CalendarDays,
  package: Package,
  contract: FileSignature,
  money: Wallet,
  planning: ClipboardList,
  check: CheckCircle2,
  activity: FileText
};

/**
 * The booking panel: the stage rail on top, a hairline, then the current
 * stage, where things stand / what's next, and the one primary action. The
 * action button is the page's strongest accent on purpose.
 */
export function BookingPanel({
  stages,
  current,
  onSelect,
  disabled,
  guide,
  actionHref,
  onMove
}: {
  stages: readonly string[];
  current: string;
  onSelect: (stage: string) => void;
  disabled?: boolean;
  guide: StageGuide;
  /** Where an action that opens a tab goes. */
  actionHref: (a: StageAction) => string;
  onMove: (stage: string) => void;
}) {
  const index = stages.indexOf(current);
  const a = guide.action;
  const Icon = a ? ICONS[a.icon] : null;
  const btn = "inline-flex shrink-0 items-center justify-center gap-2.5 rounded-[12px] px-5 py-3 text-[15px] font-semibold text-[var(--on-gold)] shadow-[0_8px_24px_-10px_var(--gold)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--panel)] disabled:opacity-60 sm:text-base";
  const btnStyle = { background: "linear-gradient(160deg, var(--gold-light), var(--gold) 60%)" };

  return (
    <section className="rounded-[16px] border border-border bg-panel/95 shadow-[var(--shadow-card)] backdrop-blur-sm" data-tour="project-timeline" aria-label="Booking">
      <div className="flex flex-col gap-3 px-5 pb-3 pt-4 md:flex-row md:items-start md:gap-6 md:px-6">
        <h2 className="shrink-0 pt-0.5 font-display text-2xl leading-none">Booking</h2>
        <StageRail stages={stages} current={current} onSelect={onSelect} disabled={disabled} />
      </div>
      <div className="mx-5 h-px bg-border md:mx-6" aria-hidden />
      <div className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:gap-6 md:px-6" aria-live="polite">
        <div className="shrink-0 md:min-w-[220px]">
          <p className="text-[10px] font-semibold uppercase tracking-[2.5px] text-muted">Current stage</p>
          <p className="mt-1 font-display text-[28px] leading-tight">
            {current}
            {index >= 0 && <span className="ml-2 align-middle font-sans text-xs font-normal text-muted">Step {index + 1} of {stages.length}</span>}
          </p>
        </div>
        <div className="hidden w-px self-stretch bg-border md:block" aria-hidden />
        <div className="min-w-0 flex-1 text-sm leading-relaxed text-foreground/90 sm:text-[15px]">
          <p>{guide.now}</p>
          {guide.next && <p>{guide.next}</p>}
        </div>
        {a && Icon && (a.moveTo ? (
          <button type="button" className={cn(btn)} style={btnStyle} disabled={disabled} onClick={() => onMove(a.moveTo!)}>
            <Icon size={18} strokeWidth={1.75} /> {a.label} <ArrowRight size={17} />
          </button>
        ) : (
          <Link href={actionHref(a)} className={btn} style={btnStyle}>
            <Icon size={18} strokeWidth={1.75} /> {a.label} <ArrowRight size={17} />
          </Link>
        ))}
      </div>
    </section>
  );
}

"use client";

import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";
import { ClipboardList, Music, CalendarClock, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Step {
  icon: LucideIcon;
  title: string;
  description: string;
  done: boolean;
  comingSoon?: boolean;
  onClick?: () => void;
}

export function NextStepsCard({
  questionnaireCompleted,
  firstDanceSongSet,
  isWedding,
  onOpenForms,
  onOpenMusic
}: {
  questionnaireCompleted: boolean;
  firstDanceSongSet: boolean;
  isWedding: boolean;
  onOpenForms: () => void;
  onOpenMusic: () => void;
}) {
  const steps: Step[] = [
    {
      icon: ClipboardList,
      title: "Complete your event details",
      description: "Help us get to know your day, style, and vision.",
      done: questionnaireCompleted,
      onClick: onOpenForms
    }
  ];

  if (isWedding) {
    steps.push({
      icon: Music,
      title: "Choose your first dance",
      description: "Tell us your song and share any special notes.",
      done: firstDanceSongSet,
      onClick: onOpenMusic
    });
  }

  steps.push({
    icon: CalendarClock,
    title: "Review your event timeline",
    description: "We'll confirm key moments and transitions.",
    done: false,
    comingSoon: true
  });

  return (
    <GlassCard className="flex flex-col gap-1">
      <p className="mb-2 text-sm font-semibold">Your next steps</p>
      {steps.map((step) => (
        <button
          key={step.title}
          onClick={step.onClick}
          disabled={!step.onClick}
          className={cn(
            "flex items-center gap-3 rounded-[10px] px-2 py-3 text-left transition-colors",
            step.onClick ? "hover:bg-panel" : "cursor-default"
          )}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-soft text-gold-dim">
            <step.icon size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{step.title}</p>
            <p className="truncate text-xs text-muted">{step.description}</p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
              step.comingSoon ? "bg-panel text-muted" : step.done ? "bg-status-approved/15 text-status-approved" : "bg-gold-soft text-gold-dim"
            )}
          >
            {step.comingSoon ? "Coming soon" : step.done ? "Done" : "To do"}
          </span>
          {step.onClick && <ChevronRight size={15} className="shrink-0 text-muted" />}
        </button>
      ))}
    </GlassCard>
  );
}

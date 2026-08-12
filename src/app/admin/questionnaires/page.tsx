"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

interface TemplateSummary {
  id: string;
  event_type: string;
  title: string;
  is_active: boolean;
  section_count: number;
  question_count: number;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  wedding: "Wedding",
  bar_nightclub: "Bar & Nightclub",
  corporate: "Corporate",
  private_party: "Private Party",
  school_dance: "School Dance"
};

export default function AdminQuestionnairesPage() {
  const [templates, setTemplates] = useState<TemplateSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/questionnaires")
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || "Failed to load questionnaires");
        setTemplates(data.templates);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."));
  }, []);

  return (
    <>
      <PageHeader title="Questionnaire Builder" subtitle="Manage the planning questionnaire each client sees, by event type." />
      <div className="flex flex-col gap-4 p-6">
        {error && <p className="text-sm text-status-declined">{error}</p>}
        {!templates && !error && <p className="text-sm text-muted">Loading...</p>}

        {templates && (
          <div className="grid gap-4 sm:grid-cols-2">
            {templates.map((t) => (
              <Link key={t.id} href={`/admin/questionnaires/${t.id}`}>
                <GlassCard className="flex items-center justify-between gap-3 transition-colors hover:border-gold/40">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{EVENT_TYPE_LABELS[t.event_type] ?? t.event_type}</p>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                          t.is_active ? "bg-status-approved/15 text-status-approved" : "bg-black/5 text-muted"
                        )}
                      >
                        {t.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">{t.title}</p>
                    <p className="mt-1 text-xs text-muted">
                      {t.section_count} {t.section_count === 1 ? "chapter" : "chapters"} · {t.question_count} {t.question_count === 1 ? "question" : "questions"}
                    </p>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-muted" />
                </GlassCard>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

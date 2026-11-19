"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { QuestionnaireFlow } from "@/components/portal/questionnaire/questionnaire-flow";

/**
 * A questionnaire sent by private link (no login; /w/<name>-<code>, older links /q/<code>) — e.g. Wedding Basics for
 * a client we can't email. Same slides as the client portal questionnaire.
 */
export function LinkQuestionnaire({ token }: { token: string }) {
  const [paused, setPaused] = useState(false);
  const api = `/api/q/${encodeURIComponent(token)}`;

  if (paused)
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-12 text-center">
        <Check size={36} className="text-gold" />
        <h1 className="mt-4 font-display text-3xl font-light">Your answers are saved</h1>
        <p className="mt-3 max-w-sm text-sm text-muted">Open this same link any time to pick up where you left off.</p>
        <button className="mt-6 text-sm font-medium text-gold hover:underline" onClick={() => setPaused(false)}>
          Keep going now
        </button>
      </div>
    );

  return (
    <QuestionnaireFlow
      load={async () => {
        const r = await fetch(api, { cache: "no-store" });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "This questionnaire link isn't working. Please contact Digital Crate DJs.");
        return { template: data.template, response: data.response, locked: data.locked };
      }}
      save={async (answers, extra) => {
        await fetch(api, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers, ...(extra?.currentQuestionKey !== undefined ? { currentQuestionKey: extra.currentQuestionKey } : {}) })
        });
      }}
      submit={async (answers) => {
        const r = await fetch(`${api}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers }) });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "Couldn't submit right now. Your answers are saved — please try again.");
        return { completed_at: data.completed_at };
      }}
      onSaveExit={() => setPaused(true)}
      lockAfterSubmit
      doneText="Thank you! Your answers are in. We'll check our calendar and be in touch to confirm your date."
    />
  );
}

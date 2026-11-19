"use client";

import { use as usePromise } from "react";
import { useRouter } from "next/navigation";
import { QuestionnaireFlow } from "@/components/portal/questionnaire/questionnaire-flow";

export default function QuestionnairePage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = usePromise(params);
  const router = useRouter();
  return (
    <QuestionnaireFlow
      load={async () => {
        const r = await fetch(`/api/portal/events/${eventId}/questionnaire`);
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Failed to load questionnaire");
        return { template: data.template, response: data.response };
      }}
      save={async (answers, extra) => {
        await fetch(`/api/portal/events/${eventId}/questionnaire`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answers,
            ...(extra?.currentQuestionKey !== undefined ? { currentQuestionKey: extra.currentQuestionKey } : {})
          })
        });
      }}
      submit={async () => {
        const res = await fetch(`/api/portal/events/${eventId}/questionnaire/submit`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to submit");
        return { completed_at: data.response.completed_at };
      }}
      onSaveExit={() => router.push(`/portal/events/${eventId}?tab=services`)}
      backLink={{ href: `/portal/events/${eventId}`, label: "Back to your event" }}
    />
  );
}

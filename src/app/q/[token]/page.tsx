"use client";

import { use as usePromise } from "react";
import { LinkQuestionnaire } from "@/components/portal/questionnaire/link-questionnaire";

export default function LinkQuestionnairePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = usePromise(params);
  return <LinkQuestionnaire token={token} />;
}

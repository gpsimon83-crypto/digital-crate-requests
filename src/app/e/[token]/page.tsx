"use client";

import { use as usePromise } from "react";
import { LinkQuestionnaire } from "@/components/portal/questionnaire/link-questionnaire";

/** Event Basics by private link: /e/<name>-<code>. Same questionnaire screens as /w/. */
export default function EventBasicsLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = usePromise(params);
  return <LinkQuestionnaire token={token} />;
}

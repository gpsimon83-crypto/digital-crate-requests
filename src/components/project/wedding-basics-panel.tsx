"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardList, Copy, Eye, Link2, Loader2, MessageSquare, RotateCcw, Unlock } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WeddingBasicsInsights } from "./wedding-basics-insights";

type LinkView = {
  url: string;
  created_at: string;
  opened_at: string | null;
  completed_at: string | null;
  locked: boolean;
  answered: number;
  applied: { filled: string[]; differs: { field: string; current: string; answered: string }[] } | null;
  answers: { section: string; prompt: string; answer: string | null }[];
};
type View = { ready: boolean; templateId?: string; total?: number; link?: LinkView | null };

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * Wedding Basics by private link: for clients we can't email. Create the
 * link, copy it or text it, watch progress, and see the answers. Submitted
 * answers are locked; they fill the event's empty fields (date, venue,
 * guests, couple name) and the client's (name, phone, email).
 */
export function WeddingBasicsPanel({ eventId, clientPhone, clientFirstName }: { eventId: string; clientPhone: string | null; clientFirstName: string | null }) {
  const [view, setView] = useState<View | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [rev, setRev] = useState(0);

  const load = useCallback(() => {
    fetch(`/api/admin/events/${eventId}/questionnaire-link`)
      .then((r) => r.json())
      .then(setView)
      .catch(() => setView({ ready: false }));
  }, [eventId]);
  useEffect(() => load(), [load]);

  async function act(action: "create" | "renew" | "unlock" | "revoke") {
    setBusy(true);
    setMsg(null);
    const r = await fetch(`/api/admin/events/${eventId}/questionnaire-link`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg(j.error ?? "Something went wrong.");
    setView(j);
    setRev((n) => n + 1);
    if (action === "renew") setMsg("New link made. The old link no longer works; answers so far carried over.");
    if (action === "unlock") setMsg("Unlocked. They can change their answers and submit again.");
  }

  const link = view?.link ?? null;
  // The link goes on its own last line so phones show it as a tappable "Wedding Basics" card.
  const textBody = link ? `Hi${clientFirstName ? ` ${clientFirstName}` : ""}! It's Digital Crate DJs. Here's your Wedding Basics questionnaire, a few quick questions to lock in your date (about 3 minutes):\n\n${link.url}` : "";
  const smsHref = link ? `sms:${(clientPhone ?? "").replace(/[^\d+]/g, "")}?&body=${encodeURIComponent(textBody)}` : "#";

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this:", text);
    }
  }

  return (
    <GlassCard className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <ClipboardList size={16} className="text-gold" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Wedding Basics questionnaire</p>
          <p className="text-xs text-muted">{view?.total ? `${view.total} required questions` : "Required questions"}, no login: the day, setup, the couple, and how to reach them. Their answers fill in the client and event, and recommend packages.</p>
        </div>
        {view?.ready && view.templateId && (
          <a
            href={`/portal/questionnaire/preview/${view.templateId}`}
            target="_blank"
            rel="noreferrer"
            data-tour="wb-preview"
            className="flex shrink-0 items-center gap-1.5 rounded-[10px] border border-black/12 px-3 py-1.5 text-xs font-medium text-muted hover:border-gold hover:text-foreground"
          >
            <Eye size={14} /> Preview questions
          </a>
        )}
      </div>

      {!view ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : !view.ready ? (
        <p className="rounded-[10px] bg-status-pending/10 p-3 text-xs text-status-pending">Run migration 0054_questionnaire_links.sql in Supabase to turn this on.</p>
      ) : view.total === 10 && !link?.completed_at && (
        <p className="rounded-[10px] bg-status-pending/10 p-3 text-xs text-status-pending">Run migration 0055_wedding_basics_contact.sql in Supabase to add the “best way to reach you / best days and times” questions.</p>
      )}
      {!view || !view.ready ? null : !link ? (
        <Button variant="secondary" size="sm" className="self-start" data-tour="wb-send" disabled={busy} onClick={() => void act("create")}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />} Create link to send
        </Button>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-semibold",
                link.completed_at ? "bg-status-approved/15 text-status-approved" : link.opened_at ? "bg-status-pending/15 text-status-pending" : "bg-black/5 text-muted"
              )}
            >
              {link.completed_at ? `Submitted ${when(link.completed_at)}` : link.opened_at ? `In progress · ${link.answered} of ${view.total} answered` : "Not opened yet"}
            </span>
            {link.locked && <span className="text-muted">Answers locked</span>}
          </div>

          <div className="flex min-w-0 items-center gap-2 rounded-[10px] border border-black/10 bg-panel px-3 py-2">
            <span className="min-w-0 flex-1 truncate font-mono text-xs" title={link.url}>
              {link.url}
            </span>
            <button className="shrink-0 text-xs font-medium text-gold hover:underline" onClick={() => void copy(link.url)}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="flex flex-wrap gap-2" data-tour="wb-send">
            <a href={smsHref}>
              <Button variant="secondary" size="sm">
                <MessageSquare size={14} /> Text it{clientPhone ? ` to ${clientPhone}` : ""}
              </Button>
            </a>
            <Button variant="secondary" size="sm" onClick={() => void copy(textBody)}>
              <Copy size={14} /> Copy message
            </Button>
            {link.locked && (
              <Button variant="secondary" size="sm" disabled={busy} onClick={() => void act("unlock")}>
                <Unlock size={14} /> Let them edit
              </Button>
            )}
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => void act("renew")}>
              <RotateCcw size={14} /> New link
            </Button>
          </div>
          <p className="text-[11px] text-muted">&ldquo;Text it&rdquo; opens Messages on your phone or Mac with the message filled in. You can also paste it into any app.</p>

          <WeddingBasicsInsights eventId={eventId} refreshKey={rev} showStatus={false} />
        </>
      )}
      {msg && <p className="text-xs text-muted">{msg}</p>}
    </GlassCard>
  );
}

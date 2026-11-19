"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Package, Send, Sparkles, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AddOn = { key: string; name: string; quantity: number; reason: string };
type Rec = { templateId: string; name: string; tier: string | null; best: boolean; totalCents: number | null; requiresQuote: boolean; why: string[]; watch: string[]; notOffered: AddOn[] };
type Insights = {
  ready: boolean;
  templateId?: string;
  total?: number;
  link: {
    created_at: string;
    opened_at: string | null;
    completed_at: string | null;
    locked: boolean;
    answered: number;
    applied: { filled: string[]; differs: { field: string; current: string; answered: string }[] } | null;
    answers: { section: string; prompt: string; answer: string | null }[];
  } | null;
  recommendations: { addOns: AddOn[]; notes: string[]; packages: Rec[]; packagesError: string | null } | null;
};

const money = (c: number) => (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * What a couple's Wedding Basics answers mean for the booking: how to reach
 * them, the packages that fit (with the extras added and the reasons), what
 * was filled into the CRM, and their answers. Shared by the admin event page
 * and the DJ's project page; both can use an answer or send a package.
 */
export function WeddingBasicsInsights({ eventId, refreshKey = 0, showStatus = true }: { eventId: string; refreshKey?: number; showStatus?: boolean }) {
  const [data, setData] = useState<Insights | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/events/${eventId}/wedding-basics`, { cache: "no-store" })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ ready: false, link: null, recommendations: null }));
  }, [eventId]);
  useEffect(() => load(), [load, refreshKey]);

  async function post(body: Record<string, string>, key: string) {
    setBusy(key);
    setMsg(null);
    const r = await fetch(`/api/events/${eventId}/wedding-basics`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) return setMsg(j.error ?? "Something went wrong.");
    if (body.action === "use") {
      setData(j);
      setMsg(`Updated ${body.field.toLowerCase()} with their answer.`);
    } else setMsg(`${j.name} is in their client portal as a draft for them to review.`);
  }

  if (!data) return <p className="text-xs text-muted">Loading…</p>;
  if (!data.ready) return showStatus ? <p className="text-xs text-muted">Wedding Basics isn&apos;t set up yet.</p> : null;
  const link = data.link;
  if (!link) return showStatus ? <p className="text-xs text-muted">Wedding Basics hasn&apos;t been sent yet.</p> : null;

  const reach = link.answers.filter((a) => a.section === "Staying in Touch" && a.answer);
  const rec = data.recommendations;
  const submitted = !!link.completed_at;

  return (
    <div className="flex flex-col gap-3">
      {showStatus && (
        <p className="text-xs">
          <span className={cn("rounded-full px-2 py-0.5 font-semibold", submitted ? "bg-status-approved/15 text-status-approved" : link.opened_at ? "bg-status-pending/15 text-status-pending" : "bg-black/5 text-muted")}>
            {submitted ? `Submitted ${when(link.completed_at!)}` : link.opened_at ? `In progress · ${link.answered} of ${data.total} answered` : "Sent, not opened yet"}
          </span>
        </p>
      )}

      {reach.length > 0 && (
        <div className="rounded-[10px] border border-gold/30 bg-gold/5 p-3 text-xs">
          <p className="mb-1 font-semibold">Best way and time to reach them</p>
          {reach.map((a) => (
            <p key={a.prompt}>
              <span className="text-muted">{a.prompt.replace(/\?$/, "")}:</span> <span className="font-medium">{a.answer}</span>
            </p>
          ))}
        </div>
      )}

      {rec && (
        <div className="flex flex-col gap-2" data-tour="wb-recommend">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles size={15} className="text-gold" /> Recommended for this couple
            {!submitted && <span className="text-[11px] font-normal text-muted">(from their answers so far)</span>}
          </p>
          {rec.packages.length === 0 ? (
            <p className="rounded-[10px] bg-black/[0.03] p-3 text-xs text-muted">
              {rec.packagesError ?? "No published wedding packages yet. Publish one in Admin → Packages to get package picks; the extras below still apply."}
            </p>
          ) : (
            <div className="grid gap-2 md:grid-cols-3">
              {rec.packages.map((p) => (
                <div key={p.templateId} className={cn("flex flex-col gap-1.5 rounded-[12px] border p-3 text-xs", p.best ? "border-gold bg-gold/5" : "border-black/10")}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-sm font-semibold">
                      <Package size={14} className="shrink-0 text-gold" /> {p.name}
                    </p>
                    {p.best && <span className="shrink-0 rounded-full bg-gold px-2 py-0.5 text-[10px] font-semibold text-[#1A140A]">Best fit</span>}
                  </div>
                  <p className="text-base font-semibold">{p.totalCents != null ? `${money(p.totalCents)}${p.requiresQuote ? "+" : ""}` : "Quote"}</p>
                  <p className="text-[11px] text-muted">With the extras below{p.requiresQuote ? "; some items need a quote" : ""}</p>
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {p.why.map((w) => (
                      <li key={w} className="flex items-start gap-1">
                        <Check size={12} className="mt-0.5 shrink-0 text-status-approved" /> {w}
                      </li>
                    ))}
                    {p.watch.map((w) => (
                      <li key={w} className="flex items-start gap-1 text-status-pending">
                        <TriangleAlert size={12} className="mt-0.5 shrink-0" /> {w}
                      </li>
                    ))}
                    {p.notOffered.map((a) => (
                      <li key={a.key} className="flex items-start gap-1 text-muted">
                        <TriangleAlert size={12} className="mt-0.5 shrink-0" /> Not in this package: {a.name.charAt(0).toLowerCase() + a.name.slice(1)}
                      </li>
                    ))}
                  </ul>
                  {submitted && (
                    <Button variant={p.best ? "primary" : "secondary"} size="sm" className="mt-auto self-start" disabled={!!busy} onClick={() => void post({ action: "send", templateId: p.templateId }, p.templateId)}>
                      {busy === p.templateId ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Send to client portal
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          {(rec.addOns.length > 0 || rec.notes.length > 0) && (
            <div className="rounded-[10px] bg-black/[0.03] p-3 text-xs">
              <p className="mb-1 font-semibold">Why: what their day needs</p>
              {rec.addOns.map((a) => (
                <p key={a.key}>
                  <span className="font-medium">
                    {a.quantity > 1 ? `${a.quantity} × ` : ""}
                    {a.name}
                  </span>
                  <span className="text-muted">: {a.reason}</span>
                </p>
              ))}
              {rec.notes.map((n) => (
                <p key={n} className="text-muted">
                  {n}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {link.applied && (link.applied.filled.length > 0 || link.applied.differs.length > 0) && (
        <div className="rounded-[10px] bg-black/[0.03] p-3 text-xs">
          {link.applied.filled.length > 0 && (
            <p className="flex items-start gap-1.5">
              <Check size={13} className="mt-0.5 shrink-0 text-status-approved" /> Filled in: {link.applied.filled.join(", ")}
            </p>
          )}
          {link.applied.differs.map((d) => (
            <div key={d.field} className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-status-pending">
                {d.field}: they said &ldquo;{d.answered}&rdquo;, the CRM has &ldquo;{d.current}&rdquo;
              </span>
              <button className="font-medium text-gold-dim underline underline-offset-2 disabled:opacity-50" disabled={!!busy} onClick={() => void post({ action: "use", field: d.field }, d.field)}>
                {busy === d.field ? "Updating…" : "Use their answer"}
              </button>
            </div>
          ))}
        </div>
      )}

      {link.answered > 0 && (
        <details className="text-sm" open={submitted && !rec}>
          <summary className="cursor-pointer text-xs font-medium text-gold">All answers</summary>
          <dl className="mt-2 grid gap-1.5">
            {link.answers.map((a) => (
              <div key={a.prompt} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-3 border-b border-black/5 pb-1.5 text-xs">
                <dt className="text-muted">{a.prompt}</dt>
                <dd className={cn("font-medium", !a.answer && "text-muted")}>{a.answer ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
      {msg && <p className="text-xs text-muted">{msg}</p>}
    </div>
  );
}

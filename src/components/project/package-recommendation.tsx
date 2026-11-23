"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ClipboardList, Copy, Sparkles, TriangleAlert } from "lucide-react";
import { SectionCard } from "@/components/layout/grid";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dollars } from "@/lib/payouts/rule";
import type { RecOption } from "@/lib/catalog-recommend";

type Option = RecOption & { payout?: { djCents: number; companyCents: number } | null };
type Rec = {
  ready: boolean;
  source?: "wedding_basics" | "event_basics" | "project";
  kind?: "wedding" | "event";
  answeredAt?: string | null;
  notes?: string[];
  options?: Option[];
  currentPackageId?: string | null;
  canUse?: boolean;
  showsPayout?: boolean;
  error?: string;
};
type LinkView = { ready: boolean; kind?: "wedding" | "event"; title?: string; total?: number; link: { url: string; completed_at: string | null; opened_at: string | null; locked: boolean; answered: number } | null };

/**
 * The package and estimated price the client's answers point to, from the
 * Services catalog. For staff and the project's DJ; the client never sees
 * it. Also sends the Basics questionnaire that feeds it.
 *
 * `linkControls`: show the questionnaire link here (the admin page already
 * has its own Wedding Basics panel, so it passes "event").
 */
export function PackageRecommendation({ eventId, linkControls = "always" }: { eventId: string; linkControls?: "always" | "event" }) {
  const [rec, setRec] = useState<Rec | null>(null);
  const [link, setLink] = useState<LinkView | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(
    () =>
      Promise.all([
        fetch(`/api/events/${eventId}/recommendation`, { cache: "no-store" }).then((r) => r.json()),
        fetch(`/api/events/${eventId}/basics-link`, { cache: "no-store" }).then((r) => r.json())
      ])
        .then(([a, b]) => {
          setRec(a);
          setLink(b);
        })
        .catch(() => setRec({ ready: false, error: "Couldn't load the recommendation." })),
    [eventId]
  );
  useEffect(() => {
    void load();
  }, [load]);

  async function linkAction(action: string) {
    setBusy(action);
    setMsg(null);
    const r = await fetch(`/api/events/${eventId}/basics-link`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) return setMsg(j.error ?? "Something went wrong.");
    setLink(j);
    if (action !== "revoke" && j.link?.url) {
      await navigator.clipboard?.writeText(j.link.url).catch(() => {});
      setMsg("Link copied. Text or email it to the client.");
    }
  }
  async function choosePackage(o: Option) {
    setBusy(o.packageId);
    setMsg(null);
    const r = await fetch(`/api/events/${eventId}/recommendation`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packageId: o.packageId }) });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) return setMsg(j.error ?? "Couldn't save");
    setRec((x) => x && { ...x, currentPackageId: o.packageId });
    // The DJ offer panel on the same page picks up the new package.
    window.dispatchEvent(new CustomEvent("project-package-changed", { detail: { eventId, packageId: o.packageId } }));
    setMsg(`${o.name} is now this project's package. DJ offers will suggest its payout.`);
  }

  if (!rec || (!rec.ready && !rec.error)) return null;
  const showLink = link?.ready && (linkControls === "always" || link.kind === "event");
  const source =
    rec.source === "project"
      ? "From the project's guest count and times. Send the questionnaire for a better fit."
      : `From the ${rec.source === "wedding_basics" ? "Wedding" : "Event"} Basics answers${rec.answeredAt ? `, finished ${new Date(rec.answeredAt).toLocaleDateString()}` : " so far"}.`;

  return (
    <SectionCard data-tour="package-recommendation" icon={Sparkles} title="Recommended package" description="What fits from your Services catalog, with an estimated price. Only the office and this project's DJ see this.">
      {rec.error && (
        <p role="alert" className="text-sm text-status-declined">
          {rec.error}
        </p>
      )}
      {showLink && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[10px] border border-border px-3 py-2 text-sm" data-tour="basics-link">
          <ClipboardList size={15} aria-hidden className="text-gold" />
          <span className="min-w-0 flex-1">
            <strong>{link!.title}</strong>
            {" · "}
            {!link!.link ? "Not sent yet" : link!.link.completed_at ? "Finished" : link!.link.opened_at ? `Opened · ${link!.link.answered} of ${link!.total} answered` : "Sent, not opened yet"}
          </span>
          {!link!.link ? (
            <Button size="sm" variant="primary" disabled={!!busy} onClick={() => linkAction("create")}>
              Create link
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  void navigator.clipboard?.writeText(link!.link!.url).catch(() => {});
                  setMsg("Link copied.");
                }}
              >
                <Copy size={13} aria-hidden /> Copy link
              </Button>
              {link!.link.locked && (
                <Button size="sm" variant="text" disabled={!!busy} onClick={() => linkAction("unlock")}>
                  Let them edit
                </Button>
              )}
            </>
          )}
        </div>
      )}
      <p className="text-xs text-muted">{source}</p>
      {(rec.notes ?? []).length > 0 && <p className="text-xs text-muted">{rec.notes!.join(" · ")}</p>}
      {(rec.options ?? []).length === 0 ? (
        <p className="text-sm text-muted">No active packages in this event&apos;s category yet.</p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-3">
          {rec.options!.map((o) => {
            const current = rec.currentPackageId === o.packageId;
            return (
              <li key={o.packageId} className={cn("flex min-w-0 flex-col gap-2 rounded-[12px] border p-4", o.best ? "border-gold" : "border-border")} data-rec={o.name}>
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 break-words font-semibold leading-snug">{o.name}</p>
                  {o.best && <span className="shrink-0 rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-semibold text-gold">Best fit</span>}
                </div>
                <p className="text-sm text-muted">
                  {o.priceLabel}
                  {o.hours != null && ` · ${o.hours} hours`}
                </p>
                {o.addOns.length > 0 && (
                  <ul className="flex flex-col gap-0.5 text-sm">
                    {o.addOns.map((a) => (
                      <li key={a.name} className="flex justify-between gap-2" title={a.reason}>
                        <span>{a.name}</span>
                        <span className={a.included ? "text-status-approved" : "text-foreground"}>{a.included ? "Included" : `+${dollars(a.priceCents)}`}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="border-t border-border pt-2 text-sm" data-testid="rec-estimate">
                  {o.estimateCents == null ? (
                    <strong>Priced by quote</strong>
                  ) : (
                    <>
                      Estimated: <strong>{dollars(o.estimateCents)}</strong>
                      {o.estimateOnly && <span className="text-xs text-muted"> (starting price; confirm the quote)</span>}
                    </>
                  )}
                </p>
                {o.payout && (
                  <p className="text-xs text-muted" data-testid="rec-payout">
                    Est. DJ payout {dollars(o.payout.djCents)} · DCDJs {dollars(o.payout.companyCents)} before expenses
                  </p>
                )}
                {o.why.length > 0 && (
                  <ul className="text-xs text-muted">
                    {o.why.map((w) => (
                      <li key={w} className="flex gap-1.5">
                        <Check size={12} aria-hidden className="mt-0.5 shrink-0 text-status-approved" />
                        {w}
                      </li>
                    ))}
                  </ul>
                )}
                {o.watch.length > 0 && (
                  <ul className="text-xs text-status-urgent">
                    {o.watch.map((w) => (
                      <li key={w} className="flex gap-1.5">
                        <TriangleAlert size={12} aria-hidden className="mt-0.5 shrink-0" />
                        {w}
                      </li>
                    ))}
                  </ul>
                )}
                {rec.canUse && (
                  <div className="mt-auto pt-1">
                    {current ? (
                      <p className="text-xs font-medium text-status-approved">This project&apos;s package</p>
                    ) : (
                      <Button size="sm" variant={o.best ? "primary" : "secondary"} disabled={!!busy} onClick={() => choosePackage(o)}>
                        Use this package
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {msg && (
        <p role="status" className="text-sm text-muted">
          {msg}
        </p>
      )}
    </SectionCard>
  );
}

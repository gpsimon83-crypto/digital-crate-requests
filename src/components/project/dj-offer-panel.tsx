"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Send, History } from "lucide-react";
import { SectionCard, FieldGroup, FieldRow, INPUT } from "@/components/layout/grid";
import { Button } from "@/components/ui/button";
import { SideDrawer } from "@/components/ui/side-drawer";
import { cn } from "@/lib/utils";
import { computePayout, dollars, parseDollars, STANDARD_PERCENT, DJ_SOURCED_PERCENT, type PayoutRule } from "@/lib/payouts/rule";
import type { OfferRow, OfferExtra } from "@/lib/data/offers";

type Pkg = { id: string; name: string; price: number; pricing_type: string; quote_before_payment: boolean; is_active: boolean; payout_type: "percent" | "flat"; payout_percent: number; payout_flat_cents: number | null; eligible_service_cents: number | null; third_party_fee_cents: number | null };
type Gig = { id: string; gig_date: string; start_time: string; end_time: string; dj_id: string | null; coverage: string };
type Data = {
  ready: boolean;
  canManage?: boolean;
  offers: OfferRow[];
  event?: { id: string; title: string; event_type: string | null; starts_at: string | null; ends_at: string | null; quoted_amount: number | null; final_amount: number | null; package_id: string | null; dj_id: string | null };
  packages?: Pkg[];
  gigs?: Gig[];
  payouts?: { id: string; offer_id: string | null; status: string; amount_cents: number }[];
};

const STATUS: Record<OfferRow["status"], { label: string; tone: string }> = {
  draft: { label: "Draft", tone: "border-border text-muted" },
  offered: { label: "Offered", tone: "border-gold/60 text-gold" },
  accepted: { label: "Accepted", tone: "border-status-approved/50 text-status-approved" },
  declined: { label: "Declined", tone: "border-status-declined/50 text-status-declined" },
  withdrawn: { label: "Withdrawn", tone: "border-border text-muted" },
  superseded: { label: "Replaced", tone: "border-border text-muted" }
};

const chicagoTime = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-GB", { timeZone: "America/Chicago", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso)) : "");
const cents = (n: number | null | undefined) => (n == null ? "" : String(n / 100));

/**
 * Admin: make, send, revise and track DJ offers for one project. Pulls the
 * package's payout rule to suggest the amount; the admin can override it.
 * Internal numbers (client price, fees, company share) stay on this side.
 */
export function DjOfferPanel({ eventId, djs }: { eventId: string; djs: { id: string; label: string }[] }) {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<OfferRow | "new" | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(
    () =>
      fetch(`/api/admin/events/${eventId}/offers`, { cache: "no-store" })
        .then(async (r) => {
          const j = await r.json();
          if (r.status === 403) return setData({ ready: false, offers: [] });
          if (!r.ok) throw new Error(j.error || "Couldn't load offers");
          setData(j);
        })
        .catch((e) => setErr(e instanceof Error ? e.message : "Couldn't load offers")),
    [eventId]
  );
  useEffect(() => {
    void load();
    const onChange = () => void load();
    window.addEventListener("project-package-changed", onChange);
    return () => window.removeEventListener("project-package-changed", onChange);
  }, [load]);

  if (!data || (!data.ready && !err)) return null;
  const current = data.offers.filter((o) => o.status === "offered" || o.status === "accepted" || o.status === "draft");
  const djName = (id: string | null) => djs.find((d) => d.id === id)?.label ?? "No DJ yet";
  const payState = (o: OfferRow) => {
    const p = data.payouts?.find((x) => x.offer_id === o.id);
    return o.status !== "accepted" ? null : p?.status === "paid" ? "Paid" : "Payment pending";
  };

  async function withdraw(o: OfferRow) {
    setErr(null);
    const r = await fetch(`/api/admin/offers/${o.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "withdraw" }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(j.error || "Couldn't withdraw");
    setNotice("Offer withdrawn.");
    await load();
  }

  return (
    <SectionCard
      data-tour="dj-offer"
      title="DJ offer"
      description="What the DJ is paid and agrees to. They see the payout and scope, never the client price or split."
      actions={
        data.canManage && (
          <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
            <Send size={14} aria-hidden /> New offer
          </Button>
        )
      }
    >
      {err && (
        <p role="alert" className="text-sm text-status-declined">
          {err}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-status-approved">
          {notice}
        </p>
      )}
      {current.length === 0 ? (
        <p className="text-sm text-muted">No offer yet. Make one to send this gig to a DJ with an exact payout.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {current.map((o) => {
            const total = o.kind === "recurring" ? (o.payout_cents ?? 0) * o.gig_ids.length : (o.payout_cents ?? 0);
            const share = typeof o.basis?.companyShareCents === "number" ? (o.basis.companyShareCents as number) : null;
            return (
              <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[12px] border border-border p-3" data-offer-status={o.status}>
                <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", STATUS[o.status].tone)}>{STATUS[o.status].label}</span>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">
                    {djName(o.dj_id)} · {o.payout_cents == null ? "Payout not set" : o.kind === "recurring" ? `${dollars(o.payout_cents)} per date × ${o.gig_ids.length} = ${dollars(total)}` : dollars(o.payout_cents)}
                    <span className="text-muted"> · v{o.version}</span>
                  </p>
                  <p className="text-xs text-muted">
                    {o.sourced === "dj" ? "DJ-sourced" : "Company-sourced"}
                    {o.client_price_cents != null && ` · Client ${dollars(o.client_price_cents)}`}
                    {share != null && ` · DCDJs est. ${dollars(share)} before expenses`}
                    {payState(o) && ` · ${payState(o)}`}
                    {o.status === "accepted" && data.offers.some((x) => x.revises_offer_id === o.id && x.status === "offered") && " · Revision waiting for the DJ"}
                  </p>
                </div>
                {data.canManage && (
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setEditing(o)}>
                      {o.status === "draft" ? "Edit / send" : "Revise"}
                    </Button>
                    {(o.status === "draft" || o.status === "offered") && (
                      <Button variant="text" size="sm" onClick={() => withdraw(o)}>
                        Withdraw
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {data.offers.length > current.length && (
        <div>
          <button type="button" onClick={() => setShowHistory((v) => !v)} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground" aria-expanded={showHistory}>
            <History size={13} aria-hidden /> {showHistory ? "Hide" : "Show"} earlier versions ({data.offers.length - current.length})
          </button>
          {showHistory && (
            <ul className="mt-2 flex flex-col gap-1 text-xs text-muted">
              {data.offers
                .filter((o) => !current.includes(o))
                .map((o) => (
                  <li key={o.id}>
                    v{o.version} · {STATUS[o.status].label} · {djName(o.dj_id)} · {o.payout_cents == null ? "no payout" : dollars(o.payout_cents)}
                    {o.kind === "recurring" && " per date"} · {new Date(o.updated_at).toLocaleDateString()}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
      {editing && data.event && (
        <OfferDrawer
          key={editing === "new" ? "new" : editing.id}
          offer={editing === "new" ? null : editing}
          data={data}
          djs={djs}
          onClose={() => setEditing(null)}
          onDone={async (msg) => {
            setEditing(null);
            setNotice(msg);
            await load();
          }}
        />
      )}
    </SectionCard>
  );
}

function OfferDrawer({ offer, data, djs, onClose, onDone }: { offer: OfferRow | null; data: Data; djs: { id: string; label: string }[]; onClose: () => void; onDone: (msg: string) => void }) {
  const ev = data.event!;
  const pkgs = (data.packages ?? []).filter((p) => p.is_active || p.id === (offer?.package_id ?? ev.package_id));
  const basis = (offer?.basis ?? {}) as Record<string, unknown>;
  const [djId, setDjId] = useState(offer?.dj_id ?? ev.dj_id ?? "");
  const [packageId, setPackageId] = useState(offer?.package_id ?? ev.package_id ?? "");
  const pkg = pkgs.find((p) => p.id === packageId) ?? null;
  const [kind, setKind] = useState<"one_time" | "recurring">(offer?.kind ?? ((data.gigs ?? []).length ? "recurring" : "one_time"));
  const [gigIds, setGigIds] = useState<string[]>(offer?.gig_ids ?? []);
  const [sourced, setSourced] = useState<"company" | "dj">(offer?.sourced ?? "company");
  const [clientPrice, setClientPrice] = useState(offer ? cents(offer.client_price_cents) : String(ev.final_amount ?? ev.quoted_amount ?? pkg?.price ?? ""));
  const [eligible, setEligible] = useState(offer ? cents(offer.eligible_cents) : cents(pkg?.eligible_service_cents));
  const [discount, setDiscount] = useState(cents(basis.discountCents as number | null));
  const [includedExtras, setIncludedExtras] = useState(cents(basis.includedExtrasCents as number | null));
  const [flatAdd, setFlatAdd] = useState(cents(basis.flatAddCents as number | null));
  const [thirdParty, setThirdParty] = useState(offer ? cents(offer.third_party_fee_cents) : cents(pkg?.third_party_fee_cents));
  const [override, setOverride] = useState(offer?.payout_cents != null && basis.overridden ? cents(offer.payout_cents) : "");
  const scope0 = offer?.scope ?? {};
  const [arrival, setArrival] = useState(scope0.arrival ?? "");
  const [start, setStart] = useState(scope0.start ?? chicagoTime(ev.starts_at));
  const [end, setEnd] = useState(scope0.end ?? chicagoTime(ev.ends_at));
  const [equipment, setEquipment] = useState(scope0.equipment ?? "");
  const [extras, setExtras] = useState<OfferExtra[]>(scope0.extras ?? []);
  const [notes, setNotes] = useState(scope0.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Picking a package fills in its defaults (only for a new offer, so a revision keeps what was agreed).
  function pickPackage(id: string) {
    setPackageId(id);
    const p = pkgs.find((x) => x.id === id);
    if (!p || offer) return;
    if (!ev.final_amount && !ev.quoted_amount) setClientPrice(String(p.price));
    setEligible(cents(p.eligible_service_cents));
    setThirdParty(cents(p.third_party_fee_cents));
  }

  const rule: PayoutRule = pkg ? { type: pkg.payout_type, percent: Number(pkg.payout_percent), flatCents: pkg.payout_flat_cents } : { type: "percent", percent: STANDARD_PERCENT, flatCents: null };
  const suggestion = useMemo(
    () =>
      computePayout({
        rule,
        clientPriceCents: parseDollars(clientPrice) ?? 0,
        eligibleCents: parseDollars(eligible),
        discountCents: parseDollars(discount) ?? 0,
        sourced,
        includedExtrasCents: parseDollars(includedExtras) ?? 0,
        flatAddCents: (parseDollars(flatAdd) ?? 0) + extras.reduce((s, e) => s + e.payoutCents, 0),
        thirdPartyFeeCents: parseDollars(thirdParty) ?? 0
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pkg?.id, clientPrice, eligible, discount, sourced, includedExtras, flatAdd, extras, thirdParty]
  );
  const payoutCents = override !== "" ? parseDollars(override) : rule.type === "flat" && rule.flatCents == null && !flatAdd ? null : suggestion.payoutCents;
  const dates = (data.gigs ?? []).filter((g) => !g.dj_id || g.dj_id === djId || gigIds.includes(g.id));
  const perDateCount = kind === "recurring" ? gigIds.length : 1;
  const shareCents = (parseDollars(clientPrice) ?? 0) * (kind === "recurring" ? perDateCount : 1) - (parseDollars(discount) ?? 0) - (payoutCents ?? 0) * perDateCount - (parseDollars(thirdParty) ?? 0);

  async function save(send: boolean) {
    setErr(null);
    setSaving(true);
    const body = {
      send,
      djId: djId || null,
      packageId: packageId || null,
      kind,
      gigIds: kind === "recurring" ? gigIds : [],
      sourced,
      payoutCents,
      clientPriceCents: parseDollars(clientPrice),
      eligibleCents: parseDollars(eligible),
      thirdPartyFeeCents: parseDollars(thirdParty),
      discountCents: parseDollars(discount),
      includedExtrasCents: parseDollars(includedExtras),
      flatAddCents: parseDollars(flatAdd),
      rule,
      suggestedCents: suggestion.payoutCents,
      overridden: override !== "",
      companyShareCents: shareCents,
      scope: { arrival: arrival || null, start: start || null, end: end || null, equipment, extras, notes }
    };
    try {
      const r = await fetch(offer ? `/api/admin/offers/${offer.id}` : `/api/admin/events/${ev.id}/offers`, { method: offer ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Couldn't save");
      onDone(j.revised ? "Revised offer sent. The DJ accepts it again; the earlier version is kept in the history." : send ? "Offer sent. The DJ sees it under Offers in their portal." : offer && offer.status !== "draft" ? "Saved. Nothing the DJ agreed to changed, so no new acceptance is needed." : "Draft saved.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  const sent = offer && offer.status !== "draft";
  return (
    <SideDrawer open onClose={onClose} title={!offer ? "New DJ offer" : sent ? `Revise offer (v${offer.version})` : "Edit draft offer"} subtitle={sent ? "Changing the payout, dates or scope sends a revised offer for the DJ to accept. Until then the accepted version stands." : undefined}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save(true);
        }}
      >
        <FieldRow>
          <FieldGroup label="DJ" htmlFor="offer-dj">
            <select id="offer-dj" value={djId} onChange={(e) => setDjId(e.target.value)} className={INPUT}>
              <option value="">Pick a DJ</option>
              {djs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </FieldGroup>
          <FieldGroup label="Package" htmlFor="offer-pkg">
            <select id="offer-pkg" value={packageId} onChange={(e) => pickPackage(e.target.value)} className={INPUT}>
              <option value="">No package (standard {STANDARD_PERCENT}%)</option>
              {pkgs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </FieldGroup>
        </FieldRow>
        {pkg && (
          <p className="-mt-2 text-xs text-muted">
            Payout rule: {pkg.payout_type === "flat" ? `${dollars(pkg.payout_flat_cents)} flat` : `${pkg.payout_percent}% of ${pkg.eligible_service_cents != null ? dollars(pkg.eligible_service_cents) : "the DJ service amount"}`}
            {(pkg.quote_before_payment || pkg.pricing_type !== "fixed") && " · Quoted package: confirm the client price before sending"}
          </p>
        )}

        {(data.gigs ?? []).length > 0 && (
          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Type</legend>
            <div className="flex gap-2">
              {(["recurring", "one_time"] as const).map((k) => (
                <label key={k} className={cn("flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm", kind === k ? "border-gold bg-gold/10" : "border-border")}>
                  <input type="radio" name="offer-kind" checked={kind === k} onChange={() => setKind(k)} className="accent-[var(--gold)]" />
                  {k === "recurring" ? "Residency dates (paid per date)" : "One-time gig"}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {kind === "recurring" && (
          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Dates this offer covers</legend>
            <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
              {dates.map((g) => {
                const on = gigIds.includes(g.id);
                return (
                  <label key={g.id} className={cn("flex cursor-pointer items-center gap-1.5 rounded-[8px] border px-2 py-1 text-xs", on ? "border-gold bg-gold/10" : "border-border")}>
                    <input type="checkbox" checked={on} onChange={() => setGigIds((ids) => (on ? ids.filter((x) => x !== g.id) : [...ids, g.id]))} className="accent-[var(--gold)]" />
                    {new Date(`${g.gig_date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                  </label>
                );
              })}
              {dates.length === 0 && <p className="text-xs text-muted">No open upcoming dates.</p>}
            </div>
          </fieldset>
        )}

        <fieldset className="flex flex-col gap-3 rounded-[12px] border border-gold/40 p-4">
          <legend className="px-1 text-sm font-semibold">Payout (admins only)</legend>
          <FieldGroup label="Booking source" htmlFor="offer-source">
            <select id="offer-source" value={sourced} onChange={(e) => setSourced(e.target.value as "company" | "dj")} className={INPUT}>
              <option value="company">Company-sourced (package rule, standard {STANDARD_PERCENT}%)</option>
              <option value="dj">DJ-sourced: DJ brought the client and gear ({DJ_SOURCED_PERCENT}% / {100 - DJ_SOURCED_PERCENT}%)</option>
            </select>
          </FieldGroup>
          <FieldRow>
            <FieldGroup label={kind === "recurring" ? "Client / venue rate per date ($)" : "Client price ($)"} htmlFor="offer-client">
              <input id="offer-client" inputMode="decimal" value={clientPrice} onChange={(e) => setClientPrice(e.target.value)} className={INPUT} />
            </FieldGroup>
            <FieldGroup label="Eligible DJ service ($)" htmlFor="offer-eligible" hint="Blank = whole price.">
              <input id="offer-eligible" inputMode="decimal" value={eligible} onChange={(e) => setEligible(e.target.value)} className={INPUT} />
            </FieldGroup>
          </FieldRow>
          <FieldRow>
            <FieldGroup label="Discount on DJ service ($)" htmlFor="offer-discount">
              <input id="offer-discount" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} className={INPUT} />
            </FieldGroup>
            <FieldGroup label="Band fee / third-party ($)" htmlFor="offer-third" hint="Kept outside the payout.">
              <input id="offer-third" inputMode="decimal" value={thirdParty} onChange={(e) => setThirdParty(e.target.value)} className={INPUT} />
            </FieldGroup>
          </FieldRow>
          <FieldRow>
            <FieldGroup label="DJ-delivered extras in the base ($)" htmlFor="offer-incl" hint="Optional: counted in the percentage.">
              <input id="offer-incl" inputMode="decimal" value={includedExtras} onChange={(e) => setIncludedExtras(e.target.value)} className={INPUT} />
            </FieldGroup>
            <FieldGroup label="Flat add for duties / gear ($)" htmlFor="offer-flat">
              <input id="offer-flat" inputMode="decimal" value={flatAdd} onChange={(e) => setFlatAdd(e.target.value)} className={INPUT} />
            </FieldGroup>
          </FieldRow>
          <div className="rounded-[10px] bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] p-3 text-sm" data-testid="offer-suggestion">
            <p>
              Suggested payout: <strong>{rule.type === "flat" && rule.flatCents == null ? "set a flat amount" : dollars(suggestion.payoutCents)}</strong>
              {suggestion.percentApplied != null && <span className="text-muted"> ({suggestion.percentApplied}% of {dollars(suggestion.baseCents)})</span>}
              {kind === "recurring" && <span className="text-muted"> per date</span>}
            </p>
          </div>
          <FieldGroup label={kind === "recurring" ? "DJ payout per date ($)" : "DJ payout ($)"} htmlFor="offer-payout" hint="Leave blank to use the suggestion, or type the exact amount.">
            <input id="offer-payout" inputMode="decimal" value={override} onChange={(e) => setOverride(e.target.value)} placeholder={payoutCents != null ? String(payoutCents / 100) : ""} className={INPUT} />
          </FieldGroup>
          <p className="text-sm" data-testid="offer-share">
            Est. DCDJs share: <strong>{dollars(shareCents)}</strong> <span className="text-xs text-muted">after the DJ payout and known third-party fees, before other expenses. Tips stay separate.</span>
          </p>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-semibold">What the DJ agrees to</legend>
          <FieldRow cols={3}>
            <FieldGroup label="Arrive by" htmlFor="offer-arrival">
              <input id="offer-arrival" type="time" value={arrival} onChange={(e) => setArrival(e.target.value)} className={INPUT} />
            </FieldGroup>
            <FieldGroup label="Play from" htmlFor="offer-start">
              <input id="offer-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} className={INPUT} />
            </FieldGroup>
            <FieldGroup label="Until" htmlFor="offer-end">
              <input id="offer-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={INPUT} />
            </FieldGroup>
          </FieldRow>
          <FieldGroup label="Equipment expectations" htmlFor="offer-equipment">
            <textarea id="offer-equipment" value={equipment} onChange={(e) => setEquipment(e.target.value)} rows={2} placeholder="e.g. Bring your own speakers, subs and a wireless mic" className={INPUT} />
          </FieldGroup>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Paid extras (part of the payout)</p>
            {extras.map((x, i) => (
              <div key={i} className="mb-1.5 flex gap-2">
                <input value={x.label} onChange={(e) => setExtras((all) => all.map((y, k) => (k === i ? { ...y, label: e.target.value } : y)))} aria-label={`Extra ${i + 1}`} placeholder="e.g. Ceremony sound" className={INPUT} />
                <input inputMode="decimal" value={x.payoutCents ? String(x.payoutCents / 100) : ""} onChange={(e) => setExtras((all) => all.map((y, k) => (k === i ? { ...y, payoutCents: parseDollars(e.target.value) ?? 0 } : y)))} aria-label={`Extra ${i + 1} amount`} placeholder="$" className={cn(INPUT, "w-24")} />
                <button type="button" onClick={() => setExtras((all) => all.filter((_, k) => k !== i))} aria-label={`Remove extra ${i + 1}`} className="px-1 text-status-declined">
                  ×
                </button>
              </div>
            ))}
            <Button type="button" variant="secondary" size="sm" onClick={() => setExtras((all) => [...all, { label: "", payoutCents: 0 }])}>
              Add paid extra
            </Button>
          </div>
          <FieldGroup label="Notes for the DJ" htmlFor="offer-notes">
            <textarea id="offer-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={INPUT} />
          </FieldGroup>
        </fieldset>

        {err && (
          <p role="alert" className="text-sm text-status-declined">
            {err}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" type="submit" disabled={saving}>
            {saving ? "Saving…" : sent ? "Send revised offer" : "Send offer"}
          </Button>
          {!sent && (
            <Button variant="secondary" type="button" disabled={saving} onClick={() => save(false)}>
              Save draft
            </Button>
          )}
          {sent && (
            <Button variant="secondary" type="button" disabled={saving} onClick={() => save(false)}>
              Save internal changes only
            </Button>
          )}
        </div>
      </form>
    </SideDrawer>
  );
}

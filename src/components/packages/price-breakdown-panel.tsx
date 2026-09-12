import { cn } from "@/lib/utils";
import type { PriceBreakdown } from "@/lib/packages/types";

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/**
 * Renders one PriceBreakdown from the pricing engine — used identically
 * by the admin template preview and the client package builder, so what
 * an admin sees while designing a package is exactly what a client sees
 * while customizing one.
 */
export function PriceBreakdownPanel({ breakdown, isExample = false }: { breakdown: PriceBreakdown; isExample?: boolean }) {
  return (
    <div className="flex flex-col gap-4 text-sm">
      {isExample && (
        <p className="rounded-[10px] border border-dashed border-gold/40 bg-gold/5 px-3 py-2 text-xs font-medium text-gold">
          Example price — nothing here is live until this template is published.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Row label="Base price" amount={breakdown.baseCents} />
        {breakdown.lines.map((l) => (
          <Row
            key={l.lineItemId}
            label={
              l.chargedQuantity > 1 && !l.requiresQuote
                ? `${l.label} × ${l.chargedQuantity}`
                : l.label
            }
            amount={l.requiresQuote ? null : l.amountCents}
            note={l.note}
          />
        ))}
        {breakdown.overtimeCents > 0 && <Row label="Additional time" amount={breakdown.overtimeCents} note={breakdown.overtimeNote} />}
        {breakdown.adjustments.map((a, i) => (
          <Row key={i} label={a.label} amount={a.amountCents} />
        ))}
        {breakdown.travelCents > 0 && <Row label="Travel" amount={breakdown.travelCents} />}
      </div>

      <div className="border-t border-border pt-2">
        <Row label="Subtotal" amount={breakdown.subtotalCents} bold />
      </div>

      {breakdown.deals.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-border pt-2">
          {breakdown.deals.map((d) => (
            <div key={d.dealId} className="flex items-center justify-between gap-3 text-xs">
              <span className={cn(d.applied ? "text-status-approved" : "text-muted line-through")}>{d.name}</span>
              <span className={cn(d.applied ? "text-status-approved" : "text-muted")}>{d.applied ? `−${money(d.amountCents)}` : d.reason}</span>
            </div>
          ))}
        </div>
      )}

      {breakdown.fees.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-border pt-2">
          {breakdown.fees.map((f, i) => (
            <Row key={i} label={f.label} amount={f.amount_cents} />
          ))}
        </div>
      )}

      {breakdown.taxCents > 0 && (
        <div className="border-t border-border pt-2">
          <Row label="Tax" amount={breakdown.taxCents} />
        </div>
      )}

      <div className="border-t border-border pt-3">
        <Row
          label={breakdown.requiresQuote ? "Estimated total" : "Total"}
          amount={breakdown.totalCents}
          bold
          large
        />
        {breakdown.requiresQuote && <p className="mt-1 text-xs text-muted">Some items are priced on request — final total may change.</p>}
        {breakdown.flooredAtMinimum && <p className="mt-1 text-xs text-muted">Held at this package&rsquo;s minimum price.</p>}
      </div>

      {breakdown.depositCents > 0 && (
        <div className="rounded-[10px] bg-panel px-3 py-2 text-xs text-muted">
          Deposit due to confirm: <span className="font-semibold text-foreground">{money(breakdown.depositCents)}</span> (part of the total above, not an extra charge)
        </div>
      )}
    </div>
  );
}

function Row({ label, amount, note, bold, large }: { label: string; amount: number | null; note?: string | null; bold?: boolean; large?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={cn(bold ? "font-semibold" : "text-muted", large && "text-base")}>
        {label}
        {note && <span className="ml-1.5 text-xs font-normal text-muted">({note})</span>}
      </span>
      <span className={cn("tabular-nums", bold ? "font-semibold" : "text-foreground", large && "text-lg")}>
        {amount === null ? "Priced on request" : money(amount)}
      </span>
    </div>
  );
}

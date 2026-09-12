"use client";

import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PriceBreakdown } from "@/lib/packages/types";

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/**
 * Full invoice-style rendering of a PriceBreakdown — the same data the
 * compact sidebar panel shows, laid out as a real itemized invoice so an
 * admin can sanity-check exactly what a client would see as a final
 * bill, not just a running total.
 */
export function InvoicePreviewModal({
  breakdown,
  templateName,
  isExample,
  onClose
}: {
  breakdown: PriceBreakdown;
  templateName: string;
  isExample: boolean;
  onClose: () => void;
}) {
  const today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <p className="text-sm font-semibold">Invoice Preview</p>
            {isExample && <p className="text-xs text-gold">Example only — not a real invoice, no live prices.</p>}
          </div>
          <button onClick={onClose} className="rounded-[10px] p-1.5 text-muted hover:bg-black/5 hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-8 py-8">
          <div className="flex items-start justify-between border-b border-border pb-6">
            <div>
              <p className="font-display text-2xl font-light">Digital Crate DJs</p>
              <p className="mt-1 text-xs text-muted">Wisconsin&rsquo;s Premier DJ Collective</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold uppercase tracking-wide text-muted">Invoice Preview</p>
              <p className="text-xs text-muted">{today}</p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Package</p>
              <p className="text-base font-semibold">{templateName}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-muted">Bill to</p>
              <p className="text-sm text-muted">Sample Client</p>
            </div>
          </div>

          <table className="mt-6 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2 font-medium">Description</th>
                <th className="py-2 text-right font-medium">Qty</th>
                <th className="py-2 text-right font-medium">Rate</th>
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/60">
                <td className="py-2.5">Base package</td>
                <td className="py-2.5 text-right tabular-nums">1</td>
                <td className="py-2.5 text-right tabular-nums">{money(breakdown.baseCents)}</td>
                <td className="py-2.5 text-right tabular-nums">{money(breakdown.baseCents)}</td>
              </tr>
              {breakdown.lines.map((l) => (
                <tr key={l.lineItemId} className="border-b border-border/60">
                  <td className="py-2.5">
                    {l.label}
                    {l.note && <span className="ml-1.5 text-xs text-muted">({l.note})</span>}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{l.chargedQuantity || (l.requiresQuote ? "—" : 1)}</td>
                  <td className="py-2.5 text-right tabular-nums">{l.requiresQuote ? "Quote" : money(l.unitPriceCents)}</td>
                  <td className="py-2.5 text-right tabular-nums">{l.requiresQuote ? "Quote" : money(l.amountCents)}</td>
                </tr>
              ))}
              {breakdown.overtimeCents > 0 && (
                <tr className="border-b border-border/60">
                  <td className="py-2.5">Additional time{breakdown.overtimeNote ? ` (${breakdown.overtimeNote})` : ""}</td>
                  <td className="py-2.5 text-right">—</td>
                  <td className="py-2.5 text-right">—</td>
                  <td className="py-2.5 text-right tabular-nums">{money(breakdown.overtimeCents)}</td>
                </tr>
              )}
              {breakdown.adjustments.map((a, i) => (
                <tr key={i} className="border-b border-border/60">
                  <td className="py-2.5">{a.label}</td>
                  <td className="py-2.5 text-right">—</td>
                  <td className="py-2.5 text-right">—</td>
                  <td className="py-2.5 text-right tabular-nums">{money(a.amountCents)}</td>
                </tr>
              ))}
              {breakdown.travelCents > 0 && (
                <tr className="border-b border-border/60">
                  <td className="py-2.5">Travel</td>
                  <td className="py-2.5 text-right">—</td>
                  <td className="py-2.5 text-right">—</td>
                  <td className="py-2.5 text-right tabular-nums">{money(breakdown.travelCents)}</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="ml-auto mt-4 flex w-full max-w-xs flex-col gap-1.5 text-sm">
            <Line label="Subtotal" amount={breakdown.subtotalCents} />
            {breakdown.deals.filter((d) => d.applied).map((d) => (
              <Line key={d.dealId} label={d.name} amount={-d.amountCents} muted />
            ))}
            {breakdown.feeCents > 0 && <Line label="Fees" amount={breakdown.feeCents} />}
            {breakdown.taxCents > 0 && <Line label="Tax" amount={breakdown.taxCents} />}
            <div className="border-t border-border pt-1.5">
              <Line label={breakdown.requiresQuote ? "Estimated total" : "Total"} amount={breakdown.totalCents} bold />
            </div>
            {breakdown.depositCents > 0 && <Line label="Deposit due" amount={breakdown.depositCents} muted />}
          </div>

          {breakdown.requiresQuote && <p className="mt-4 text-xs text-muted">Some items are priced on request — final total may change once confirmed.</p>}
        </div>

        <div className="flex justify-end border-t border-border px-6 py-4">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Line({ label, amount, bold, muted }: { label: string; amount: number; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "font-semibold" : muted ? "text-muted" : ""}>{label}</span>
      <span className={bold ? "text-base font-semibold tabular-nums" : muted ? "tabular-nums text-muted" : "tabular-nums"}>
        {amount < 0 ? `−${money(-amount)}` : money(amount)}
      </span>
    </div>
  );
}

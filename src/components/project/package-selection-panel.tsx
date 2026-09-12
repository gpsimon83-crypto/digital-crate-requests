"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { PriceBreakdownPanel } from "@/components/packages/price-breakdown-panel";
import { isStaffRole } from "@/lib/roles";
import type { EventPackageSelectionRow } from "@/lib/data/package-builder";

/**
 * Staff-facing: shows the client's current package selection (if any)
 * and the explicit "Approve & Send for Payment" action — the only thing
 * that ever copies a computed total into events.quoted_amount/deposit_amount,
 * unlocking the existing Payment tab. Never automatic.
 */
export function PackageSelectionPanel({ eventId }: { eventId: string }) {
  const [selection, setSelection] = useState<EventPackageSelectionRow | null | undefined>(undefined);
  const [canApprove, setCanApprove] = useState(false);
  const [approving, setApproving] = useState(false);
  const [recommending, setRecommending] = useState(false);
  const [equipmentNotice, setEquipmentNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch(`/api/admin/events/${eventId}/package-selection`)
      .then((r) => r.json())
      .then((data) => setSelection(data.selection ?? null))
      .catch(() => setSelection(null));
  }

  useEffect(load, [eventId]);
  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => setCanApprove(isStaffRole(data.user?.role)))
      .catch(() => setCanApprove(false));
  }, []);

  async function recommendEquipment() {
    if (!selection?.package_template_id) return;
    setRecommending(true);
    setEquipmentNotice(null);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/package/equipment/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: selection.package_template_id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to run the equipment calculator");
      const matchedCount = data.matched?.length ?? 0;
      const unmatchedCount = data.unmatched?.length ?? 0;
      setEquipmentNotice(
        matchedCount === 0 && unmatchedCount === 0
          ? "No equipment rules matched this gig's details."
          : `Set ${matchedCount} locked minimum${matchedCount === 1 ? "" : "s"} for this gig.` +
              (unmatchedCount > 0 ? ` ${unmatchedCount} recommendation${unmatchedCount === 1 ? "" : "s"} aren't in this package yet — an admin can add them to the Services tab.` : "")
      );
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setRecommending(false);
    }
  }

  async function approve() {
    setApproving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/package-selection/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to approve");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setApproving(false);
    }
  }

  if (selection === undefined) return null;
  if (selection === null) {
    return (
      <GlassCard className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[1.5px] text-muted">Package Builder</p>
        <p className="text-sm text-muted">This client hasn&rsquo;t built a package yet.</p>
        <Link href={`/portal/events/${eventId}/package`} className="w-fit text-xs font-medium text-gold hover:underline">
          Open the package builder for this event →
        </Link>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[1.5px] text-muted">Client&rsquo;s Package Selection</p>
        <StatusChip
          tone={selection.status === "confirmed" ? "approved" : selection.status === "requested" ? "pending" : "muted"}
          variant="dot"
        >
          {selection.status}
        </StatusChip>
      </div>

      <PriceBreakdownPanel breakdown={selection.price_snapshot} />

      {error && <p className="text-xs text-status-declined">{error}</p>}
      {equipmentNotice && <p className="text-xs text-status-approved">{equipmentNotice}</p>}

      {selection.package_template_id && (
        <Button variant="secondary" size="sm" onClick={recommendEquipment} disabled={recommending} className="w-fit">
          {recommending ? "Calculating…" : "Recommend Equipment"}
        </Button>
      )}

      {selection.status === "confirmed" ? (
        <p className="text-xs text-status-approved">Approved — this total is now on the event and the client can pay through the Payment tab.</p>
      ) : canApprove ? (
        <>
          <Button variant="primary" size="sm" onClick={approve} disabled={approving} className="w-fit">
            {approving ? "Approving…" : "Approve & Send for Payment"}
          </Button>
          <p className="text-xs text-muted">Approving copies this total into the event&rsquo;s quoted amount and deposit — review it first.</p>
        </>
      ) : (
        <p className="text-xs text-muted">Waiting on staff to review and approve this before it becomes payable.</p>
      )}
    </GlassCard>
  );
}

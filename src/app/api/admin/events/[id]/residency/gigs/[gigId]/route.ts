import { NextRequest, NextResponse } from "next/server";
import { requireStaffUser } from "@/lib/comm/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { financeAccess, listGigs, loadResidency, notifyDj } from "@/lib/data/residency";
import { fmtGigDate, gigsForFutureDj, isDate, isTime, planScheduleChange, todayIn, validateSchedule } from "@/lib/residency";
import { centsFrom, text } from "@/lib/residency-input";
import { PAYMENT_METHODS } from "@/lib/payment-methods";
import { logActivity } from "@/lib/activity";
import { errorMessage } from "@/lib/error-message";

type Body = {
  action?: string;
  scope?: "one" | "future";
  djId?: string | null;
  date?: string;
  start?: string;
  end?: string;
  notes?: string | null;
  reason?: string;
  venueFee?: unknown;
  djPayout?: unknown;
  amount?: unknown;
  method?: string;
  paidOn?: string;
  status?: "paid" | "pending";
};

const MONEY_ACTIONS = new Set(["set_money", "venue_paid", "payout"]);

/**
 * Staff: change one gig, or this and future gigs.
 * Actions: assign, confirm, edit, cancel, restore, played, delete_date,
 * resolve_issue; with finance access: set_money, venue_paid, payout.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; gigId: string }> }) {
  const staff = await requireStaffUser();
  if (staff instanceof NextResponse) return staff;
  const { id, gigId } = await params;
  const b = (await req.json().catch(() => ({}))) as Body;
  const action = b.action ?? "";
  if (MONEY_ACTIONS.has(action) && !(await financeAccess()).manage) return NextResponse.json({ error: "You don't have permission to change gig money." }, { status: 403 });

  const db = createAdminClient();
  try {
    const r = await loadResidency(db, id);
    if (!r) return NextResponse.json({ error: "Not a recurring booking" }, { status: 404 });
    const gigs = await listGigs(db, r.id);
    const g = gigs.find((x) => x.id === gigId);
    if (!g) return NextResponse.json({ error: "Gig not found" }, { status: 404 });
    const today = todayIn(r.timezone);
    const now = new Date().toISOString();
    const upd = (patch: Record<string, unknown>, gid = g.id) => db.from("residency_gigs").update({ ...patch, updated_at: now }).eq("id", gid).eq("residency_id", r.id);
    const log = (what: string, meta: Record<string, unknown> = {}) =>
      logActivity({ actorUserId: staff.userId, action: `residency.${what}`, entityType: "event", entityId: id, eventId: id, metadata: { gigId, date: g.gig_date, ...meta } });
    const past = g.gig_date < today;
    const scope = b.scope === "future" ? "future" : "one";

    switch (action) {
      case "assign": {
        const dj = b.djId || null;
        if (past && scope === "one" && g.outcome !== "scheduled") return NextResponse.json({ error: "This gig is already played or canceled." }, { status: 400 });
        if (scope === "future") {
          const targets = gigsForFutureDj(gigs, dj, g.gig_date);
          if (!targets.some((t) => t.id === g.id) && g.dj_id !== dj) targets.push(g);
          for (const t of targets) await upd({ dj_id: dj, coverage: dj ? "awaiting" : "unassigned", dj_responded_at: null }, t.id);
          await db.from("residencies").update({ default_dj_id: dj, updated_at: now }).eq("id", r.id);
          if (dj && targets.length) await notifyDj(db, dj, { title: `${r.name}: ${targets.length} date${targets.length > 1 ? "s" : ""} to confirm`, body: `From ${fmtGigDate(g.gig_date)}. Confirm or decline each in My Bookings.`, eventId: id, gigId: g.id });
          await log("dj_assigned", { scope, djId: dj, count: targets.length });
          return NextResponse.json({ ok: true, count: targets.length });
        }
        // This gig only (a one-night swap): later "this and future" changes leave it alone.
        const { error } = await upd({ dj_id: dj, coverage: dj ? "awaiting" : "unassigned", dj_responded_at: null, detached: true });
        if (error) throw error;
        if (dj && dj !== g.dj_id) await notifyDj(db, dj, { title: `${r.name}: ${fmtGigDate(g.gig_date)}`, body: "You've been asked to cover this date. Confirm or decline in My Bookings.", eventId: id, gigId: g.id });
        await log("dj_assigned", { scope, djId: dj, previous: g.dj_id });
        return NextResponse.json({ ok: true });
      }
      case "confirm": {
        // The DJ confirmed some other way (text, call): staff record it.
        if (!g.dj_id) return NextResponse.json({ error: "Assign a DJ first." }, { status: 400 });
        await upd({ coverage: "confirmed", dj_responded_at: now });
        await log("dj_confirmed", { by: "staff", djId: g.dj_id });
        return NextResponse.json({ ok: true });
      }
      case "edit": {
        const patch: Record<string, unknown> = {};
        if (b.notes !== undefined) patch.notes = text(b.notes, 1000);
        if (b.date !== undefined && b.date !== g.gig_date) {
          if (!isDate(b.date) || b.date < today) return NextResponse.json({ error: "Pick today or a later date." }, { status: 400 });
          if (gigs.some((x) => x.id !== g.id && x.gig_date === b.date && x.outcome !== "canceled")) return NextResponse.json({ error: `There's already a gig on ${fmtGigDate(b.date)}.` }, { status: 409 });
          patch.gig_date = b.date;
          patch.detached = true;
          if (g.coverage === "confirmed") patch.change_note = `Moved from ${fmtGigDate(g.gig_date)}.`;
        }
        const timesSent = b.start !== undefined || b.end !== undefined;
        if (timesSent) {
          const start = b.start ?? g.start_time;
          const end = b.end ?? g.end_time;
          if (!isTime(start) || !isTime(end) || start === end) return NextResponse.json({ error: "Enter the set start and end times." }, { status: 400 });
          if (scope === "future") {
            const s = validateSchedule({ ...r, start_time: start, end_time: end });
            if ("error" in s) return NextResponse.json({ error: s.error }, { status: 400 });
            const plan = planScheduleChange(s.value, gigs, g.gig_date);
            for (const t of plan.retime) await upd({ start_time: t.start_time, end_time: t.end_time, ...(t.change_note ? { change_note: t.change_note } : {}) }, t.id);
            await db.from("residencies").update({ start_time: start, end_time: end, updated_at: now }).eq("id", r.id);
            // this gig too, even if it was edited on its own before
            if (!plan.retime.some((t) => t.id === g.id) && (g.start_time !== start || g.end_time !== end)) Object.assign(patch, { start_time: start, end_time: end });
          } else if (start !== g.start_time || end !== g.end_time) {
            Object.assign(patch, { start_time: start, end_time: end, detached: true });
            if (g.coverage === "confirmed") patch.change_note = `Hours changed for this night only.`;
          }
        }
        if (past && (patch.gig_date || patch.start_time)) return NextResponse.json({ error: "Past gigs keep their date and hours." }, { status: 400 });
        if (Object.keys(patch).length) {
          const { error } = await upd(patch);
          if (error) throw error;
        }
        await log("gig_edited", { scope, fields: Object.keys(patch) });
        return NextResponse.json({ ok: true });
      }
      case "cancel": {
        const reason = text(b.reason, 300);
        if (!reason) return NextResponse.json({ error: "Say why it's canceled." }, { status: 400 });
        if (g.outcome === "played") return NextResponse.json({ error: "This gig was played." }, { status: 400 });
        await upd({ outcome: "canceled", cancel_reason: reason, detached: true });
        if (g.dj_id) await notifyDj(db, g.dj_id, { title: `Canceled: ${r.name} ${fmtGigDate(g.gig_date)}`, body: reason, eventId: id, gigId: g.id });
        await log("gig_canceled", { reason });
        return NextResponse.json({ ok: true });
      }
      case "restore": {
        if (g.outcome !== "canceled") return NextResponse.json({ error: "Not canceled." }, { status: 400 });
        await upd({ outcome: "scheduled", cancel_reason: null });
        await log("gig_restored");
        return NextResponse.json({ ok: true });
      }
      case "played": {
        if (g.gig_date > today) return NextResponse.json({ error: "It hasn't happened yet." }, { status: 400 });
        if (!g.dj_id) return NextResponse.json({ error: "Assign the DJ who played it first." }, { status: 400 });
        await upd({ outcome: "played", ...(g.coverage !== "confirmed" ? { coverage: "confirmed" } : {}) });
        await log("gig_played");
        return NextResponse.json({ ok: true });
      }
      case "delete_date": {
        // Only a future date nobody is on; anything else is canceled so the history stays.
        if (past || g.dj_id || g.outcome !== "scheduled") return NextResponse.json({ error: "Cancel this date instead; it keeps the history." }, { status: 400 });
        if (g.source === "schedule") return NextResponse.json({ error: "Schedule dates are canceled, not deleted, so they don't come back." }, { status: 400 });
        await db.from("residency_gigs").delete().eq("id", g.id).eq("residency_id", r.id);
        await log("gig_deleted");
        return NextResponse.json({ ok: true });
      }
      case "resolve_issue": {
        const { data } = await db.from("residency_recaps").update({ issue_resolved_at: now, issue_resolved_by: staff.userId }).eq("gig_id", g.id).is("issue_resolved_at", null).select("id").maybeSingle();
        if (!data) return NextResponse.json({ error: "No open issue on this gig." }, { status: 400 });
        await log("issue_resolved");
        return NextResponse.json({ ok: true });
      }
      case "set_money": {
        const fee = centsFrom(b.venueFee);
        const pay = centsFrom(b.djPayout);
        if (fee === "bad" || pay === "bad") return NextResponse.json({ error: "Enter amounts in dollars, up to $100,000." }, { status: 400 });
        const patch: Record<string, unknown> = {};
        if (fee !== undefined) patch.venue_fee_cents = fee;
        if (pay !== undefined) patch.dj_payout_cents = pay;
        if (scope === "future") {
          // New standing rates from this gig on: clear per-gig amounts on open future gigs.
          const rp: Record<string, unknown> = { updated_at: now };
          if (fee !== undefined) rp.venue_fee_cents = fee;
          if (pay !== undefined) rp.dj_payout_cents = pay;
          await db.from("residencies").update(rp).eq("id", r.id);
          const clear: Record<string, unknown> = {};
          if (fee !== undefined) clear.venue_fee_cents = null;
          if (pay !== undefined) clear.dj_payout_cents = null;
          const ids = gigs.filter((x) => x.gig_date >= g.gig_date && x.outcome === "scheduled").map((x) => x.id);
          if (ids.length && Object.keys(clear).length) await db.from("residency_gigs").update({ ...clear, updated_at: now }).in("id", ids);
        } else await upd(patch);
        await log("money_set", { scope, ...patch });
        return NextResponse.json({ ok: true });
      }
      case "venue_paid": {
        const due = g.venue_fee_cents ?? r.venue_fee_cents;
        const cents = b.amount === undefined ? due : centsFrom(b.amount);
        if (cents == null || cents === "bad" || cents <= 0) return NextResponse.json({ error: "Enter the amount the venue paid." }, { status: 400 });
        const { data: prior } = await db.from("payments").select("amount_cents").eq("gig_id", g.id).eq("status", "succeeded");
        const paidSoFar = ((prior ?? []) as { amount_cents: number }[]).reduce((n, p) => n + p.amount_cents, 0);
        if (due && paidSoFar >= due) return NextResponse.json({ error: "The venue already paid for this gig." }, { status: 409 });
        const method = b.method && b.method in PAYMENT_METHODS ? b.method : "other";
        const paidOn = isDate(b.paidOn) && b.paidOn <= today ? b.paidOn : today;
        const base = { event_id: id, gig_id: g.id, kind: "gig", amount_cents: cents, status: "succeeded", paid_at: `${paidOn}T18:00:00.000Z` };
        let { error } = await db.from("payments").insert({ ...base, method, recorded_by: staff.userId, note: `${r.name} · ${fmtGigDate(g.gig_date)}` });
        if (error && ["42703", "PGRST204"].includes((error as { code?: string }).code ?? "")) ({ error } = await db.from("payments").insert(base));
        if (error) throw error;
        await log("venue_paid", { amountCents: cents, method });
        return NextResponse.json({ ok: true });
      }
      case "payout": {
        if (!g.dj_id) return NextResponse.json({ error: "No DJ on this gig." }, { status: 400 });
        const amount = centsFrom(b.amount);
        if (amount === "bad") return NextResponse.json({ error: "Enter the payout in dollars." }, { status: 400 });
        const cents = amount ?? g.dj_payout_cents ?? r.dj_payout_cents;
        if (!cents) return NextResponse.json({ error: "Set the DJ payout first." }, { status: 400 });
        const status = b.status === "paid" ? "paid" : "pending";
        const row = { event_id: id, dj_id: g.dj_id, amount_cents: cents, status, paid_at: status === "paid" ? now : null, notes: `${r.name} · ${fmtGigDate(g.gig_date)}`, gig_id: g.id, updated_at: now };
        const { data: existing } = await db.from("payouts").select("id, status").eq("gig_id", g.id).maybeSingle();
        const { error } = existing ? await db.from("payouts").update(row).eq("id", (existing as { id: string }).id) : await db.from("payouts").insert(row);
        if (error) throw error;
        await log("payout_" + status, { amountCents: cents, djId: g.dj_id });
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}


"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { cn } from "@/lib/utils";
import { Wallet, CheckCircle2, Clock, Users, Receipt, TrendingUp, Plus, X, Trash2 } from "lucide-react";

interface EventRow {
  id: string;
  title: string;
  status: string;
  starts_at: string | null;
  quoted_amount: number | null;
  final_amount: number | null;
  paid_cents: number;
  clients: { company_name: string | null; first_name: string | null; last_name: string | null } | null;
}

interface DjOption {
  id: string;
  display_name: string;
}

interface PayoutRow {
  id: string;
  event_id: string;
  dj_id: string;
  amount_cents: number;
  status: "pending" | "paid";
  paid_at: string | null;
  notes: string | null;
  events: { title: string | null; starts_at: string | null } | null;
  djs: { display_name: string } | null;
}

interface ExpenseRow {
  id: string;
  description: string;
  amount_cents: number;
  category: string | null;
  incurred_on: string;
  events: { title: string | null } | null;
}

const CATEGORIES = ["equipment", "marketing", "insurance", "software", "venue", "other"];

function clientName(c: EventRow["clients"]) {
  if (!c) return "No client";
  return c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed client";
}

function money(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const inputClass = "w-full rounded-[2px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none";
const labelClass = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted";

export default function AdminFinancePage() {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [djs, setDjs] = useState<DjOption[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[] | null>(null);
  const [expenses, setExpenses] = useState<ExpenseRow[] | null>(null);

  function load() {
    fetch("/api/admin/events")
      .then((r) => r.json())
      .then((data) => setEvents(data.events ?? []))
      .catch(() => setEvents([]));
    fetch("/api/admin/djs")
      .then((r) => r.json())
      .then((data) => setDjs(data.djs ?? []))
      .catch(() => setDjs([]));
    fetch("/api/admin/payouts")
      .then((r) => r.json())
      .then((data) => setPayouts(data.payouts ?? []))
      .catch(() => setPayouts([]));
    fetch("/api/admin/expenses")
      .then((r) => r.json())
      .then((data) => setExpenses(data.expenses ?? []))
      .catch(() => setExpenses([]));
  }

  useEffect(load, []);

  const billable = useMemo(() => (events ?? []).filter((e) => e.status !== "inquiry" && e.status !== "declined"), [events]);

  const totals = useMemo(() => {
    let quotedCents = 0;
    let paidCents = 0;
    for (const e of billable) {
      quotedCents += Math.round((e.final_amount ?? e.quoted_amount ?? 0) * 100);
      paidCents += e.paid_cents;
    }
    const payoutsDueCents = (payouts ?? []).filter((p) => p.status === "pending").reduce((s, p) => s + p.amount_cents, 0);
    const payoutsPaidCents = (payouts ?? []).filter((p) => p.status === "paid").reduce((s, p) => s + p.amount_cents, 0);
    const expensesCents = (expenses ?? []).reduce((s, e) => s + e.amount_cents, 0);
    return {
      quotedCents,
      paidCents,
      outstandingCents: quotedCents - paidCents,
      payoutsDueCents,
      expensesCents,
      netCents: paidCents - payoutsPaidCents - expensesCents
    };
  }, [billable, payouts, expenses]);

  const outstanding = billable
    .filter((e) => Math.round((e.final_amount ?? e.quoted_amount ?? 0) * 100) - e.paid_cents > 0)
    .sort((a, b) => new Date(a.starts_at ?? 0).getTime() - new Date(b.starts_at ?? 0).getTime());

  const loading = events === null;

  async function handleCreatePayout(input: { eventId: string; djId: string; amountCents: number; notes: string }) {
    const res = await fetch("/api/admin/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
    const data = await res.json();
    if (res.ok) setPayouts((prev) => [data.payout, ...(prev ?? [])]);
    return res.ok;
  }

  async function handleTogglePaid(payout: PayoutRow) {
    const nextStatus = payout.status === "paid" ? "pending" : "paid";
    setPayouts((prev) => (prev ?? []).map((p) => (p.id === payout.id ? { ...p, status: nextStatus } : p)));
    await fetch(`/api/admin/payouts/${payout.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus })
    });
  }

  async function handleDeletePayout(id: string) {
    setPayouts((prev) => (prev ?? []).filter((p) => p.id !== id));
    await fetch(`/api/admin/payouts/${id}`, { method: "DELETE" });
  }

  async function handleCreateExpense(input: { description: string; amountCents: number; category: string; incurredOn: string }) {
    const res = await fetch("/api/admin/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
    const data = await res.json();
    if (res.ok) setExpenses((prev) => [data.expense, ...(prev ?? [])]);
    return res.ok;
  }

  async function handleDeleteExpense(id: string) {
    setExpenses((prev) => (prev ?? []).filter((e) => e.id !== id));
    await fetch(`/api/admin/expenses/${id}`, { method: "DELETE" });
  }

  return (
    <>
      <PageHeader title="Finance" subtitle="Booking value, payments collected, DJ payouts, and what's still outstanding." />
      <div className="flex flex-col gap-8 p-6">
        <div className="flex flex-wrap border border-border">
          <StatTile icon={Wallet} label="Total booked value" value={loading ? "…" : money(totals.quotedCents)} />
          <StatTile icon={CheckCircle2} label="Collected" value={loading ? "…" : money(totals.paidCents)} />
          <StatTile icon={Clock} label="Outstanding" value={loading ? "…" : money(totals.outstandingCents)} tone={totals.outstandingCents > 0 ? "urgent" : "default"} />
          <StatTile icon={Users} label="DJ payouts due" value={payouts === null ? "…" : money(totals.payoutsDueCents)} tone={totals.payoutsDueCents > 0 ? "urgent" : "default"} />
          <StatTile icon={TrendingUp} label="Net revenue" value={payouts === null || expenses === null ? "…" : money(totals.netCents)} />
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold">Outstanding balances</p>
          {loading && <p className="text-sm text-muted">Loading…</p>}
          {!loading && outstanding.length === 0 && (
            <EmptyState icon={CheckCircle2} title="Nothing outstanding" body="Every booked event is paid in full." />
          )}
          {outstanding.length > 0 && (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Contact</th>
                    <th>Date</th>
                    <th>Paid</th>
                    <th>Balance Due</th>
                  </tr>
                </thead>
                <tbody>
                  {outstanding.map((e) => {
                    const total = Math.round((e.final_amount ?? e.quoted_amount ?? 0) * 100);
                    const balance = total - e.paid_cents;
                    return (
                      <tr key={e.id} className="is-linked" onClick={() => (window.location.href = `/admin/events/${e.id}`)}>
                        <td>
                          <Link href={`/admin/events/${e.id}`} className="font-medium hover:text-gold hover:underline">
                            {e.title}
                          </Link>
                        </td>
                        <td className="text-muted">{clientName(e.clients)}</td>
                        <td className="whitespace-nowrap tabular-nums text-muted">
                          {e.starts_at ? new Date(e.starts_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}
                        </td>
                        <td className="tabular-nums text-muted">
                          {money(e.paid_cents)} / {money(total)}
                        </td>
                        <td className="font-semibold tabular-nums">{money(balance)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <PayoutsSection events={events ?? []} djs={djs} payouts={payouts} onCreate={handleCreatePayout} onTogglePaid={handleTogglePaid} onDelete={handleDeletePayout} />

        <ExpensesSection expenses={expenses} onCreate={handleCreateExpense} onDelete={handleDeleteExpense} />
      </div>
    </>
  );
}

function PayoutsSection({
  events,
  djs,
  payouts,
  onCreate,
  onTogglePaid,
  onDelete
}: {
  events: EventRow[];
  djs: DjOption[];
  payouts: PayoutRow[] | null;
  onCreate: (input: { eventId: string; djId: string; amountCents: number; notes: string }) => Promise<boolean>;
  onTogglePaid: (p: PayoutRow) => void;
  onDelete: (id: string) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [eventId, setEventId] = useState("");
  const [djId, setDjId] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!eventId || !djId || !amount) return;
    setSaving(true);
    const ok = await onCreate({ eventId, djId, amountCents: Math.round(Number(amount) * 100), notes });
    setSaving(false);
    if (ok) {
      setEventId("");
      setDjId("");
      setAmount("");
      setNotes("");
      setShowAdd(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">DJ Payouts</p>
        <NeonButton color="gold" onClick={() => setShowAdd((v) => !v)} className="px-3 py-1.5 text-xs">
          {showAdd ? <X size={13} /> : <Plus size={13} />} {showAdd ? "Cancel" : "Add Payout"}
        </NeonButton>
      </div>

      {showAdd && (
        <GlassCard className="mb-4 flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className={labelClass}>Event</span>
              <select value={eventId} onChange={(e) => setEventId(e.target.value)} className={inputClass}>
                <option value="">Select event...</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>DJ</span>
              <select value={djId} onChange={(e) => setDjId(e.target.value)} className={inputClass}>
                <option value="">Select DJ...</option>
                {djs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>Amount ($)</span>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
            </label>
          </div>
          <label className="block">
            <span className={labelClass}>Notes (optional)</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} placeholder="e.g. 60/40 split, includes travel" />
          </label>
          <NeonButton color="gold" onClick={submit} disabled={saving} className="w-fit px-4 py-2 text-xs">
            {saving ? "Saving..." : "Save Payout"}
          </NeonButton>
        </GlassCard>
      )}

      {payouts === null ? (
        <p className="text-sm text-muted">Loading...</p>
      ) : payouts.length === 0 ? (
        <EmptyState icon={Users} title="No payouts yet" body="Add a payout once you've agreed what a DJ is owed for an event." />
      ) : (
        <div className="flex flex-col divide-y divide-border border-y border-border">
          {payouts.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {p.djs?.display_name ?? "DJ"} — {p.events?.title ?? "Event"}
                </p>
                <p className="text-xs text-muted">
                  {p.events?.starts_at ? new Date(p.events.starts_at).toLocaleDateString() : "—"}
                  {p.notes && ` · ${p.notes}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-xs">
                <span className="font-semibold tabular-nums">{money(p.amount_cents)}</span>
                <button
                  onClick={() => onTogglePaid(p)}
                  className={cn("status-badge", p.status === "paid" ? "approved" : "pending")}
                >
                  {p.status === "paid" ? "Paid" : "Mark Paid"}
                </button>
                <button onClick={() => onDelete(p.id)} className="text-status-declined hover:underline">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExpensesSection({
  expenses,
  onCreate,
  onDelete
}: {
  expenses: ExpenseRow[] | null;
  onCreate: (input: { description: string; amountCents: number; category: string; incurredOn: string }) => Promise<boolean>;
  onDelete: (id: string) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [incurredOn, setIncurredOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!description.trim() || !amount) return;
    setSaving(true);
    const ok = await onCreate({ description: description.trim(), amountCents: Math.round(Number(amount) * 100), category, incurredOn });
    setSaving(false);
    if (ok) {
      setDescription("");
      setAmount("");
      setShowAdd(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">Expenses</p>
        <NeonButton color="gold" onClick={() => setShowAdd((v) => !v)} className="px-3 py-1.5 text-xs">
          {showAdd ? <X size={13} /> : <Plus size={13} />} {showAdd ? "Cancel" : "Add Expense"}
        </NeonButton>
      </div>

      {showAdd && (
        <GlassCard className="mb-4 flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Description</span>
              <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} placeholder="e.g. Liability insurance renewal" />
            </label>
            <label className="block">
              <span className={labelClass}>Amount ($)</span>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Category</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>Date</span>
              <input type="date" value={incurredOn} onChange={(e) => setIncurredOn(e.target.value)} className={inputClass} />
            </label>
          </div>
          <NeonButton color="gold" onClick={submit} disabled={saving} className="w-fit px-4 py-2 text-xs">
            {saving ? "Saving..." : "Save Expense"}
          </NeonButton>
        </GlassCard>
      )}

      {expenses === null ? (
        <p className="text-sm text-muted">Loading...</p>
      ) : expenses.length === 0 ? (
        <EmptyState icon={Receipt} title="No expenses logged" body="Track equipment, insurance, software, and other business costs here." />
      ) : (
        <div className="flex flex-col divide-y divide-border border-y border-border">
          {expenses.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{e.description}</p>
                <p className="text-xs capitalize text-muted">
                  {e.category ?? "other"} · {new Date(e.incurred_on).toLocaleDateString()}
                  {e.events?.title && ` · ${e.events.title}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-xs">
                <span className="font-semibold tabular-nums">{money(e.amount_cents)}</span>
                <button onClick={() => onDelete(e.id)} className="text-status-declined hover:underline">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

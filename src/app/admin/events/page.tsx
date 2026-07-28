"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";

interface EventRow {
  id: string;
  event_code: string;
  title: string;
  starts_at: string | null;
  status: string;
  quoted_amount: number | null;
  final_amount: number | null;
  paid_cents: number;
  contract_sent_at: string | null;
  contract_signed_at: string | null;
  contract_signed_by: string | null;
  contract_document_url: string | null;
  djs: { display_name: string } | null;
  venues: { name: string } | null;
  clients: { company_name: string | null; first_name: string | null; last_name: string | null } | null;
}

interface Option {
  id: string;
  label: string;
}

const STATUS_CLASS: Record<string, string> = {
  pending_confirmation: "status-badge pending",
  confirmed: "status-badge approved",
  declined: "status-badge declined",
  live: "status-badge played",
  ended: "status-badge approved",
};

const STATUS_LABEL: Record<string, string> = {
  pending_confirmation: "Awaiting DJ",
  confirmed: "Confirmed",
  declined: "Declined",
  live: "Live",
  ended: "Ended",
};

export default function AdminEventsPage() {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [djs, setDjs] = useState<Option[]>([]);
  const [venues, setVenues] = useState<Option[]>([]);
  const [clients, setClients] = useState<Option[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [contractDraftFor, setContractDraftFor] = useState<string | null>(null);
  const [contractUrlDraft, setContractUrlDraft] = useState("");
  const [sendingContract, setSendingContract] = useState(false);

  const [title, setTitle] = useState("");
  const [djId, setDjId] = useState("");
  const [venueId, setVenueId] = useState("");
  const [clientId, setClientId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [eventType, setEventType] = useState("");
  const [expectedGuests, setExpectedGuests] = useState("");
  const [quotedAmount, setQuotedAmount] = useState("");

  async function loadAll() {
    try {
      const [eventsRes, djsRes, venuesRes, clientsRes] = await Promise.all([
        fetch("/api/admin/events"),
        fetch("/api/admin/djs"),
        fetch("/api/admin/venues"),
        fetch("/api/admin/clients"),
      ]);
      const eventsData = await eventsRes.json();
      const djsData = await djsRes.json();
      const venuesData = await venuesRes.json();
      const clientsData = await clientsRes.json();

      if (!eventsRes.ok) throw new Error(eventsData.error || "Failed to load events");

      setEvents(eventsData.events ?? []);
      setDjs((djsData.djs ?? []).map((d: { id: string; display_name: string }) => ({ id: d.id, label: d.display_name })));
      setVenues((venuesData.venues ?? []).map((v: { id: string; name: string }) => ({ id: v.id, label: v.name })));
      setClients(
        (clientsData.clients ?? []).map((c: { id: string; company_name: string | null; first_name: string | null; last_name: string | null }) => ({
          id: c.id,
          label: c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed client",
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleCreate() {
    if (!title || !startsAt) {
      setError("Title and date/time are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          djId: djId || undefined,
          venueId: venueId || undefined,
          clientId: clientId || undefined,
          startsAt: new Date(startsAt).toISOString(),
          eventType: eventType || undefined,
          expectedGuests: expectedGuests ? Number(expectedGuests) : undefined,
          quotedAmount: quotedAmount ? Number(quotedAmount) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create event");

      setTitle("");
      setDjId("");
      setVenueId("");
      setClientId("");
      setStartsAt("");
      setEventType("");
      setExpectedGuests("");
      setQuotedAmount("");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendContract(eventId: string) {
    if (!contractUrlDraft.trim()) return;
    setSendingContract(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractDocumentUrl: contractUrlDraft.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send contract");
      setContractDraftFor(null);
      setContractUrlDraft("");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSendingContract(false);
    }
  }

  return (
    <>
      <PageHeader title="Events" subtitle="Create events and assign a DJ. The DJ confirms the date from their dashboard." />
      <div className="flex flex-col gap-6 p-6">
        <GlassCard neon className="flex flex-col gap-4">
          <p className="text-sm font-semibold">Create Event</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Event Title" value={title} onChange={setTitle} placeholder="Anderson Wedding" />
            <Field label="Date & Time" value={startsAt} onChange={setStartsAt} type="datetime-local" />
            <SelectField label="Assign DJ" value={djId} onChange={setDjId} options={djs} placeholder="Unassigned" />
            <SelectField label="Venue" value={venueId} onChange={setVenueId} options={venues} placeholder="No venue" />
            <SelectField label="Client" value={clientId} onChange={setClientId} options={clients} placeholder="No client linked" />
            <Field label="Event Type" value={eventType} onChange={setEventType} placeholder="wedding, corporate, club..." />
            <Field label="Expected Guests" value={expectedGuests} onChange={setExpectedGuests} type="number" />
            <Field label="Quoted Amount ($)" value={quotedAmount} onChange={setQuotedAmount} type="number" />
          </div>
          {error && <p className="text-xs text-status-declined">{error}</p>}
          <NeonButton color="gold" onClick={handleCreate} disabled={submitting} className="w-full sm:w-fit">
            {submitting ? "Creating..." : "Create Event"}
          </NeonButton>
          {djs.length === 0 && (
            <p className="text-xs text-muted">
              No DJs found in Supabase yet — add rows to the <code>djs</code> table to populate this dropdown.
            </p>
          )}
        </GlassCard>

        {events === null && <p className="text-sm text-muted">Loading events...</p>}
        {events?.length === 0 && <p className="text-sm text-muted">No events yet.</p>}
        {events && events.length > 0 && (
          <div className="flex flex-col divide-y divide-border border-y border-border">
            {events.map((e) => (
              <div
                key={e.id}
                className="flex flex-col gap-2 px-1 py-3 transition-colors hover:bg-gold/[0.04] sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold">{e.title}</p>
                  <p className="text-xs text-muted">
                    {e.event_code} &middot; {e.djs?.display_name ?? "Unassigned"} &middot; {e.venues?.name ?? "No venue"}
                  </p>
                  <p className="text-xs text-muted">
                    {e.starts_at ? new Date(e.starts_at).toLocaleString() : "No date set"}
                  </p>
                  {(e.clients || e.quoted_amount) && (
                    <p className="text-xs text-muted">
                      {e.clients && (e.clients.company_name || [e.clients.first_name, e.clients.last_name].filter(Boolean).join(" "))}
                      {e.clients && e.quoted_amount ? " · " : ""}
                      {e.quoted_amount ? `Quoted $${e.quoted_amount}` : ""}
                    </p>
                  )}
                  {(() => {
                    const totalDue = e.final_amount ?? e.quoted_amount;
                    if (!totalDue) return null;
                    const totalDueCents = Math.round(totalDue * 100);
                    const paid = e.paid_cents;
                    return (
                      <p className={`text-xs ${paid >= totalDueCents ? "text-status-approved" : paid > 0 ? "text-status-pending" : "text-muted"}`}>
                        {paid >= totalDueCents ? "Paid in full" : `$${(paid / 100).toFixed(2)} of $${totalDue.toFixed(2)} paid`}
                      </p>
                    );
                  })()}
                  <p className={`text-xs ${e.contract_signed_at ? "text-status-approved" : e.contract_sent_at ? "text-status-pending" : "text-muted"}`}>
                    {e.contract_signed_at
                      ? `Contract signed by ${e.contract_signed_by} on ${new Date(e.contract_signed_at).toLocaleDateString()}`
                      : e.contract_sent_at
                        ? "Contract sent — awaiting signature"
                        : "Contract not sent"}
                  </p>
                  {contractDraftFor === e.id && (
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <input
                        value={contractUrlDraft}
                        onChange={(ev) => setContractUrlDraft(ev.target.value)}
                        placeholder="Link to the contract document"
                        className="flex-1 rounded-[2px] border border-black/10 bg-panel px-3 py-2 text-xs focus:border-gold focus:outline-none"
                      />
                      <button
                        onClick={() => handleSendContract(e.id)}
                        disabled={sendingContract}
                        className="rounded-[2px] bg-gold px-3 py-2 text-xs font-semibold text-black disabled:opacity-50"
                      >
                        {sendingContract ? "Sending..." : "Send"}
                      </button>
                      <button
                        onClick={() => setContractDraftFor(null)}
                        className="rounded-[2px] border border-black/15 px-3 py-2 text-xs text-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={STATUS_CLASS[e.status] ?? "status-badge pending"}>
                    {STATUS_LABEL[e.status] ?? e.status}
                  </span>
                  {contractDraftFor !== e.id && !e.contract_signed_at && (
                    <button
                      onClick={() => {
                        setContractDraftFor(e.id);
                        setContractUrlDraft(e.contract_document_url ?? "");
                      }}
                      className="text-xs text-gold hover:underline"
                    >
                      {e.contract_sent_at ? "Update contract" : "Send contract"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[2px] border border-black/10 bg-panel px-4 py-2.5 text-sm placeholder:text-muted/60 focus:border-gold focus:outline-none"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[2px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

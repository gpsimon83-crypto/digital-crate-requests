"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { Plus, X, Briefcase, ChevronRight } from "lucide-react";

interface EventRow {
  id: string;
  event_code: string;
  title: string;
  starts_at: string | null;
  status: string;
  event_type: string | null;
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

const STATUS_DOT: Record<string, string> = {
  inquiry: "muted",
  pending_confirmation: "pending",
  confirmed: "approved",
  declined: "declined",
  live: "played",
  ended: "approved"
};

const STATUS_LABEL: Record<string, string> = {
  inquiry: "Inquiry",
  pending_confirmation: "Awaiting DJ",
  confirmed: "Confirmed",
  declined: "Declined",
  live: "Live",
  ended: "Ended"
};

function clientName(c: EventRow["clients"]) {
  if (!c) return null;
  return c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed contact";
}

export default function AdminEventsPage() {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [djs, setDjs] = useState<Option[]>([]);
  const [venues, setVenues] = useState<Option[]>([]);
  const [clients, setClients] = useState<Option[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

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
        fetch("/api/admin/clients")
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
          label: c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed client"
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
          quotedAmount: quotedAmount ? Number(quotedAmount) : undefined
        })
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
      setShowCreate(false);
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
        body: JSON.stringify({ contractDocumentUrl: contractUrlDraft.trim() })
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
      <PageHeader
        title="Projects"
        subtitle="Every event, from first inquiry to final payment."
        action={
          <Button variant="primary" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? <X size={15} /> : <Plus size={15} />}
            {showCreate ? "Cancel" : "New Project"}
          </Button>
        }
      />
      <div className="flex flex-col gap-4 p-6">
        {showCreate && (
          <div className="border border-border p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Event Title" value={title} onChange={setTitle} placeholder="Anderson Wedding" />
              <Field label="Date & Time" value={startsAt} onChange={setStartsAt} type="datetime-local" />
              <SelectField label="Assign DJ" value={djId} onChange={setDjId} options={djs} placeholder="Unassigned" />
              <SelectField label="Venue" value={venueId} onChange={setVenueId} options={venues} placeholder="No venue" />
              <SelectField label="Client" value={clientId} onChange={setClientId} options={clients} placeholder="No client linked" />
              <Field label="Event Type" value={eventType} onChange={setEventType} placeholder="wedding, corporate, club..." />
              <Field label="Expected Guests" value={expectedGuests} onChange={setExpectedGuests} type="number" />
              <Field label="Quoted Amount ($)" value={quotedAmount} onChange={setQuotedAmount} type="number" />
            </div>
            {error && <p className="mt-3 text-xs text-status-declined">{error}</p>}
            <div className="mt-4 flex items-center gap-3">
              <Button variant="primary" onClick={handleCreate} disabled={submitting}>
                {submitting ? "Creating…" : "Create Project"}
              </Button>
              {djs.length === 0 && (
                <p className="text-xs text-muted">No DJs yet — add rows to the <code>djs</code> table.</p>
              )}
            </div>
          </div>
        )}

        {events === null && <p className="text-sm text-muted">Loading projects…</p>}
        {events?.length === 0 && <EmptyState icon={Briefcase} title="No projects yet" body="Create your first project to get started." />}
        {events && events.length > 0 && (
          <>
            {/* Desktop/tablet: full compact table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Project</th>
                    <th>Venue</th>
                    <th>DJ</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Payment</th>
                    <th>Contract</th>
                    <th className="sr-only">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => {
                    const totalDue = e.final_amount ?? e.quoted_amount;
                    const totalDueCents = totalDue ? Math.round(totalDue * 100) : 0;
                    const name = clientName(e.clients);
                    return (
                      <Fragment key={e.id}>
                        <tr>
                          <td className="whitespace-nowrap tabular-nums text-muted">
                            {e.starts_at ? new Date(e.starts_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "TBD"}
                          </td>
                          <td>
                            <Link href={`/admin/events/${e.id}`} className="font-medium hover:text-gold hover:underline">
                              {e.title}
                            </Link>
                            {name && <div className="text-xs text-muted">{name}</div>}
                          </td>
                          <td className="text-muted">{e.venues?.name ?? "—"}</td>
                          <td className={e.djs ? "" : "text-status-urgent"}>{e.djs?.display_name ?? "Unassigned"}</td>
                          <td className="capitalize text-muted">{e.event_type ?? "—"}</td>
                          <td>
                            <span className={cn("status-dot", STATUS_DOT[e.status] ?? "")}>{STATUS_LABEL[e.status] ?? e.status}</span>
                          </td>
                          <td className="whitespace-nowrap">
                            {totalDue ? (
                              <span className={e.paid_cents >= totalDueCents ? "text-status-approved" : e.paid_cents > 0 ? "text-status-pending" : "text-muted"}>
                                {e.paid_cents >= totalDueCents ? "Paid" : `$${(e.paid_cents / 100).toFixed(0)}/$${totalDue.toFixed(0)}`}
                              </span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap">
                            {e.contract_signed_at ? (
                              <span className="text-status-approved">Signed</span>
                            ) : e.contract_sent_at ? (
                              <span className="text-status-pending">Sent</span>
                            ) : (
                              <button onClick={() => { setContractDraftFor(e.id); setContractUrlDraft(""); }} className="text-gold hover:underline">
                                Send
                              </button>
                            )}
                          </td>
                          <td>
                            <Link href={`/admin/events/${e.id}`} className="flex items-center justify-center text-muted hover:text-gold">
                              <ChevronRight size={15} />
                            </Link>
                          </td>
                        </tr>
                        {contractDraftFor === e.id && (
                          <tr>
                            <td colSpan={9} className="bg-panel/60">
                              <div className="flex flex-col gap-2 py-1 sm:flex-row sm:items-center">
                                <input
                                  autoFocus
                                  value={contractUrlDraft}
                                  onChange={(ev) => setContractUrlDraft(ev.target.value)}
                                  placeholder="Link to the contract document"
                                  className="flex-1 rounded-[2px] border border-black/10 bg-card px-3 py-2 text-xs focus:border-gold focus:outline-none"
                                />
                                <div className="flex gap-2">
                                  <Button variant="primary" size="sm" onClick={() => handleSendContract(e.id)} disabled={sendingContract}>
                                    {sendingContract ? "Sending…" : "Send"}
                                  </Button>
                                  <Button variant="secondary" size="sm" onClick={() => setContractDraftFor(null)}>
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile: structured compact rows instead of a squeezed table */}
            <div className="flex flex-col divide-y divide-border border-y border-border md:hidden">
              {events.map((e) => {
                const totalDue = e.final_amount ?? e.quoted_amount;
                const totalDueCents = totalDue ? Math.round(totalDue * 100) : 0;
                const name = clientName(e.clients);
                return (
                  <div key={e.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
                    <Link href={`/admin/events/${e.id}`} className="flex items-center justify-between gap-2">
                      <span className="font-medium">{e.title}</span>
                      <ChevronRight size={15} className="shrink-0 text-muted" />
                    </Link>
                    {name && <span className="text-xs text-muted">{name}</span>}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span className="tabular-nums text-muted">
                        {e.starts_at ? new Date(e.starts_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "TBD"}
                      </span>
                      <span className={cn("status-dot", STATUS_DOT[e.status] ?? "")}>{STATUS_LABEL[e.status] ?? e.status}</span>
                      <span className={e.djs ? "text-muted" : "text-status-urgent"}>{e.djs?.display_name ?? "Unassigned"}</span>
                      {totalDue && (
                        <span className={e.paid_cents >= totalDueCents ? "text-status-approved" : "text-muted"}>
                          {e.paid_cents >= totalDueCents ? "Paid" : `$${(e.paid_cents / 100).toFixed(0)}/$${totalDue.toFixed(0)}`}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
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
  type = "text"
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
        className="w-full rounded-[2px] border border-black/10 bg-panel px-3 py-2 text-sm placeholder:text-muted/60 focus:border-gold focus:outline-none"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder
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
        className="w-full rounded-[2px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
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

"use client";

import { Fragment, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { StatusChip, type StatusTone } from "@/components/ui/status-chip";
import { EVENT_TYPES, EVENT_CATEGORY_GROUPS } from "@/lib/event-types";
import { PIPELINE_STAGES, PIPELINE_STAGE_DOT } from "@/lib/pipeline-stage";
import { clientName } from "@/lib/format";
import { Field } from "@/components/ui/field";
import { Plus, X, Briefcase, ChevronRight, Magnet, Mail, Phone, CalendarDays } from "lucide-react";

interface EventRow {
  id: string;
  event_code: string;
  title: string;
  starts_at: string | null;
  status: string;
  pipeline_stage: string | null;
  event_type: string | null;
  special_requests: string | null;
  quoted_amount: number | null;
  final_amount: number | null;
  paid_cents: number;
  contract_status: "none" | "draft" | "sent" | "signed" | "void";
  djs: { display_name: string } | null;
  venues: { name: string } | null;
  clients: { company_name: string | null; first_name: string | null; last_name: string | null; email: string | null; phone: string | null } | null;
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

const STAGE_TABS = [
  { key: "active", label: "Active Projects" },
  { key: "inquiries", label: "Inquiries" }
];

function AdminEventsPageContent() {
  const searchParams = useSearchParams();
  const stage = searchParams.get("stage") === "inquiries" ? "inquiries" : "active";
  const category = searchParams.get("category") ?? "all";

  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [djs, setDjs] = useState<Option[]>([]);
  const [venues, setVenues] = useState<Option[]>([]);
  const [clients, setClients] = useState<Option[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showCreate, setShowCreate] = useState(() => searchParams.get("new") === "1");

  const [busyId, setBusyId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [djId, setDjId] = useState("");
  const [venueId, setVenueId] = useState("");
  const [clientId, setClientId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [eventType, setEventType] = useState("");
  const [expectedGuests, setExpectedGuests] = useState("");
  const [quotedAmount, setQuotedAmount] = useState("");

  const [showQuickAddClient, setShowQuickAddClient] = useState(false);
  const [qcFirstName, setQcFirstName] = useState("");
  const [qcLastName, setQcLastName] = useState("");
  const [qcEmail, setQcEmail] = useState("");
  const [qcPhone, setQcPhone] = useState("");
  const [savingClient, setSavingClient] = useState(false);

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
    if (!clientId) {
      setError("Select a client to create a project — every project needs a contact.");
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
          clientId,
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

  async function handleQuickAddClient() {
    if (!qcFirstName || !qcLastName) {
      setError("First and last name are required to add a client.");
      return;
    }
    setSavingClient(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: qcFirstName, lastName: qcLastName, email: qcEmail || undefined, phone: qcPhone || undefined })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add client");

      const newOption = { id: data.client.id, label: [qcFirstName, qcLastName].join(" ") };
      setClients((prev) => [...prev, newOption]);
      setClientId(newOption.id);
      setShowQuickAddClient(false);
      setQcFirstName("");
      setQcLastName("");
      setQcEmail("");
      setQcPhone("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSavingClient(false);
    }
  }

  async function handleStageChange(eventId: string, pipelineStage: string) {
    setEvents((prev) => (prev ? prev.map((e) => (e.id === eventId ? { ...e, pipeline_stage: pipelineStage } : e)) : prev));
    try {
      const res = await fetch(`/api/admin/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineStage })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update stage");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      await loadAll();
    }
  }

  async function handleInquiryAction(id: string, action: "confirm" | "decline") {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/events/${id}/${action}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action}`);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  const inquiryCount = (events ?? []).filter((e) => e.status === "inquiry").length;
  const stageFiltered = (events ?? []).filter((e) => (stage === "inquiries" ? e.status === "inquiry" : e.status !== "inquiry"));
  const categoryGroup = EVENT_CATEGORY_GROUPS.find((g) => g.key === category);
  const visibleEvents = categoryGroup ? stageFiltered.filter((e) => categoryGroup.match(e.event_type)) : stageFiltered;

  function stageHref(key: string) {
    const params = new URLSearchParams();
    params.set("stage", key);
    if (category !== "all") params.set("category", category);
    return `/admin/events?${params.toString()}`;
  }

  function categoryHref(key: string) {
    const params = new URLSearchParams();
    params.set("stage", stage);
    if (key !== "all") params.set("category", key);
    return `/admin/events?${params.toString()}`;
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
              <div>
                <SelectField label="Client *" value={clientId} onChange={setClientId} options={clients} placeholder="Select a client" />
                <button
                  type="button"
                  onClick={() => setShowQuickAddClient((v) => !v)}
                  className="mt-1.5 text-xs text-gold hover:underline"
                >
                  {showQuickAddClient ? "Cancel new client" : "+ Add new client"}
                </button>
              </div>
              <SelectField
                label="Event Type"
                value={eventType}
                onChange={setEventType}
                options={EVENT_TYPES.map((t) => ({ id: t, label: t }))}
                placeholder="Select type"
              />
              <Field label="Expected Guests" value={expectedGuests} onChange={setExpectedGuests} type="number" />
              <Field label="Quoted Amount ($)" value={quotedAmount} onChange={setQuotedAmount} type="number" />
            </div>

            {showQuickAddClient && (
              <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="First Name" value={qcFirstName} onChange={setQcFirstName} placeholder="Jamie" />
                <Field label="Last Name" value={qcLastName} onChange={setQcLastName} placeholder="Anderson" />
                <Field label="Email" value={qcEmail} onChange={setQcEmail} type="email" placeholder="jamie@email.com" />
                <Field label="Phone" value={qcPhone} onChange={setQcPhone} type="tel" placeholder="(000) 000-0000" />
                <div className="lg:col-span-4">
                  <Button variant="secondary" size="sm" onClick={handleQuickAddClient} disabled={savingClient}>
                    {savingClient ? "Adding…" : "Save Client"}
                  </Button>
                </div>
              </div>
            )}

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

        <div className="flex flex-col gap-3">
          <Tabs
            items={STAGE_TABS.map((t) => ({ key: t.key, label: t.key === "inquiries" && inquiryCount > 0 ? `${t.label} (${inquiryCount})` : t.label }))}
            active={stage}
            hrefFor={stageHref}
          />
          <Tabs
            items={[{ key: "all", label: "All" }, ...EVENT_CATEGORY_GROUPS.map((g) => ({ key: g.key, label: g.label }))]}
            active={category}
            hrefFor={categoryHref}
            className="border-b-0"
          />
        </div>

        {events === null && <p className="text-sm text-muted">Loading projects…</p>}

        {events !== null && stage === "active" && visibleEvents.length === 0 && (
          <EmptyState icon={Briefcase} title="No projects in this view" body="Create a project or adjust the filters above." />
        )}

        {events !== null && stage === "inquiries" && visibleEvents.length === 0 && (
          <EmptyState icon={Magnet} title="No inquiries waiting" body="New booking requests from the website will show up here." />
        )}

        {stage === "inquiries" && visibleEvents.length > 0 && (
          <div className="flex flex-col divide-y divide-border border-y border-border">
            {visibleEvents.map((e) => (
              <div key={e.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{e.title}</p>
                  <p className="text-sm text-muted">{clientName(e.clients, "Unnamed contact") ?? "No client"}</p>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted">
                    {e.starts_at && (
                      <span className="flex items-center gap-1">
                        <CalendarDays size={12} /> {new Date(e.starts_at).toLocaleDateString()}
                      </span>
                    )}
                    {e.clients?.email && (
                      <span className="flex items-center gap-1">
                        <Mail size={12} /> {e.clients.email}
                      </span>
                    )}
                    {e.clients?.phone && (
                      <span className="flex items-center gap-1">
                        <Phone size={12} /> {e.clients.phone}
                      </span>
                    )}
                  </div>
                  {e.special_requests && <p className="mt-1.5 text-sm">{e.special_requests}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="primary" size="sm" disabled={busyId === e.id} onClick={() => handleInquiryAction(e.id, "confirm")}>
                    {busyId === e.id ? "…" : "Confirm"}
                  </Button>
                  <Button variant="destructive" size="sm" disabled={busyId === e.id} onClick={() => handleInquiryAction(e.id, "decline")}>
                    Decline
                  </Button>
                  <Link href={`/admin/events/${e.id}`} className="flex items-center justify-center text-muted hover:text-gold">
                    <ChevronRight size={15} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {stage === "active" && visibleEvents.length > 0 && (
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
                    <th>Stage</th>
                    <th>Payment</th>
                    <th>Contract</th>
                    <th className="sr-only">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleEvents.map((e) => {
                    const totalDue = e.final_amount ?? e.quoted_amount;
                    const totalDueCents = totalDue ? Math.round(totalDue * 100) : 0;
                    const name = clientName(e.clients, "Unnamed contact");
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
                            {name ? (
                              <div className="text-xs text-muted">{name}</div>
                            ) : (
                              <div className="text-xs text-status-urgent">No client linked</div>
                            )}
                          </td>
                          <td className="text-muted">{e.venues?.name ?? "—"}</td>
                          <td className={e.djs ? "" : "text-status-urgent"}>{e.djs?.display_name ?? "Unassigned"}</td>
                          <td className="text-muted">{e.event_type ?? "—"}</td>
                          <td>
                            <StatusChip tone={(STATUS_DOT[e.status] as StatusTone) ?? "muted"} variant="dot">
                              {STATUS_LABEL[e.status] ?? e.status}
                            </StatusChip>
                          </td>
                          <td>
                            <select
                              value={e.pipeline_stage ?? "Inquiry"}
                              onChange={(ev) => handleStageChange(e.id, ev.target.value)}
                              className={cn(
                                "status-dot rounded-[10px] border-0 bg-transparent py-0.5 pl-0 pr-5 text-xs focus:outline-none",
                                PIPELINE_STAGE_DOT[e.pipeline_stage ?? "Inquiry"] ?? ""
                              )}
                            >
                              {PIPELINE_STAGES.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
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
                            {e.contract_status === "signed" ? (
                              <Link href={`/admin/events/${e.id}`} className="text-status-approved hover:underline">
                                Signed
                              </Link>
                            ) : e.contract_status === "sent" ? (
                              <Link href={`/admin/events/${e.id}`} className="text-status-pending hover:underline">
                                Sent
                              </Link>
                            ) : (
                              <Link href={`/admin/events/${e.id}`} className="text-gold hover:underline">
                                Send
                              </Link>
                            )}
                          </td>
                          <td>
                            <Link href={`/admin/events/${e.id}`} className="flex items-center justify-center text-muted hover:text-gold">
                              <ChevronRight size={15} />
                            </Link>
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile: structured compact rows instead of a squeezed table */}
            <div className="flex flex-col divide-y divide-border border-y border-border md:hidden">
              {visibleEvents.map((e) => {
                const totalDue = e.final_amount ?? e.quoted_amount;
                const totalDueCents = totalDue ? Math.round(totalDue * 100) : 0;
                const name = clientName(e.clients, "Unnamed contact");
                return (
                  <div key={e.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
                    <Link href={`/admin/events/${e.id}`} className="flex items-center justify-between gap-2">
                      <span className="font-medium">{e.title}</span>
                      <ChevronRight size={15} className="shrink-0 text-muted" />
                    </Link>
                    {name ? <span className="text-xs text-muted">{name}</span> : <span className="text-xs text-status-urgent">No client linked</span>}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span className="tabular-nums text-muted">
                        {e.starts_at ? new Date(e.starts_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "TBD"}
                      </span>
                      <StatusChip tone={(STATUS_DOT[e.status] as StatusTone) ?? "muted"} variant="dot">
                        {STATUS_LABEL[e.status] ?? e.status}
                      </StatusChip>
                      <StatusChip tone={(PIPELINE_STAGE_DOT[e.pipeline_stage ?? "Inquiry"] as StatusTone) ?? "muted"} variant="dot">
                        {e.pipeline_stage ?? "Inquiry"}
                      </StatusChip>
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

export default function AdminEventsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted">Loading...</div>}>
      <AdminEventsPageContent />
    </Suspense>
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
        className="w-full rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
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

"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { isNeed, matchesNeed, NEED_LABELS, type DashEvent } from "@/lib/dashboard/overview";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { StatusChip, type StatusTone } from "@/components/ui/status-chip";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EVENT_TYPES, EVENT_CATEGORY_GROUPS } from "@/lib/event-types";
import type { EventCategory } from "@/lib/event-category";
import { PIPELINE_STAGES, PIPELINE_STAGE_DOT } from "@/lib/pipeline-stage";
import { clientName } from "@/lib/format";
import { Field } from "@/components/ui/field";
import { Plus, X, Briefcase, Magnet, Mail, Phone, CalendarDays, ExternalLink, Trash2 } from "lucide-react";
import { ActionMenu } from "@/components/ui/action-menu";
import { ConfirmModal } from "@/components/ui/confirm-modal";

interface EventRow {
  id: string;
  event_code: string;
  title: string;
  starts_at: string | null;
  status: string;
  pipeline_stage: string | null;
  event_type: string | null;
  event_category: EventCategory | null;
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const stage = searchParams.get("stage") === "inquiries" ? "inquiries" : "active";
  const category = searchParams.get("category") ?? "all";
  // "Needs" filters from the dashboard's Action hub (?need=dj|contract|balance|music); same rules as the dashboard.
  const needParam = searchParams.get("need");
  const need = isNeed(needParam) ? needParam : null;

  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [djs, setDjs] = useState<Option[]>([]);
  const [venues, setVenues] = useState<Option[]>([]);
  const [clients, setClients] = useState<Option[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showCreate, setShowCreate] = useState(() => searchParams.get("new") === "1");

  const [busyId, setBusyId] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  /** Run one request per project, a few at a time, and report what didn't go through. */
  async function runEach(ids: string[], label: string, call: (id: string) => Promise<Response>) {
    setBulkBusy(label);
    setError(null);
    setNotice(null);
    const failed: { id: string; why: string }[] = [];
    for (let i = 0; i < ids.length; i += 4) {
      await Promise.all(
        ids.slice(i, i + 4).map(async (id) => {
          try {
            const res = await call(id);
            if (!res.ok) failed.push({ id, why: (await res.json().catch(() => ({}))).error ?? `Error ${res.status}` });
          } catch {
            failed.push({ id, why: "Network error" });
          }
        })
      );
    }
    setBulkBusy(null);
    return failed;
  }
  const titleOf = (id: string) => events?.find((e) => e.id === id)?.title ?? "A project";
  function reportResult(verb: string, ids: string[], failed: { id: string; why: string }[]) {
    const done = ids.length - failed.length;
    setNotice(`${verb} ${done} ${done === 1 ? "project" : "projects"}.`);
    if (failed.length)
      setError(
        `${failed.length} not ${verb.toLowerCase()}: ` +
          failed
            .slice(0, 4)
            .map((f) => `${titleOf(f.id).slice(0, 40)} (${f.why})`)
            .join("; ") +
          (failed.length > 4 ? "…" : "")
      );
    setPicked(new Set(failed.map((f) => f.id)));
  }

  async function handleBulkStage(stageName: string) {
    const ids = [...shownPicked];
    const failed = await runEach(ids, "stage", (id) => fetch(`/api/admin/events/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pipelineStage: stageName }) }));
    reportResult(`Moved to ${stageName}:`, ids, failed);
    await loadAll();
  }

  async function handleDelete(ids: string[]) {
    setConfirmDelete(null);
    // The server keeps any project that has payment history (and says so).
    const failed = await runEach(ids, "delete", (id) => fetch(`/api/admin/events/${id}`, { method: "DELETE" }));
    reportResult("Deleted", ids, failed);
    await loadAll();
  }

  async function handleBulkDecline() {
    const ids = [...shownPicked];
    const failed = await runEach(ids, "decline", (id) => fetch(`/api/events/${id}/decline`, { method: "POST" }));
    reportResult("Declined", ids, failed);
    await loadAll();
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
  const needNow = new Date();
  const needFiltered = need ? (events ?? []).filter((e) => matchesNeed(e as unknown as DashEvent, need, needNow)) : null;
  const visibleEvents = needFiltered ?? (categoryGroup ? stageFiltered.filter((e) => categoryGroup.match(e.event_category)) : stageFiltered);
  // Bulk actions only ever touch projects in the current view (not ones picked under another tab or filter).
  const visibleIds = new Set(visibleEvents.map((e) => e.id));
  const shownPicked = new Set([...picked].filter((id) => visibleIds.has(id)));

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

        {need && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-gold/40 bg-gold-soft px-4 py-3" role="status" data-tour="projects-need">
            <div>
              <p className="text-sm font-semibold">
                {NEED_LABELS[need].title} {events !== null && <span className="font-normal text-muted">({visibleEvents.length})</span>}
              </p>
              <p className="text-xs text-muted">{NEED_LABELS[need].list}</p>
            </div>
            <Link href="/admin/events" className="text-xs font-semibold text-gold hover:underline">
              Show all projects
            </Link>
          </div>
        )}

        {!need && <div className="flex flex-col gap-3">
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
        </div>}

        {events === null && <p className="text-sm text-muted">Loading projects…</p>}

        {error && !showCreate && (
          <p role="alert" className="flex items-start justify-between gap-3 rounded-[10px] border border-status-declined/40 px-3 py-2 text-sm text-status-declined">
            {error}
            <button type="button" onClick={() => setError(null)} aria-label="Dismiss" className="shrink-0 rounded-[6px] text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
              <X size={15} aria-hidden />
            </button>
          </p>
        )}
        {notice && (
          <p role="status" className="flex items-start justify-between gap-3 rounded-[10px] border border-status-approved/40 px-3 py-2 text-sm">
            {notice}
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="shrink-0 rounded-[6px] text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
              <X size={15} aria-hidden />
            </button>
          </p>
        )}

        {(stage === "active" || need) && events !== null && (
          <DataTable
            selection={{ selected: shownPicked, onChange: setPicked, rowLabel: (e) => e.title }}
            bulkBar={
              <BulkBar count={shownPicked.size} busy={bulkBusy} onClear={() => setPicked(new Set())}>
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-muted">Move to</span>
                  <select
                    value=""
                    disabled={!!bulkBusy}
                    onChange={(ev) => ev.target.value && handleBulkStage(ev.target.value)}
                    className="h-9 rounded-[10px] border border-border bg-panel px-2 text-sm focus:border-gold focus:outline-none"
                    aria-label="Move the selected projects to a stage"
                  >
                    <option value="">Stage…</option>
                    {PIPELINE_STAGES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </label>
                <Button variant="destructive" size="sm" disabled={!!bulkBusy} onClick={() => setConfirmDelete([...shownPicked])}>
                  <Trash2 size={14} aria-hidden /> Delete…
                </Button>
              </BulkBar>
            }
            columns={eventColumns(handleStageChange, (id) => router.push(`/admin/events/${id}`), (id) => setConfirmDelete([id]))}
            rows={visibleEvents}
            rowKey={(e) => e.id}
            onRowClick={(e) => router.push(`/admin/events/${e.id}`)}
            searchFn={(e, q) =>
              e.title.toLowerCase().includes(q) ||
              (clientName(e.clients, "") ?? "").toLowerCase().includes(q) ||
              (e.venues?.name ?? "").toLowerCase().includes(q)
            }
            searchPlaceholder="Search projects…"
            emptyIcon={Briefcase}
            emptyTitle="No projects in this view"
            emptyBody="Create a project or adjust the filters above."
          />
        )}

        {!need && events !== null && stage === "inquiries" && visibleEvents.length === 0 && (
          <EmptyState icon={Magnet} title="No inquiries waiting" body="New booking requests from the website will show up here." />
        )}

        {!need && stage === "inquiries" && visibleEvents.length > 0 && (
          <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--gold)]"
                checked={visibleEvents.every((e) => shownPicked.has(e.id))}
                onChange={(ev) => setPicked(ev.target.checked ? new Set(visibleEvents.map((e) => e.id)) : new Set())}
              />
              Select all {visibleEvents.length}
            </label>
          </div>
          {shownPicked.size > 0 && (
            <BulkBar count={shownPicked.size} busy={bulkBusy} onClear={() => setPicked(new Set())}>
              <Button variant="secondary" size="sm" disabled={!!bulkBusy} onClick={handleBulkDecline}>
                Decline
              </Button>
              <Button variant="destructive" size="sm" disabled={!!bulkBusy} onClick={() => setConfirmDelete([...shownPicked])}>
                <Trash2 size={14} aria-hidden /> Delete…
              </Button>
            </BulkBar>
          )}
          <div className="flex flex-col divide-y divide-border border-y border-border">
            {visibleEvents.map((e) => (
              <div key={e.id} className={cn("flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between", picked.has(e.id) && "bg-gold/[0.06]")}>
                <div className="flex min-w-0 items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--gold)]"
                  checked={picked.has(e.id)}
                  aria-label={`Select ${e.title}`}
                  onChange={() =>
                    setPicked((cur) => {
                      const n = new Set(cur);
                      if (n.has(e.id)) n.delete(e.id);
                      else n.add(e.id);
                      return n;
                    })
                  }
                />
                <div className="min-w-0">
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
                  {e.special_requests && <p className="mt-1.5 line-clamp-2 break-words text-sm">{e.special_requests}</p>}
                </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="primary" size="sm" disabled={busyId === e.id} onClick={() => handleInquiryAction(e.id, "confirm")}>
                    {busyId === e.id ? "…" : "Confirm"}
                  </Button>
                  <Button variant="destructive" size="sm" disabled={busyId === e.id} onClick={() => handleInquiryAction(e.id, "decline")}>
                    Decline
                  </Button>
                  <ActionMenu
                    label={`More actions for ${e.title}`}
                    items={[
                      { label: "Open project", icon: ExternalLink, onSelect: () => router.push(`/admin/events/${e.id}`) },
                      "separator",
                      { label: "Delete project…", icon: Trash2, danger: true, onSelect: () => setConfirmDelete([e.id]) }
                    ]}
                  />
                </div>
              </div>
            ))}
          </div>
          </div>
        )}

        <ConfirmModal
          open={!!confirmDelete}
          title={confirmDelete && confirmDelete.length > 1 ? `Delete ${confirmDelete.length} projects?` : "Delete this project?"}
          body={
            confirmDelete && confirmDelete.length === 1
              ? `"${titleOf(confirmDelete[0]).slice(0, 80)}" and its tasks, messages, files and contract are removed for good. A project with payments is kept.`
              : "Each project and its tasks, messages, files and contracts are removed for good. Any project with payments is kept and listed after."
          }
          confirmLabel={confirmDelete && confirmDelete.length > 1 ? `Delete ${confirmDelete.length}` : "Delete"}
          onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />

      </div>
    </>
  );
}

/** Bulk actions for the selected projects. */
function BulkBar({ count, busy, onClear, children }: { count: number; busy: string | null; onClear: () => void; children: React.ReactNode }) {
  return (
    <div role="region" aria-label="Bulk actions" className="sticky top-2 z-20 flex flex-wrap items-center gap-3 rounded-[12px] border border-gold/50 bg-panel px-4 py-2.5 shadow-lg" data-tour="projects-bulk">
      <span className="text-sm font-semibold" aria-live="polite">
        {count} selected
      </span>
      {children}
      {busy && <span className="text-xs text-muted">Working…</span>}
      <button type="button" onClick={onClear} className="ml-auto rounded-[8px] px-2 py-1 text-sm text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
        Clear
      </button>
    </div>
  );
}

function eventColumns(onStageChange: (eventId: string, stage: string) => void, onOpen: (id: string) => void, onDelete: (id: string) => void): DataTableColumn<EventRow>[] {
  return [
    {
      key: "date",
      header: "Date",
      sortValue: (e) => e.starts_at ?? "",
      render: (e) => (
        <span className="whitespace-nowrap tabular-nums text-muted">
          {e.starts_at ? new Date(e.starts_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "TBD"}
        </span>
      )
    },
    {
      key: "project",
      header: "Project",
      sortValue: (e) => e.title,
      render: (e) => {
        const name = clientName(e.clients, "Unnamed contact");
        return (
          <>
            <Link href={`/admin/events/${e.id}`} data-tour="project-link" title={e.title} className="line-clamp-2 break-words font-medium hover:text-gold hover:underline">
              {e.title}
            </Link>
            {name ? <div className="text-xs text-muted">{name}</div> : <div className="text-xs text-status-urgent">No client linked</div>}
          </>
        );
      }
    },
    { key: "venue", header: "Venue", hideBelow: "md", render: (e) => <span className="text-muted">{e.venues?.name ?? "—"}</span> },
    {
      key: "dj",
      header: "DJ",
      sortValue: (e) => e.djs?.display_name ?? "",
      render: (e) => <span className={e.djs ? "" : "text-status-urgent"}>{e.djs?.display_name ?? "Unassigned"}</span>
    },
    { key: "type", header: "Type", hideBelow: "lg", render: (e) => <span className="text-muted">{e.event_type ?? "—"}</span> },
    {
      key: "status",
      header: "Status",
      sortValue: (e) => e.status,
      render: (e) => (
        <StatusChip tone={(STATUS_DOT[e.status] as StatusTone) ?? "muted"} variant="dot">
          {STATUS_LABEL[e.status] ?? e.status}
        </StatusChip>
      )
    },
    {
      key: "stage",
      header: "Stage",
      render: (e) => (
        <select
          value={e.pipeline_stage ?? "Inquiry"}
          onChange={(ev) => onStageChange(e.id, ev.target.value)}
          onClick={(ev) => ev.stopPropagation()}
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
      )
    },
    {
      key: "payment",
      header: "Payment",
      hideBelow: "md",
      render: (e) => {
        const totalDue = e.final_amount ?? e.quoted_amount;
        const totalDueCents = totalDue ? Math.round(totalDue * 100) : 0;
        if (!totalDue) return <span className="whitespace-nowrap text-muted">—</span>;
        return (
          <span
            className={cn(
              "whitespace-nowrap",
              e.paid_cents >= totalDueCents ? "text-status-approved" : e.paid_cents > 0 ? "text-status-pending" : "text-muted"
            )}
          >
            {e.paid_cents >= totalDueCents ? "Paid" : `$${(e.paid_cents / 100).toFixed(0)}/$${totalDue.toFixed(0)}`}
          </span>
        );
      }
    },
    {
      key: "contract",
      header: "Contract",
      hideBelow: "lg",
      render: (e) => (
        <Link
          href={`/admin/events/${e.id}`}
          onClick={(ev) => ev.stopPropagation()}
          className={cn(
            "whitespace-nowrap hover:underline",
            e.contract_status === "signed" ? "text-status-approved" : e.contract_status === "sent" ? "text-status-pending" : "text-gold"
          )}
        >
          {e.contract_status === "signed" ? "Signed" : e.contract_status === "sent" ? "Sent" : "Send"}
        </Link>
      )
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (e) => (
        <ActionMenu
          label={`More actions for ${e.title}`}
          items={[
            { label: "Open project", icon: ExternalLink, onSelect: () => onOpen(e.id) },
            "separator",
            { label: "Delete project…", icon: Trash2, danger: true, onSelect: () => onDelete(e.id) }
          ]}
        />
      )
    }
  ];
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

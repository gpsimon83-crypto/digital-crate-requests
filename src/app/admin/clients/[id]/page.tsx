"use client";

import { Suspense, use as usePromise, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { StatusChip, type StatusTone } from "@/components/ui/status-chip";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { money, clientName } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  CalendarDays,
  ChevronRight,
  Briefcase,
  DollarSign,
  FileText,
  Wallet,
  FolderOpen,
  MessageSquare,
  ExternalLink
} from "lucide-react";

interface EventRow {
  id: string;
  title: string;
  starts_at: string | null;
  status: string;
  final_amount: number | null;
  quoted_amount: number | null;
  contract_status: string | null;
}

interface ClientDetail {
  id: string;
  status: string;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  referral_source: string | null;
  notes: string | null;
  tags: string[] | null;
  events: EventRow[];
}

interface ClientMessage {
  id: string;
  event_id: string;
  direction: "outbound" | "inbound";
  from_email: string;
  from_name: string | null;
  subject: string | null;
  body: string;
  seen_at: string | null;
  created_at: string;
  events: { title: string | null; event_code: string } | null;
}

interface ContractRow {
  id: string;
  event_id: string;
  status: "draft" | "sent" | "signed" | "void";
  title: string;
  sent_at: string | null;
  signed_at: string | null;
  signed_by_name: string | null;
  created_at: string;
  events: { title: string; event_code: string } | null;
}

interface PaymentRow {
  id: string;
  event_id: string;
  kind: string;
  amount_cents: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  events: { title: string } | null;
}

interface FileRow {
  id: string;
  event_id: string;
  category: string;
  file_url: string;
  file_name: string;
  source: string;
  created_at: string;
  events: { title: string } | null;
}

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "events", label: "Events" },
  { key: "messages", label: "Messages" },
  { key: "contracts", label: "Contracts" },
  { key: "payments", label: "Payments" },
  { key: "documents", label: "Documents" },
  { key: "notes", label: "Notes" }
] as const;
type TabKey = (typeof TABS)[number]["key"];

const STATUS_TONE: Record<string, StatusTone> = { active: "approved", inactive: "muted", blocked: "declined" };
const CONTRACT_TONE: Record<string, StatusTone> = { draft: "muted", sent: "pending", signed: "approved", void: "declined" };
const PAYMENT_TONE: Record<string, StatusTone> = { pending: "pending", succeeded: "approved", failed: "declined" };

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted">Loading...</div>}>
      <ClientDetailInner params={params} />
    </Suspense>
  );
}

function ClientDetailInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get("tab") as TabKey | null) ?? "overview";

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [messages, setMessages] = useState<ClientMessage[] | null>(null);
  const [contracts, setContracts] = useState<ContractRow[] | null>(null);
  const [payments, setPayments] = useState<PaymentRow[] | null>(null);
  const [files, setFiles] = useState<FileRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/clients/${id}`)
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || "Failed to load client");
        setClient(data.client);
        setNotesDraft(data.client.notes ?? "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."));

    fetch(`/api/admin/clients/${id}/messages`)
      .then((r) => r.json())
      .then((data) => setMessages(data.messages ?? []))
      .catch(() => setMessages([]));

    fetch(`/api/admin/clients/${id}/contracts`)
      .then((r) => r.json())
      .then((data) => setContracts(data.contracts ?? []))
      .catch(() => setContracts([]));

    fetch(`/api/admin/clients/${id}/payments`)
      .then((r) => r.json())
      .then((data) => setPayments(data.payments ?? []))
      .catch(() => setPayments([]));

    fetch(`/api/admin/clients/${id}/files`)
      .then((r) => r.json())
      .then((data) => setFiles(data.files ?? []))
      .catch(() => setFiles([]));
  }, [id]);

  async function handleSaveNotes() {
    setSavingNotes(true);
    setNotesSaved(false);
    try {
      const res = await fetch(`/api/admin/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notesDraft })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save notes");
      setClient((prev) => (prev ? { ...prev, notes: data.client.notes } : prev));
      setNotesSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSavingNotes(false);
    }
  }

  if (error) {
    return (
      <div className="p-8">
        <p className="text-sm text-status-declined">{error}</p>
        <Link href="/admin/clients" className="mt-4 inline-block text-sm text-gold">
          ← Back to Contacts
        </Link>
      </div>
    );
  }

  if (!client) {
    return <div className="p-8 text-sm text-muted">Loading...</div>;
  }

  const name = clientName(client, "Unnamed contact");
  const events = [...client.events].sort((a, b) => new Date(b.starts_at ?? 0).getTime() - new Date(a.starts_at ?? 0).getTime());
  const totalValueCents = client.events.reduce((sum, e) => sum + Math.round((e.final_amount ?? e.quoted_amount ?? 0) * 100), 0);
  const totalCollectedCents = (payments ?? []).filter((p) => p.status === "succeeded").reduce((sum, p) => sum + p.amount_cents, 0);

  return (
    <div className="pb-16">
      <Link
        href="/admin/clients"
        className="ml-6 mt-5 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[1.5px] text-muted hover:text-foreground sm:ml-8"
      >
        <ArrowLeft size={14} /> Contacts
      </Link>

      <div className="mx-6 mt-3 flex flex-col gap-4 sm:mx-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 font-display text-2xl font-light">
              {client.company_name && <Building2 size={20} className="text-gold" />}
              {name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              {client.email && (
                <span className="flex items-center gap-1.5">
                  <Mail size={13} /> {client.email}
                </span>
              )}
              {client.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone size={13} /> {client.phone}
                </span>
              )}
            </div>
          </div>
          <StatusChip tone={STATUS_TONE[client.status] ?? "muted"} className="capitalize">
            {client.status}
          </StatusChip>
        </div>

        <div className="flex flex-wrap border border-border">
          <StatTile icon={Briefcase} label="Total Events" value={events.length} />
          <StatTile icon={DollarSign} label="Total Booked Value" value={money(totalValueCents)} />
          <StatTile icon={Wallet} label="Total Collected" value={money(totalCollectedCents)} />
        </div>

        <Tabs items={TABS} active={activeTab} hrefFor={(key) => `/admin/clients/${id}?tab=${key}`} />

        {activeTab === "overview" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <GlassCard className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-[1.5px] text-muted">Contact Details</p>
              <Row label="Email" value={client.email ?? "—"} />
              <Row label="Phone" value={client.phone ?? "—"} />
              <Row label="Referral source" value={client.referral_source ?? "—"} />
            </GlassCard>
            <GlassCard className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-[1.5px] text-muted">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {(client.tags ?? []).length === 0 && <span className="text-sm text-muted">No tags yet.</span>}
                {(client.tags ?? []).map((tag) => (
                  <span key={tag} className="rounded-full bg-gold-soft px-2.5 py-1 text-xs text-gold-dim">
                    {tag}
                  </span>
                ))}
              </div>
            </GlassCard>
          </div>
        )}

        {activeTab === "events" && (
          <GlassCard className="flex flex-col gap-3">
            {events.length === 0 ? (
              <EmptyState icon={CalendarDays} title="No events yet" />
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {events.map((e) => (
                  <Link key={e.id} href={`/admin/events/${e.id}`} className="group flex items-center justify-between gap-2 py-2.5 first:pt-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium group-hover:text-gold">{e.title}</p>
                      <p className="flex items-center gap-1 text-xs text-muted">
                        <CalendarDays size={11} />
                        {e.starts_at ? new Date(e.starts_at).toLocaleDateString() : "No date set"}
                      </p>
                    </div>
                    <ChevronRight size={14} className="shrink-0 text-muted group-hover:text-gold" />
                  </Link>
                ))}
              </div>
            )}
          </GlassCard>
        )}

        {activeTab === "messages" && (
          <GlassCard className="flex flex-col gap-3">
            <p className="text-xs text-muted">
              Every email across all of {name}&rsquo;s events, most recent first. Reply from the relevant project&rsquo;s Activity tab.
            </p>
            {messages === null && <p className="text-sm text-muted">Loading…</p>}
            {messages !== null && messages.length === 0 && <EmptyState icon={MessageSquare} title="No emails with this client yet" />}
            {messages !== null && messages.length > 0 && (
              <div className="flex flex-col gap-3">
                {messages.map((m) => (
                  <Link
                    key={m.id}
                    href={`/admin/events/${m.event_id}?tab=Activity`}
                    className={cn(
                      "flex flex-col gap-1 rounded-[10px] border p-3 text-sm transition-colors hover:border-gold/50",
                      m.direction === "outbound" ? "border-black/10 bg-panel" : "border-gold/30 bg-gold/5"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-muted">
                      <span className="font-medium text-foreground">
                        {m.direction === "outbound" ? m.from_name || m.from_email : m.from_email}
                      </span>
                      <span>{new Date(m.created_at).toLocaleString()}</span>
                    </div>
                    {m.subject && <p className="text-xs font-medium text-muted">{m.subject}</p>}
                    <p className="line-clamp-2 whitespace-pre-wrap">{m.body}</p>
                    <div className="flex items-center justify-between text-[11px] text-muted">
                      <span>{m.events?.title ?? "Unknown event"}</span>
                      {m.direction === "outbound" && <span>{m.seen_at ? `Seen ${new Date(m.seen_at).toLocaleDateString()}` : "Not yet seen"}</span>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </GlassCard>
        )}

        {activeTab === "contracts" && (
          <GlassCard className="flex flex-col gap-3">
            {contracts === null && <p className="text-sm text-muted">Loading…</p>}
            {contracts !== null && contracts.length === 0 && <EmptyState icon={FileText} title="No contracts yet" />}
            {contracts !== null && contracts.length > 0 && (
              <div className="flex flex-col divide-y divide-border">
                {contracts.map((c) => (
                  <Link key={c.id} href={`/admin/events/${c.event_id}?tab=Details`} className="group flex items-center justify-between gap-3 py-2.5 first:pt-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium group-hover:text-gold">{c.title}</p>
                      <p className="truncate text-xs text-muted">{c.events?.title ?? "Unknown event"}</p>
                    </div>
                    <StatusChip tone={CONTRACT_TONE[c.status] ?? "muted"} variant="dot" className="shrink-0">
                      {c.status}
                    </StatusChip>
                  </Link>
                ))}
              </div>
            )}
          </GlassCard>
        )}

        {activeTab === "payments" && (
          <GlassCard className="flex flex-col gap-3">
            {payments === null && <p className="text-sm text-muted">Loading…</p>}
            {payments !== null && payments.length === 0 && <EmptyState icon={Wallet} title="No payments yet" />}
            {payments !== null && payments.length > 0 && (
              <div className="flex flex-col divide-y divide-border">
                {payments.map((p) => (
                  <Link key={p.id} href={`/admin/events/${p.event_id}?tab=Financials`} className="group flex items-center justify-between gap-3 py-2.5 first:pt-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium capitalize group-hover:text-gold">{p.kind}</p>
                      <p className="truncate text-xs text-muted">{p.events?.title ?? "Unknown event"}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-semibold tabular-nums">{money(p.amount_cents)}</span>
                      <StatusChip tone={PAYMENT_TONE[p.status] ?? "muted"} variant="dot">
                        {p.status}
                      </StatusChip>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </GlassCard>
        )}

        {activeTab === "documents" && (
          <GlassCard className="flex flex-col gap-3">
            {files === null && <p className="text-sm text-muted">Loading…</p>}
            {files !== null && files.length === 0 && <EmptyState icon={FolderOpen} title="No documents yet" />}
            {files !== null && files.length > 0 && (
              <div className="flex flex-col divide-y divide-border">
                {files.map((f) => (
                  <a
                    key={f.id}
                    href={f.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center justify-between gap-3 py-2.5 first:pt-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium group-hover:text-gold">{f.file_name}</p>
                      <p className="truncate text-xs capitalize text-muted">
                        {f.category.replace("_", " ")} · {f.events?.title ?? "Unknown event"}
                      </p>
                    </div>
                    <ExternalLink size={14} className="shrink-0 text-muted group-hover:text-gold" />
                  </a>
                ))}
              </div>
            )}
          </GlassCard>
        )}

        {activeTab === "notes" && (
          <GlassCard className="flex flex-col gap-2">
            <p className="text-xs text-muted">Internal only — never visible to the client.</p>
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              placeholder="Anything your team should know about this client..."
              className="min-h-[160px] w-full rounded-[10px] border border-black/10 bg-panel px-4 py-3 text-sm focus:border-gold focus:outline-none"
            />
            <div className="flex items-center gap-3">
              <Button variant="primary" size="sm" onClick={handleSaveNotes} disabled={savingNotes} className="w-fit">
                {savingNotes ? "Saving..." : "Save notes"}
              </Button>
              {notesSaved && <span className="text-xs text-status-approved">Saved.</span>}
            </div>
          </GlassCard>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}

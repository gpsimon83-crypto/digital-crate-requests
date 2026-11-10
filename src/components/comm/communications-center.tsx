"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Copy, Eye, Mail, MailX, MousePointerClick, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusChip, type StatusTone } from "@/components/ui/status-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { SideDrawer } from "@/components/ui/side-drawer";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { AUDIENCES, AUDIENCE_LABELS, normalizeAudience, type EmailAudience } from "@/lib/comm/blocks";

export type CommTab = "overview" | "templates" | "sent" | "settings";

const TAB_ITEMS = [
  { key: "overview", label: "Overview" },
  { key: "templates", label: "Templates" },
  { key: "sent", label: "Sent" },
  { key: "settings", label: "Settings" }
] as const;

interface DesignRow {
  id: string;
  name: string;
  subject: string;
  theme: "dark" | "light";
  audience: string;
  is_starter: boolean;
  updated_at: string;
}

interface SendRow {
  id: string;
  design_id: string | null;
  design_name: string;
  subject: string;
  is_test: boolean;
  recipient_count: number;
  created_at: string;
  counts: Record<string, number>;
}

interface Provider {
  configured: boolean;
  from: string;
  replyTo: string;
  webhookConfigured: boolean;
}

export const STATUS_TONE: Record<string, StatusTone> = {
  queued: "muted",
  sent: "played",
  delayed: "pending",
  delivered: "approved",
  bounced: "declined",
  complained: "declined",
  failed: "declined",
  suppressed: "muted"
};

export const STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  sent: "Sent",
  delayed: "Delayed",
  delivered: "Delivered",
  bounced: "Bounced",
  complained: "Marked spam",
  failed: "Failed",
  suppressed: "Skipped (do-not-email)"
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data as T;
}

export function CommunicationsCenter({ tab }: { tab: CommTab }) {
  const router = useRouter();
  const [designs, setDesigns] = useState<DesignRow[] | null>(null);
  const [sends, setSends] = useState<SendRow[] | null>(null);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [provider, setProvider] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [openSend, setOpenSend] = useState<string | null>(null);
  const [audienceFilter, setAudienceFilter] = useState<"all" | EmailAudience>("all");

  const load = useCallback(async () => {
    try {
      const [d, s] = await Promise.all([
        api<{ designs: DesignRow[] }>("/api/admin/communications/designs"),
        api<{ sends: SendRow[]; last30Days: Record<string, number>; provider: Provider }>("/api/admin/communications/sends")
      ]);
      setDesigns(d.designs);
      setSends(s.sends);
      setTotals(s.last30Days);
      setProvider(s.provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createDesign(fromId?: string, audience?: EmailAudience) {
    setBusy(true);
    setError(null);
    try {
      const { design } = await api<{ design: DesignRow }>("/api/admin/communications/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fromId ? { fromId } : { audience: audience ?? "client" })
      });
      router.push(`/admin/communications/studio/${design.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    try {
      await api(`/api/admin/communications/designs/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  const realSends = useMemo(() => (sends ?? []).filter((s) => !s.is_test), [sends]);
  const delivered = totals.delivered ?? 0;
  const sentTotal = (totals.sent ?? 0) + (totals.delivered ?? 0) + (totals.delayed ?? 0) + (totals.bounced ?? 0) + (totals.complained ?? 0);
  const problems = (totals.bounced ?? 0) + (totals.failed ?? 0) + (totals.complained ?? 0);

  return (
    <div>
      <PageHeader
        title="Communications Center"
        subtitle="Design branded emails and send them to your clients."
        action={
          <Button variant="primary" onClick={() => createDesign()} disabled={busy} aria-label="New email" className="shrink-0" data-tour="comm-new">
            <Plus size={15} /> <span className="hidden sm:inline">New email</span>
            <span className="sm:hidden">New</span>
          </Button>
        }
      />
      <div className="px-6 sm:px-8">
        <div data-tour="comm-tabs">
          <Tabs items={TAB_ITEMS} active={tab} hrefFor={(k) => `/admin/communications?tab=${k}`} className="mt-2" />
        </div>
        {error && <p className="mt-4 rounded-[10px] border border-status-declined/30 bg-status-declined/5 px-3 py-2 text-sm text-status-declined">{error}</p>}
        {provider && !provider.configured && (
          <p className="mt-4 flex items-start gap-2 rounded-[10px] border border-status-pending/40 bg-status-pending/10 px-3 py-2 text-sm">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-status-pending" />
            <span>
              Sending isn&apos;t set up yet. You can design and save emails now; sending turns on once Resend is configured.{" "}
              <Link className="text-gold underline" href="/admin/communications?tab=settings">See Settings</Link>
            </span>
          </p>
        )}

        {tab === "overview" && (
          <section className="py-6">
            <div className="flex flex-wrap rounded-[var(--radius-card)] border border-border bg-card" data-tour="comm-stats">
              <StatTile icon={Send} label="Sent (30 days)" value={sentTotal} />
              <StatTile icon={CheckCircle2} label="Delivered" value={provider?.webhookConfigured ? delivered : "—"} />
              <StatTile icon={Eye} label="Opened" value={provider?.webhookConfigured ? realSends.reduce((n, s) => n + (s.counts.opened ?? 0), 0) : "—"} />
              <StatTile icon={MousePointerClick} label="Clicked" value={provider?.webhookConfigured ? realSends.reduce((n, s) => n + (s.counts.clicked ?? 0), 0) : "—"} />
              <StatTile icon={MailX} label="Bounced / failed" value={problems} tone={problems ? "urgent" : "default"} />
            </div>
            {provider?.configured && !provider.webhookConfigured && (
              <p className="mt-2 text-xs text-muted">Delivered, opened and clicked appear once the Resend webhook is connected (Settings). Until then only “sent” is known.</p>
            )}

            <div className="mt-8 grid gap-8 lg:grid-cols-2">
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-display text-2xl font-light">Start from a template</h2>
                  <Link href="/admin/communications?tab=templates" className="text-sm text-gold hover:underline">All templates</Link>
                </div>
                <DesignGrid designs={(designs ?? []).slice(0, 4)} loading={!designs} onDuplicate={(id) => createDesign(id)} onDelete={setDeleteId} compact />
              </div>
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-display text-2xl font-light">Recent sends</h2>
                  <Link href="/admin/communications?tab=sent" className="text-sm text-gold hover:underline">All sent</Link>
                </div>
                <SendList sends={(sends ?? []).slice(0, 6)} loading={!sends} onOpen={setOpenSend} />
              </div>
            </div>
          </section>
        )}

        {tab === "templates" && (
          <section className="py-6">
            <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Filter templates" data-tour="comm-filter">
              {([["all", "All"] as const, ...AUDIENCES.map((k) => [k, AUDIENCE_LABELS[k]] as const)]).map(([k, label]) => {
                const n = k === "all" ? (designs ?? []).length : (designs ?? []).filter((d) => normalizeAudience(d.audience) === k).length;
                return (
                  <button
                    key={k}
                    role="tab"
                    aria-selected={audienceFilter === k}
                    onClick={() => setAudienceFilter(k)}
                    className={
                      audienceFilter === k
                        ? "rounded-full border border-gold bg-gold-soft px-3 py-1 text-xs font-medium"
                        : "rounded-full border border-black/10 px-3 py-1 text-xs hover:border-gold"
                    }
                  >
                    {label} <span className="text-muted">{n}</span>
                  </button>
                );
              })}
            </div>
            <DesignGrid
              designs={(designs ?? []).filter((d) => audienceFilter === "all" || normalizeAudience(d.audience) === audienceFilter)}
              loading={!designs}
              onDuplicate={(id) => createDesign(id)}
              onDelete={setDeleteId}
              onNew={() => createDesign(undefined, audienceFilter === "all" ? "client" : audienceFilter)}
            />
          </section>
        )}

        {tab === "sent" && (
          <section className="py-6">
            <SendList sends={sends ?? []} loading={!sends} onOpen={setOpenSend} />
          </section>
        )}

        {tab === "settings" && provider && <SettingsPanel provider={provider} />}
      </div>

      <ConfirmModal
        open={!!deleteId}
        title="Delete this template?"
        body="It's removed from your templates. Emails already sent with it stay in the Sent log."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
      <SendDrawer key={openSend ?? "closed"} sendId={openSend} onClose={() => setOpenSend(null)} />
    </div>
  );
}

function DesignGrid({
  designs,
  loading,
  onDuplicate,
  onDelete,
  onNew,
  compact
}: {
  designs: DesignRow[];
  loading: boolean;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onNew?: () => void;
  compact?: boolean;
}) {
  if (loading) return <p className="text-sm text-muted">Loading…</p>;
  if (!designs.length) return <EmptyState icon={Mail} title="No templates yet" body="Create your first email with New email." />;
  return (
    <div className={compact ? "grid gap-3 sm:grid-cols-2" : "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"}>
      {designs.map((d) => (
        <div key={d.id} data-tour="comm-template" data-tour-name={d.name} className="group flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-card shadow-[var(--shadow-card)]">
          <Link href={`/admin/communications/studio/${d.id}`} className="block">
            <div className={d.theme === "dark" ? "flex h-20 items-center justify-center bg-[#0F0E0C]" : "flex h-20 items-center justify-center bg-[#F4EFE7]"}>
              <span className={d.theme === "dark" ? "font-display text-lg text-[#C9A15B]" : "font-display text-lg text-[#A6763A]"}>{d.name}</span>
            </div>
          </Link>
          <div className="flex flex-1 flex-col gap-1 p-3">
            <p className="truncate text-sm font-medium">{d.name}</p>
            <p className="truncate text-xs text-muted">{d.subject || "No subject yet"}</p>
            <div className="mt-2 flex items-center gap-1">
              <Link href={`/admin/communications/studio/${d.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-black/15 px-3 text-xs hover:border-gold">
                <Pencil size={13} /> Edit
              </Link>
              <Button size="sm" variant="icon" title="Duplicate" aria-label={`Duplicate ${d.name}`} onClick={() => onDuplicate(d.id)}>
                <Copy size={14} />
              </Button>
              <Button size="sm" variant="icon" title="Delete" aria-label={`Delete ${d.name}`} onClick={() => onDelete(d.id)}>
                <Trash2 size={14} />
              </Button>
              <span className="ml-auto text-[11px] text-muted">{AUDIENCE_LABELS[normalizeAudience(d.audience)]}</span>
            </div>
          </div>
        </div>
      ))}
      {onNew && (
        <button onClick={onNew} className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-dashed border-border text-sm text-muted hover:border-gold hover:text-foreground">
          <Plus size={18} /> New blank email
        </button>
      )}
    </div>
  );
}

function SendList({ sends, loading, onOpen }: { sends: SendRow[]; loading: boolean; onOpen: (id: string) => void }) {
  if (loading) return <p className="text-sm text-muted">Loading…</p>;
  if (!sends.length) return <EmptyState icon={Send} title="Nothing sent yet" body="Emails you send from the Studio show up here with their delivery status." />;
  return (
    <div className="divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border bg-card">
      {sends.map((s) => {
        const problems = (s.counts.bounced ?? 0) + (s.counts.failed ?? 0) + (s.counts.complained ?? 0);
        return (
          <button key={s.id} onClick={() => onOpen(s.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.02]">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {s.is_test && <span className="mr-1.5 rounded bg-panel px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">Test</span>}
                {s.subject}
              </p>
              <p className="truncate text-xs text-muted">
                {s.design_name} · {fmt(s.created_at)}
              </p>
            </div>
            <div className="shrink-0 text-right text-xs text-muted">
              <p>
                {s.recipient_count} recipient{s.recipient_count === 1 ? "" : "s"}
              </p>
              <p>
                {(s.counts.delivered ?? 0) > 0 && <span className="text-status-approved">{s.counts.delivered} delivered </span>}
                {problems > 0 && <span className="text-status-declined">{problems} problem{problems === 1 ? "" : "s"}</span>}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function SendDrawer({ sendId, onClose }: { sendId: string | null; onClose: () => void }) {
  const [data, setData] = useState<{
    send: SendRow;
    recipients: { id: string; email: string; name: string | null; status: string; error: string | null; opened_at: string | null; clicked_at: string | null }[];
  } | null>(null);
  useEffect(() => {
    if (!sendId) return;
    api<typeof data>(`/api/admin/communications/sends?id=${sendId}`).then(setData).catch(() => setData(null));
  }, [sendId]);
  return (
    <SideDrawer open={!!sendId} onClose={onClose} title={data?.send.subject ?? "Send details"} subtitle={data ? `${data.send.design_name} · ${fmt(data.send.created_at)}` : undefined}>
      {!data ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <ul className="divide-y divide-border">
          {data.recipients.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm">{r.name || r.email}</p>
                {r.name && <p className="truncate text-xs text-muted">{r.email}</p>}
                {r.error && <p className="mt-0.5 text-xs text-status-declined">{r.error}</p>}
                {(r.opened_at || r.clicked_at) && (
                  <p className="mt-0.5 text-xs text-muted">
                    {r.opened_at && "Opened"} {r.clicked_at && "· Clicked"}
                  </p>
                )}
              </div>
              <StatusChip tone={STATUS_TONE[r.status] ?? "muted"} variant="dot">
                {STATUS_LABEL[r.status] ?? r.status}
              </StatusChip>
            </li>
          ))}
        </ul>
      )}
    </SideDrawer>
  );
}

function StatusRow({ ok, label, detail }: { ok: boolean; label: string; detail: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 py-3">
      {ok ? <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-status-approved" /> : <AlertTriangle size={17} className="mt-0.5 shrink-0 text-status-pending" />}
      <div>
        <p className="text-sm font-medium">{label}</p>
        <div className="text-sm text-muted">{detail}</div>
      </div>
    </li>
  );
}

function SettingsPanel({ provider }: { provider: Provider }) {
  const [list, setList] = useState<{ email: string; reason: string; detail: string | null; created_at: string }[] | null>(null);
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const load = useCallback(() => {
    api<{ suppressions: typeof list }>("/api/admin/communications/suppressions")
      .then((d) => setList(d.suppressions))
      .catch((e) => setErr(e.message));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    setErr(null);
    try {
      await api("/api/admin/communications/suppressions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      setEmail("");
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    }
  }
  async function remove(e: string) {
    await api(`/api/admin/communications/suppressions?email=${encodeURIComponent(e)}`, { method: "DELETE" }).catch(() => null);
    load();
  }

  return (
    <section className="grid gap-8 py-6 lg:grid-cols-2" data-tour="comm-settings">
      <div>
        <h2 className="font-display text-2xl font-light">Email delivery</h2>
        <ul className="mt-2 divide-y divide-border">
          <StatusRow
            ok={provider.configured}
            label={provider.configured ? `Sending from ${provider.from}` : "Resend is not configured"}
            detail={
              provider.configured
                ? "Emails go out through Resend. The sending domain must be verified in Resend (SPF + DKIM records)."
                : "Add RESEND_API_KEY and COMM_EMAIL_FROM (or SYSTEM_EMAIL_FROM) to the project's environment variables in Vercel, then redeploy."
            }
          />
          <StatusRow
            ok={!!provider.replyTo}
            label={provider.replyTo ? `Replies go to ${provider.replyTo}` : "No reply-to address"}
            detail="Set COMM_REPLY_TO to choose where client replies land (defaults to the first OPS_ALERT_EMAILS address)."
          />
          <StatusRow
            ok={provider.webhookConfigured}
            label={provider.webhookConfigured ? "Delivery tracking is on" : "Delivery tracking is off"}
            detail={
              <>
                In Resend → Webhooks, add <code className="rounded bg-panel px-1">{origin}/api/webhooks/resend</code> with all email events, then save its
                signing secret as RESEND_WEBHOOK_SECRET. This powers Delivered, Opened, Clicked, and automatic bounce protection.
              </>
            }
          />
        </ul>
      </div>
      <div>
        <h2 className="font-display text-2xl font-light">Do-not-email list</h2>
        <p className="mt-1 text-sm text-muted">Addresses here are skipped on every send. Bounces and spam complaints are added automatically.</p>
        <div className="mt-3 flex gap-2">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="w-full rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
          />
          <Button onClick={add} disabled={!email.trim()}>
            Add
          </Button>
        </div>
        {err && <p className="mt-2 text-sm text-status-declined">{err}</p>}
        <ul className="mt-3 divide-y divide-border">
          {(list ?? []).map((s) => (
            <li key={s.email} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 truncate">
                {s.email} <span className="text-xs text-muted">· {s.reason}</span>
              </span>
              <Button size="sm" variant="text" onClick={() => remove(s.email)}>
                Remove
              </Button>
            </li>
          ))}
          {list && !list.length && <li className="py-2 text-sm text-muted">Nobody on the list.</li>}
        </ul>
      </div>
    </section>
  );
}

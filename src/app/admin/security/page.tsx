"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatTile } from "@/components/ui/stat-tile";
import { cn } from "@/lib/utils";
import { AlertTriangle, Ban, CheckCircle2, Clock, MailCheck, ShieldAlert, ShieldCheck, Inbox, KeyRound } from "lucide-react";

type Status = "pending_verification" | "needs_review" | "verified" | "spam" | "archived";

interface Row {
  id: string;
  created_at: string;
  kind: "inquiry" | "consultation";
  source: string;
  status: Status;
  name: string;
  email: string;
  phone: string | null;
  event_date: string | null;
  event_type: string | null;
  venue_name: string | null;
  expected_guests: number | null;
  budget_range: string | null;
  message: string | null;
  slot_start: string | null;
  risk_score: number;
  risk_reasons: string[];
  verification_sent_count: number;
  last_verification_sent_at: string | null;
  verification_expires_at: string | null;
  verified_at: string | null;
  activated_at: string | null;
  event_id: string | null;
  reviewed_by_label: string | null;
  reviewed_at: string | null;
  review_note: string | null;
}

interface Overview {
  lists: Record<Status, Row[]>;
  statusCounts7: Record<string, number>;
  signals: Record<string, { day: number; week: number }>;
  history: { id: number; created_at: string; action: string; actor_label: string | null; submission_id: string | null; details: Record<string, unknown> }[];
  blocks: { id: string; kind: string; label: string; reason: string | null; expires_at: string; created_at: string; created_by_label: string | null; removed_at: string | null; removed_by_label: string | null; active: boolean }[];
  setup: Record<string, boolean>;
  staff: { id: string; email: string | null; role: string; lastSignIn: string | null; factors: number; userMetadataRole: string | null }[];
  viewer: { aal: string | null };
}

const TABS: { key: Status; label: string }[] = [
  { key: "needs_review", label: "Needs review" },
  { key: "pending_verification", label: "Pending verification" },
  { key: "verified", label: "Verified" },
  { key: "spam", label: "Spam" },
  { key: "archived", label: "Archived" }
];

const SIGNAL_LABELS: Record<string, string> = {
  rate_limited: "Rate-limited requests",
  turnstile_failed: "Failed security checks",
  submission_spam: "Spam caught (hidden field / blocks)",
  submission_flagged: "Flagged for review",
  duplicate_ignored: "Duplicate submissions",
  rejected_unexpected_fields: "Rejected (unexpected fields)",
  verification_email_limited: "Confirmation emails held by limit",
  verification_email_not_configured: "Confirmation emails not sent (email not configured)",
  verification_email_failed: "Confirmation emails failed"
};

const ACTION_LABELS: Record<string, string> = {
  submission_received: "Request received",
  submission_flagged: "Request flagged for review",
  submission_spam: "Request caught as spam",
  verification_email_sent: "Confirmation email sent",
  email_verified: "Email confirmed",
  lead_activated: "Became a lead",
  lead_activation_failed: "Lead creation failed",
  approved: "Approved",
  approved_without_email_verification: "Approved without email confirmation",
  marked_spam: "Marked spam",
  restored: "Restored",
  admin_resend: "Confirmation email resent by admin",
  block_added: "Block added",
  block_removed: "Block removed",
  rate_limited: "Rate limited",
  turnstile_failed: "Security check failed",
  duplicate_ignored: "Duplicate ignored",
  rejected_unexpected_fields: "Rejected: unexpected fields",
  verification_email_limited: "Confirmation email held by limit",
  verification_email_not_configured: "Confirmation email not sent (email not configured)",
  verification_email_failed: "Confirmation email failed"
};

const SETUP_LABELS: Record<string, string> = {
  turnstile: "Cloudflare Turnstile keys",
  email: "Transactional email (Resend)",
  hashSecret: "SECURITY_HASH_SECRET",
  partnerSecret: "WordPress partner secret",
  appUrl: "NEXT_PUBLIC_APP_URL",
  cronSecret: "CRON_SECRET",
  mfaRequired: "Two-factor required for admins"
};

const fmt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
const fmtDate = (d: string | null) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }) : "—");

export default function SecurityPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Status>("needs_review");
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/security", { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoadError(body.mfa ? "Two-factor verification is required. Verify on the Two-factor page, then come back." : body.error || "Couldn't load.");
      return;
    }
    setLoadError(null);
    setData(body);
  }, []);

  useEffect(() => {
    // Initial fetch on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function act(payload: Record<string, unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(JSON.stringify(payload));
    setFlash(null);
    try {
      const res = await fetch("/api/admin/security/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await res.json().catch(() => ({}));
      setFlash({ ok: res.ok, text: body.message || body.error || (res.ok ? "Done." : "That didn't work.") });
      await load();
    } finally {
      setBusy(null);
    }
  }

  const rows = data?.lists[tab] ?? [];
  const missingSetup = useMemo(() => Object.entries(data?.setup ?? {}).filter(([k, v]) => !v && k !== "mfaRequired" && k !== "partnerSecret"), [data]);

  return (
    <>
      <PageHeader
        title="Inquiry Security"
        subtitle="Website inquiries waiting on email confirmation or review, spam caught, and every manual decision."
        action={
          <Link href="/admin/security/two-factor" data-tour="sec-2fa" className="flex items-center gap-1.5 text-sm text-gold hover:underline">
            <KeyRound size={14} /> Two-factor
          </Link>
        }
      />
      <div className="flex flex-col gap-6 p-6">
        {loadError && <p className="text-sm text-status-declined">{loadError}</p>}
        {flash && <p className={cn("text-sm", flash.ok ? "text-status-approved" : "text-status-declined")} role="status">{flash.text}</p>}
        {!data && !loadError && <p className="text-sm text-muted">Loading…</p>}

        {data && (
          <>
            {missingSetup.length > 0 && (
              <div className="flex items-start gap-2 border border-status-urgent/30 bg-status-urgent/5 px-4 py-3 text-sm">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-status-urgent" />
                <div>
                  <p className="font-medium">Setup still needed: {missingSetup.map(([k]) => SETUP_LABELS[k] ?? k).join(", ")}.</p>
                  <p className="text-muted">Without Turnstile keys the public forms refuse new requests (they never fake a passed check). See SECURITY_SETUP.md.</p>
                </div>
              </div>
            )}

            <div data-tour="sec-stats" className="grid grid-cols-2 border-y border-border sm:grid-cols-4 lg:grid-cols-6">
              <StatTile icon={ShieldAlert} label="Needs review" value={data.lists.needs_review.length} tone={data.lists.needs_review.length ? "urgent" : "default"} />
              <StatTile icon={Clock} label="Pending verification" value={data.lists.pending_verification.length} />
              <StatTile icon={CheckCircle2} label="Verified (7 days)" value={data.statusCounts7.verified ?? 0} />
              <StatTile icon={Ban} label="Spam (7 days)" value={data.statusCounts7.spam ?? 0} />
              <StatTile icon={Inbox} label="Duplicates (7 days)" value={data.signals.duplicate_ignored?.week ?? 0} />
              <StatTile icon={ShieldCheck} label="Blocked attempts (24 h)" value={(data.signals.rate_limited?.day ?? 0) + (data.signals.turnstile_failed?.day ?? 0)} />
            </div>

            <section>
              <div data-tour="sec-tabs" className="flex gap-1 overflow-x-auto border-b border-border" role="tablist">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    role="tab"
                    aria-selected={tab === t.key}
                    onClick={() => setTab(t.key)}
                    className={cn("whitespace-nowrap border-b-2 px-3 py-2 text-sm", tab === t.key ? "border-gold text-foreground" : "border-transparent text-muted hover:text-foreground")}
                  >
                    {t.label} <span className="text-xs text-muted">({data.lists[t.key].length})</span>
                  </button>
                ))}
              </div>

              {rows.length === 0 ? (
                <EmptyState icon={MailCheck} title="Nothing here right now" />
              ) : (
                <div data-tour="sec-list" className="flex flex-col divide-y divide-border border-b border-border">
                  {rows.map((r) => (
                    <SubmissionCard key={r.id} r={r} busy={busy} act={act} />
                  ))}
                </div>
              )}
            </section>

            <section data-tour="sec-blocks" className="grid gap-6 lg:grid-cols-2">
              <div>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Blocked and limited activity</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted">
                      <th className="py-1 font-medium">Signal</th>
                      <th className="py-1 text-right font-medium">24 h</th>
                      <th className="py-1 text-right font-medium">7 days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.signals).map(([k, v]) => (
                      <tr key={k} className="border-t border-border">
                        <td className="py-1.5">{SIGNAL_LABELS[k] ?? k}</td>
                        <td className="py-1.5 text-right tabular-nums">{v.day}</td>
                        <td className="py-1.5 text-right tabular-nums">{v.week}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Temporary blocks</h2>
                {data.blocks.length === 0 ? (
                  <p className="text-sm text-muted">No blocks. Add one from an inquiry (email or network, 1 hour to 30 days).</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border border-y border-border text-sm">
                    {data.blocks.map((b) => (
                      <li key={b.id} className="flex items-center justify-between gap-3 py-2">
                        <div>
                          <p className="font-medium">
                            {b.kind === "email" ? "Email" : "Network"}: {b.label}
                          </p>
                          <p className="text-xs text-muted">
                            {b.active ? `Until ${fmt(b.expires_at)}` : b.removed_at ? `Removed by ${b.removed_by_label ?? "admin"}` : "Expired"} · added by {b.created_by_label ?? "admin"}
                            {b.reason ? ` · ${b.reason}` : ""}
                          </p>
                        </div>
                        {b.active && (
                          <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => act({ action: "unblock", blockId: b.id }, "Remove this block?")}>
                            Remove
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section data-tour="sec-staff">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Staff accounts</h2>
              <p className="mb-2 text-xs text-muted">Roles now come only from server-set account data. Two-factor shows verified authenticator apps.</p>
              <ul className="flex flex-col divide-y divide-border border-y border-border text-sm">
                {data.staff.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>{s.email ?? s.id}</span>
                    <span className="flex flex-wrap items-center gap-3 text-xs text-muted">
                      <span className="uppercase tracking-wide">{s.role}</span>
                      <span className={s.factors ? "text-status-approved" : "text-status-urgent"}>{s.factors ? `2FA on (${s.factors})` : "2FA off"}</span>
                      <span>Last sign-in {fmt(s.lastSignIn)}</span>
                      {s.userMetadataRole && <span className="text-status-declined">Profile claims “{s.userMetadataRole}” — not trusted</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section data-tour="sec-history">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Security history</h2>
              <ul className="flex max-h-[420px] flex-col divide-y divide-border overflow-y-auto border-y border-border text-sm">
                {data.history.map((h) => (
                  <li key={h.id} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5">
                    <span>
                      {ACTION_LABELS[h.action] ?? h.action}
                      {typeof h.details?.email === "string" ? <span className="text-muted"> · {h.details.email}</span> : null}
                      {typeof h.details?.reason === "string" ? <span className="text-muted"> · {h.details.reason}</span> : null}
                    </span>
                    <span className="text-xs text-muted">
                      {h.actor_label ? `${h.actor_label} · ` : ""}
                      {fmt(h.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </>
  );
}

function SubmissionCard({ r, busy, act }: { r: Row; busy: string | null; act: (p: Record<string, unknown>, c?: string) => Promise<void> }) {
  const [blockHours, setBlockHours] = useState(24);
  const isBusy = !!busy && busy.includes(r.id);
  return (
    <div className="flex flex-col gap-3 py-4 lg:flex-row lg:justify-between">
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {r.name} <span className="text-sm font-normal text-muted">· {r.email}</span>
        </p>
        <p className="text-sm text-muted">
          {r.kind === "consultation" ? `Consultation call ${fmt(r.slot_start)}` : `${r.event_type ?? "Event"} · ${fmtDate(r.event_date)}`}
          {r.venue_name ? ` · ${r.venue_name}` : ""}
          {r.expected_guests ? ` · ${r.expected_guests} guests` : ""}
          {r.budget_range ? ` · ${r.budget_range}` : ""}
          {` · via ${r.source === "wordpress" ? "digitalcratedjs.com" : r.source === "scheduler" ? "Book a Call" : "cratesdjs.com"}`}
        </p>
        {r.message && <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm">{r.message}</p>}
        {r.risk_reasons.length > 0 && (
          <ul className="mt-2 flex flex-col gap-0.5 text-xs text-status-urgent">
            {r.risk_reasons.map((x) => (
              <li key={x}>• {x}</li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted">
          Submitted {fmt(r.created_at)} · Confirmation emails: {r.verification_sent_count}
          {r.last_verification_sent_at ? ` (last ${fmt(r.last_verification_sent_at)})` : ""} · Email {r.verified_at ? `confirmed ${fmt(r.verified_at)}` : "not confirmed"}
          {r.event_id ? " · Lead created" : ""}
          {r.reviewed_by_label ? ` · Reviewed by ${r.reviewed_by_label} ${fmt(r.reviewed_at)}` : ""}
          {r.review_note ? ` · ${r.review_note}` : ""}
        </p>
      </div>
      <div data-tour="sec-actions" className="flex shrink-0 flex-wrap items-start gap-2 lg:max-w-[340px] lg:justify-end">
        {!r.event_id && r.status !== "spam" && (
          <Button
            size="sm"
            variant="primary"
            disabled={isBusy}
            onClick={() => act({ action: "approve", id: r.id }, r.verified_at ? undefined : "This email hasn't been confirmed. Approve anyway? This is recorded as a manual override.")}
          >
            Approve
          </Button>
        )}
        {!r.event_id && r.status !== "spam" && (
          <Button size="sm" variant="destructive" disabled={isBusy} onClick={() => act({ action: "spam", id: r.id }, "Mark this inquiry as spam?")}>
            Mark spam
          </Button>
        )}
        {(r.status === "spam" || r.status === "archived") && (
          <Button size="sm" variant="secondary" disabled={isBusy} onClick={() => act({ action: "restore", id: r.id })}>
            Restore
          </Button>
        )}
        {!r.verified_at && r.status !== "spam" && r.status !== "archived" && (
          <Button size="sm" variant="secondary" disabled={isBusy} onClick={() => act({ action: "resend", id: r.id })}>
            Resend email
          </Button>
        )}
        {r.event_id && (
          <Link href={`/admin/events/${r.event_id}`} className="text-sm text-gold hover:underline">
            Open project →
          </Link>
        )}
        {!r.event_id && (
          <span className="flex items-center gap-1">
            <select
              aria-label="Block length"
              value={blockHours}
              onChange={(e) => setBlockHours(Number(e.target.value))}
              className="h-8 rounded-[2px] border border-black/15 bg-panel px-1 text-xs"
            >
              <option value={1}>1 h</option>
              <option value={24}>24 h</option>
              <option value={168}>7 days</option>
              <option value={720}>30 days</option>
            </select>
            <Button size="sm" variant="secondary" disabled={isBusy} onClick={() => act({ action: "block", id: r.id, kind: "email", hours: blockHours }, `Block this email address for ${blockHours} hours?`)}>
              Block email
            </Button>
            <Button size="sm" variant="secondary" disabled={isBusy} onClick={() => act({ action: "block", id: r.id, kind: "source", hours: blockHours }, `Block this network for ${blockHours} hours? Others sharing it (an office, school or phone carrier) are blocked too.`)}>
              Block network
            </Button>
          </span>
        )}
      </div>
    </div>
  );
}

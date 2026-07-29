"use client";

import { Suspense, useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { Tabs } from "@/components/ui/tabs";
import { ArrowLeft, X, CalendarDays, FileText } from "lucide-react";

interface EventDetail {
  id: string;
  title: string;
  starts_at: string | null;
  status: string;
  event_type: string | null;
  service_type: string | null;
  expected_guests: number | null;
  must_play: string[] | null;
  do_not_play: string[] | null;
  special_requests: string | null;
  quoted_amount: number | null;
  final_amount: number | null;
  deposit_amount: number | null;
  contract_sent_at: string | null;
  contract_signed_at: string | null;
  contract_signed_by: string | null;
  contract_document_url: string | null;
  djs: { display_name: string } | null;
  venues: { name: string } | null;
}

interface Balance {
  totalDueCents: number;
  paidCents: number;
  balanceCents: number;
}

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "files", label: "Files" },
  { key: "payment", label: "Payment" },
  { key: "services", label: "Services" }
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function PortalEventPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-2xl px-4 py-12 text-sm text-muted">Loading...</div>}>
      <PortalEventPageInner params={params} />
    </Suspense>
  );
}

function PortalEventPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get("tab") as TabKey | null) ?? "overview";

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [mustPlay, setMustPlay] = useState<string[]>([]);
  const [doNotPlay, setDoNotPlay] = useState<string[]>([]);
  const [specialRequests, setSpecialRequests] = useState("");
  const [newMustPlay, setNewMustPlay] = useState("");
  const [newDoNotPlay, setNewDoNotPlay] = useState("");

  const [signName, setSignName] = useState("");
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch(`/api/portal/events/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load event");
      setEvent(data.event);
      setBalance(data.balance);
      setMustPlay(data.event.must_play ?? []);
      setDoNotPlay(data.event.do_not_play ?? []);
      setSpecialRequests(data.event.special_requests ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch(`/api/portal/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mustPlay, doNotPlay, specialRequests })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSign() {
    if (signName.trim().length < 2) {
      setSignError("Enter your full legal name.");
      return;
    }
    setSigning(true);
    setSignError(null);
    try {
      const res = await fetch(`/api/portal/events/${id}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: signName.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to sign");
      await load();
    } catch (err) {
      setSignError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSigning(false);
    }
  }

  if (error && !event) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-sm text-status-declined">{error}</p>
        <Link href="/portal" className="mt-4 inline-block text-sm text-gold">← Back to your events</Link>
      </div>
    );
  }

  if (!event) {
    return <div className="mx-auto max-w-2xl px-4 py-12 text-sm text-muted">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 md:py-12">
      <Link href="/portal" className="mb-6 flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft size={14} /> Your events
      </Link>

      <h1 className="font-display text-4xl font-light">{event.title}</h1>
      <p className="mt-1 flex items-center gap-1 text-sm text-muted">
        <CalendarDays size={13} />
        {event.starts_at ? new Date(event.starts_at).toLocaleString() : "Date TBD"}
        {event.venues?.name ? ` · ${event.venues.name}` : ""}
        {event.djs?.display_name ? ` · ${event.djs.display_name}` : ""}
      </p>

      <Tabs items={TABS} active={activeTab} hrefFor={(key) => `/portal/events/${id}?tab=${key}`} className="mt-6" />

      {activeTab === "overview" && (
        <div className="mt-6 flex flex-col gap-4">
          <GlassCard className="flex flex-col gap-2">
            <p className="text-sm font-semibold">At a glance</p>
            <Row
              label="Contract"
              value={event.contract_signed_at ? "Signed" : event.contract_sent_at ? "Awaiting signature" : "Not sent yet"}
            />
            <Row
              label="Balance due"
              value={balance ? `$${(balance.balanceCents / 100).toFixed(2)}` : "—"}
            />
            <Row label="Night plan" value={`${mustPlay.length} must-play · ${doNotPlay.length} do-not-play`} />
          </GlassCard>
          {event.djs?.display_name && (
            <GlassCard className="flex flex-col gap-2">
              <p className="text-sm font-semibold">Your DJ</p>
              <p className="text-sm text-muted">{event.djs.display_name}</p>
            </GlassCard>
          )}
        </div>
      )}

      {activeTab === "files" && (
        <div className="mt-6">
          {event.contract_document_url ? (
            <GlassCard neon className="flex flex-col gap-3">
              <p className="text-sm font-semibold">Contract</p>
              <a
                href={event.contract_document_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-sm text-gold hover:underline"
              >
                <FileText size={14} /> View contract document
              </a>

              {event.contract_signed_at ? (
                <p className="text-sm text-status-approved">
                  Signed by {event.contract_signed_by} on {new Date(event.contract_signed_at).toLocaleDateString()}
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-muted">
                    Typing your full legal name below and clicking Sign counts as your electronic signature on this
                    contract.
                  </p>
                  <input
                    value={signName}
                    onChange={(e) => setSignName(e.target.value)}
                    placeholder="Your full legal name"
                    className="rounded-[2px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
                  />
                  {signError && <p className="text-xs text-status-declined">{signError}</p>}
                  <NeonButton color="gold" onClick={handleSign} disabled={signing} className="w-fit">
                    {signing ? "Signing..." : "Sign Contract"}
                  </NeonButton>
                </div>
              )}
            </GlassCard>
          ) : (
            <GlassCard className="flex flex-col gap-1">
              <p className="text-sm font-semibold">No files yet</p>
              <p className="text-sm text-muted">Your contract will show up here once it&rsquo;s sent.</p>
            </GlassCard>
          )}
        </div>
      )}

      {activeTab === "payment" && (
        <div className="mt-6">
          {balance && balance.totalDueCents > 0 ? (
            <GlassCard neon className="flex flex-col gap-3">
              <p className="text-sm font-semibold">Payment</p>
              <div className="flex flex-col gap-1 text-sm">
                <Row label="Total" value={`$${(balance.totalDueCents / 100).toFixed(2)}`} />
                <Row label="Paid so far" value={`$${(balance.paidCents / 100).toFixed(2)}`} />
                <Row label="Balance due" value={`$${(balance.balanceCents / 100).toFixed(2)}`} bold />
              </div>
              {balance.balanceCents > 0 && (
                <div className="flex flex-wrap gap-2">
                  {event.deposit_amount && balance.paidCents === 0 && (
                    <Link
                      href={`/portal/events/${id}/pay?kind=deposit&amount=${Math.min(Math.round(event.deposit_amount * 100), balance.balanceCents)}`}
                    >
                      <NeonButton color="gold">Pay Deposit (${event.deposit_amount.toFixed(2)})</NeonButton>
                    </Link>
                  )}
                  <Link href={`/portal/events/${id}/pay?kind=balance&amount=${balance.balanceCents}`}>
                    <NeonButton color="gold">Pay Full Balance (${(balance.balanceCents / 100).toFixed(2)})</NeonButton>
                  </Link>
                </div>
              )}
            </GlassCard>
          ) : (
            <GlassCard className="flex flex-col gap-1">
              <p className="text-sm font-semibold">Nothing due</p>
              <p className="text-sm text-muted">You&rsquo;re all paid up, or a total hasn&rsquo;t been set yet.</p>
            </GlassCard>
          )}
        </div>
      )}

      {activeTab === "services" && (
        <div className="mt-6 flex flex-col gap-4">
          {(event.event_type || event.service_type || event.expected_guests) && (
            <GlassCard className="flex flex-col gap-2">
              <p className="text-sm font-semibold">Your booking</p>
              {event.event_type && <Row label="Event type" value={event.event_type} />}
              {event.service_type && <Row label="Service" value={event.service_type} />}
              {event.expected_guests != null && <Row label="Expected guests" value={String(event.expected_guests)} />}
            </GlassCard>
          )}

          <p className="text-sm text-muted">
            Build your night — tell your DJ exactly what to play and what to skip. Changes save to your event
            automatically for the DJ to see.
          </p>

          <GlassCard neon className="flex flex-col gap-3">
            <p className="text-sm font-semibold">Must-Play List</p>
            <SongList items={mustPlay} onRemove={(i) => setMustPlay(mustPlay.filter((_, idx) => idx !== i))} />
            <div className="flex gap-2">
              <input
                value={newMustPlay}
                onChange={(e) => setNewMustPlay(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newMustPlay.trim()) {
                    e.preventDefault();
                    setMustPlay([...mustPlay, newMustPlay.trim()]);
                    setNewMustPlay("");
                  }
                }}
                placeholder="Song title — Artist"
                className="flex-1 rounded-[2px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
              />
              <button
                onClick={() => {
                  if (newMustPlay.trim()) {
                    setMustPlay([...mustPlay, newMustPlay.trim()]);
                    setNewMustPlay("");
                  }
                }}
                className="rounded-[2px] border border-black/10 px-4 text-sm font-medium hover:border-gold"
              >
                Add
              </button>
            </div>
          </GlassCard>

          <GlassCard className="flex flex-col gap-3">
            <p className="text-sm font-semibold">Do-Not-Play List</p>
            <SongList items={doNotPlay} onRemove={(i) => setDoNotPlay(doNotPlay.filter((_, idx) => idx !== i))} />
            <div className="flex gap-2">
              <input
                value={newDoNotPlay}
                onChange={(e) => setNewDoNotPlay(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newDoNotPlay.trim()) {
                    e.preventDefault();
                    setDoNotPlay([...doNotPlay, newDoNotPlay.trim()]);
                    setNewDoNotPlay("");
                  }
                }}
                placeholder="Song title — Artist"
                className="flex-1 rounded-[2px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
              />
              <button
                onClick={() => {
                  if (newDoNotPlay.trim()) {
                    setDoNotPlay([...doNotPlay, newDoNotPlay.trim()]);
                    setNewDoNotPlay("");
                  }
                }}
                className="rounded-[2px] border border-black/10 px-4 text-sm font-medium hover:border-gold"
              >
                Add
              </button>
            </div>
          </GlassCard>

          <GlassCard className="flex flex-col gap-2">
            <p className="text-sm font-semibold">Notes for your DJ</p>
            <textarea
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              placeholder="First dance song, timeline details, anything else your DJ should know..."
              className="min-h-[100px] w-full rounded-[2px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
            />
          </GlassCard>

          {error && <p className="text-sm text-status-declined">{error}</p>}
          {saved && <p className="text-sm text-status-approved">Saved.</p>}

          <NeonButton color="gold" onClick={handleSave} disabled={saving} className="w-fit">
            {saving ? "Saving..." : "Save changes"}
          </NeonButton>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "" : "text-muted"}>{label}</span>
      <span className={bold ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}

function SongList({ items, onRemove }: { items: string[]; onRemove: (index: number) => void }) {
  if (items.length === 0) {
    return <p className="text-xs text-muted">Nothing added yet.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, i) => (
        <span key={`${item}-${i}`} className="flex items-center gap-1.5 rounded-[2px] border border-black/10 bg-panel px-3 py-1.5 text-xs">
          {item}
          <button onClick={() => onRemove(i)} className="text-muted hover:text-status-declined">
            <X size={12} />
          </button>
        </span>
      ))}
    </div>
  );
}

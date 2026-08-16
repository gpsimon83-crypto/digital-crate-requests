"use client";

import { Suspense, use as usePromise, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import { Tabs } from "@/components/ui/tabs";
import { StatusChip, type StatusTone } from "@/components/ui/status-chip";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { DjAvatar } from "@/components/dashboard/dj-avatar";
import { money } from "@/lib/format";
import type { HeroSettings } from "@/lib/hero-settings";
import { ArrowLeft, CalendarDays, ChevronRight, FolderOpen, TrendingUp, Wallet, ExternalLink, Briefcase, DollarSign } from "lucide-react";

interface DjEvent {
  id: string;
  title: string;
  starts_at: string | null;
  status: string;
  final_amount: number | null;
  quoted_amount: number | null;
  venues: { name: string } | null;
}

interface DjDetail {
  id: string;
  display_name: string;
  auth_user_id: string | null;
  photo_url: string | null;
  hero_settings: Partial<HeroSettings> | null;
  events: DjEvent[];
}

interface FileRow {
  id: string;
  event_id: string;
  category: string;
  file_url: string;
  file_name: string;
  created_at: string;
  events: { title: string | null } | null;
}

interface PayoutRow {
  id: string;
  event_id: string;
  amount_cents: number;
  status: "pending" | "paid";
  paid_at: string | null;
  created_at: string;
  events: { title: string | null; starts_at: string | null } | null;
}

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "events", label: "Events" },
  { key: "performance", label: "Performance" },
  { key: "payments", label: "Payments" },
  { key: "documents", label: "Documents" }
] as const;
type TabKey = (typeof TABS)[number]["key"];

const PAYOUT_TONE: Record<string, StatusTone> = { pending: "pending", paid: "approved" };

export default function DjDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted">Loading...</div>}>
      <DjDetailInner params={params} />
    </Suspense>
  );
}

function DjDetailInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get("tab") as TabKey | null) ?? "overview";

  const [dj, setDj] = useState<DjDetail | null>(null);
  const [files, setFiles] = useState<FileRow[] | null>(null);
  const [payouts, setPayouts] = useState<PayoutRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/djs/${id}`)
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || "Failed to load DJ");
        setDj(data.dj);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."));

    fetch(`/api/admin/djs/${id}/files`)
      .then((r) => r.json())
      .then((data) => setFiles(data.files ?? []))
      .catch(() => setFiles([]));

    fetch(`/api/admin/djs/${id}/payouts`)
      .then((r) => r.json())
      .then((data) => setPayouts(data.payouts ?? []))
      .catch(() => setPayouts([]));
  }, [id]);

  if (error) {
    return (
      <div className="p-8">
        <p className="text-sm text-status-declined">{error}</p>
        <Link href="/admin/djs" className="mt-4 inline-block text-sm text-gold">
          ← Back to DJs
        </Link>
      </div>
    );
  }

  if (!dj) {
    return <div className="p-8 text-sm text-muted">Loading...</div>;
  }

  const events = [...dj.events].sort((a, b) => new Date(b.starts_at ?? 0).getTime() - new Date(a.starts_at ?? 0).getTime());
  const playedEvents = events.filter((e) => e.status === "ended" || e.status === "confirmed" || e.status === "live");
  const totalRevenueCents = playedEvents.reduce((sum, e) => sum + Math.round((e.final_amount ?? e.quoted_amount ?? 0) * 100), 0);
  const avgDealCents = playedEvents.length > 0 ? Math.round(totalRevenueCents / playedEvents.length) : 0;
  const totalPaidCents = (payouts ?? []).filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount_cents, 0);
  const totalPendingCents = (payouts ?? []).filter((p) => p.status === "pending").reduce((sum, p) => sum + p.amount_cents, 0);

  return (
    <div className="pb-16">
      <Link
        href="/admin/djs"
        className="ml-6 mt-5 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[1.5px] text-muted hover:text-foreground sm:ml-8"
      >
        <ArrowLeft size={14} /> DJs
      </Link>

      <div className="mx-6 mt-3 flex flex-col gap-4 sm:mx-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <DjAvatar name={dj.display_name} photoUrl={dj.photo_url} size={48} />
            <h1 className="font-display text-2xl font-light">{dj.display_name}</h1>
          </div>
          {dj.auth_user_id ? (
            <StatusChip tone="approved">Has Login</StatusChip>
          ) : (
            <StatusChip tone="pending">No Login</StatusChip>
          )}
        </div>

        <div className="flex flex-wrap border border-border">
          <StatTile icon={Briefcase} label="Total Gigs" value={playedEvents.length} />
          <StatTile icon={DollarSign} label="Total Revenue" value={money(totalRevenueCents)} />
          <StatTile icon={Wallet} label="Payouts Paid" value={money(totalPaidCents)} />
          <StatTile icon={Wallet} label="Payouts Pending" value={money(totalPendingCents)} tone={totalPendingCents > 0 ? "urgent" : "default"} />
        </div>

        <Tabs items={TABS} active={activeTab} hrefFor={(key) => `/admin/djs/${id}?tab=${key}`} />

        {activeTab === "overview" && (
          <GlassCard className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[1.5px] text-muted">Profile</p>
            <Row label="Dashboard login" value={dj.auth_user_id ? "Connected" : "Not set up"} />
            <Row label="Total events booked" value={String(events.length)} />
            <Row label="Hero photo" value={dj.photo_url ? "Uploaded" : "Not set"} />
          </GlassCard>
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
                        {e.venues?.name ? ` · ${e.venues.name}` : ""}
                      </p>
                    </div>
                    <ChevronRight size={14} className="shrink-0 text-muted group-hover:text-gold" />
                  </Link>
                ))}
              </div>
            )}
          </GlassCard>
        )}

        {activeTab === "performance" && (
          <GlassCard className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[1.5px] text-muted">Performance</p>
            <Row label="Gigs played" value={String(playedEvents.length)} />
            <Row label="Total revenue" value={money(totalRevenueCents)} />
            <Row label="Average deal size" value={money(avgDealCents)} />
            {playedEvents.length === 0 && (
              <p className="mt-2 text-sm text-muted">
                <TrendingUp size={13} className="mr-1 inline" />
                No completed gigs yet — stats will build up as events happen.
              </p>
            )}
          </GlassCard>
        )}

        {activeTab === "payments" && (
          <GlassCard className="flex flex-col gap-3">
            {payouts === null && <p className="text-sm text-muted">Loading…</p>}
            {payouts !== null && payouts.length === 0 && <EmptyState icon={Wallet} title="No payouts yet" />}
            {payouts !== null && payouts.length > 0 && (
              <div className="flex flex-col divide-y divide-border">
                {payouts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.events?.title ?? "Unknown event"}</p>
                      <p className="text-xs text-muted">{p.paid_at ? `Paid ${new Date(p.paid_at).toLocaleDateString()}` : "Not paid yet"}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-semibold tabular-nums">{money(p.amount_cents)}</span>
                      <StatusChip tone={PAYOUT_TONE[p.status] ?? "muted"} variant="dot">
                        {p.status}
                      </StatusChip>
                    </div>
                  </div>
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
                  <a key={f.id} href={f.file_url} target="_blank" rel="noreferrer" className="group flex items-center justify-between gap-3 py-2.5 first:pt-0">
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

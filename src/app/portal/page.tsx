"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import { DjAvatar } from "@/components/dashboard/dj-avatar";
import { createClient } from "@/lib/supabase/client";
import { pickPrimaryEvent } from "@/lib/portal-primary-event";
import { CalendarDays, User, LogOut } from "lucide-react";

interface EventRow {
  id: string;
  title: string;
  starts_at: string | null;
  status: string;
  quoted_amount: number | null;
  final_amount: number | null;
  must_play: string[] | null;
  do_not_play: string[] | null;
  contract_status: "none" | "draft" | "sent" | "signed" | "void";
  djs: { display_name: string; photo_url: string | null } | null;
  venues: { name: string } | null;
}

interface Balance {
  totalDueCents: number;
  paidCents: number;
  balanceCents: number;
}

function contractLabel(e: EventRow) {
  if (e.contract_status === "signed") return { text: "Signed", tone: "text-status-approved" };
  if (e.contract_status === "sent") return { text: "Awaiting signature", tone: "text-status-pending" };
  return { text: "Not sent yet", tone: "text-muted" };
}

function timeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function PortalHomePage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState<string | null>(null);
  const [hasClient, setHasClient] = useState<boolean | null>(null);
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/portal/me");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load your portal");
        setFirstName(data.client?.first_name ?? null);
        setHasClient(!!data.client);
        setEvents(data.events ?? []);

        const primary = pickPrimaryEvent(data.events ?? []);
        if (primary) {
          const detailRes = await fetch(`/api/portal/events/${primary.id}`);
          const detail = await detailRes.json();
          if (detailRes.ok) setBalance(detail.balance);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    })();
  }, []);

  const primaryEvent = events ? pickPrimaryEvent(events) : null;
  const nightPlanCount = (primaryEvent?.must_play?.length ?? 0) + (primaryEvent?.do_not_play?.length ?? 0);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/portal/login");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:py-12">
      <div className="mb-4 flex justify-end">
        <button onClick={handleSignOut} className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground">
          <LogOut size={12} /> Sign out
        </button>
      </div>

      {error && <p className="mb-6 text-sm text-status-declined">{error}</p>}

      {hasClient === false && (
        <GlassCard>
          <p className="font-semibold">No event found on this account yet.</p>
          <p className="mt-2 text-sm text-muted">
            If you&rsquo;ve already booked with us, make sure you signed up with the same email you used on your booking
            request. Otherwise, reach out and we&rsquo;ll get your event connected.
          </p>
        </GlassCard>
      )}

      {primaryEvent && (
        <GlassCard neon className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            {primaryEvent.djs ? (
              <DjAvatar name={primaryEvent.djs.display_name} photoUrl={primaryEvent.djs.photo_url} size={60} />
            ) : (
              <span className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--gold-light)] to-[var(--gold-dim)] text-black">
                <User size={28} />
              </span>
            )}
            <div>
              <p className="font-display text-2xl font-light">
                {timeOfDayGreeting()}
                {firstName ? `, ${firstName}` : ""}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-sm text-muted">
                <CalendarDays size={13} />
                {primaryEvent.starts_at ? new Date(primaryEvent.starts_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "Date TBD"}
                {" · "}
                {primaryEvent.djs?.display_name ?? "DJ not yet assigned"}
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {primaryEvent && (
        <div className="mb-8 grid grid-cols-3 divide-x divide-border border-y border-border">
          <div className="px-4 py-4 text-center sm:text-left">
            <p className="text-[10px] uppercase tracking-[1.5px] text-muted">Contract</p>
            <p className={`mt-1 text-sm font-semibold ${contractLabel(primaryEvent).tone}`}>
              {contractLabel(primaryEvent).text}
            </p>
          </div>
          <div className="px-4 py-4 text-center sm:text-left">
            <p className="text-[10px] uppercase tracking-[1.5px] text-muted">Balance due</p>
            <p className="mt-1 text-sm font-semibold">
              {balance ? `$${(balance.balanceCents / 100).toFixed(2)}` : "—"}
            </p>
          </div>
          <div className="px-4 py-4 text-center sm:text-left">
            <p className="text-[10px] uppercase tracking-[1.5px] text-muted">Night plan</p>
            <p className="mt-1 text-sm font-semibold">{nightPlanCount > 0 ? `${nightPlanCount} songs added` : "Not started"}</p>
          </div>
        </div>
      )}

      {events && events.length === 0 && hasClient && (
        <GlassCard>
          <p className="text-sm text-muted">No events on file yet.</p>
        </GlassCard>
      )}

      {events && events.length > 0 && (
        <>
          <p className="mb-2 text-xs uppercase tracking-[1.5px] text-muted">All events</p>
          <div className="flex flex-col divide-y divide-border border-y border-border">
            {events.map((e) => (
              <Link
                key={e.id}
                href={`/portal/events/${e.id}`}
                className="flex items-center justify-between px-1 py-4 transition-colors hover:bg-gold/[0.04]"
              >
                <div>
                  <p className="font-semibold">{e.title}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                    <CalendarDays size={12} />
                    {e.starts_at ? new Date(e.starts_at).toLocaleDateString() : "Date TBD"}
                    {e.venues?.name ? ` · ${e.venues.name}` : ""}
                    {e.djs?.display_name ? ` · ${e.djs.display_name}` : ""}
                  </p>
                </div>
                <span className="text-xs uppercase tracking-wide text-gold">{e.status.replace(/_/g, " ")}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

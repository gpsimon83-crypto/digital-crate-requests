"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import { Logo } from "@/components/site/logo";
import { createClient } from "@/lib/supabase/client";
import { CalendarDays, LogOut } from "lucide-react";

interface EventRow {
  id: string;
  title: string;
  starts_at: string | null;
  status: string;
  djs: { display_name: string } | null;
  venues: { name: string } | null;
}

export default function PortalHomePage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [hasClient, setHasClient] = useState<boolean | null>(null);
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/portal/me");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load your portal");
        setEmail(data.user?.email ?? null);
        setHasClient(!!data.client);
        setEvents(data.events ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    })();
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/portal/login");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo variant="icon" brand="crates-djs" size={28} />
          <h1 className="text-xl font-bold">Events Portal</h1>
        </div>
        <button onClick={handleSignOut} className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
          <LogOut size={14} /> Sign out
        </button>
      </div>

      {email && <p className="mb-6 text-sm text-muted">Signed in as {email}</p>}
      {error && <p className="text-sm text-status-declined">{error}</p>}

      {hasClient === false && (
        <GlassCard>
          <p className="font-semibold">No event found on this account yet.</p>
          <p className="mt-2 text-sm text-muted">
            If you&rsquo;ve already booked with us, make sure you signed up with the same email you used on your booking
            request. Otherwise, reach out and we&rsquo;ll get your event connected.
          </p>
        </GlassCard>
      )}

      {events && events.length === 0 && hasClient && (
        <GlassCard>
          <p className="text-sm text-muted">No events on file yet.</p>
        </GlassCard>
      )}

      <div className="flex flex-col gap-3">
        {events?.map((e) => (
          <Link key={e.id} href={`/portal/events/${e.id}`}>
            <GlassCard className="flex items-center justify-between hover:bg-black/[0.02]">
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
            </GlassCard>
          </Link>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { Logo } from "@/components/site/logo";
import { DjAvatar } from "@/components/dashboard/dj-avatar";
import { Check, X, LogOut, ShieldCheck, CalendarClock, MapPin, Plus, PartyPopper } from "lucide-react";

interface VenueOption {
  id: string;
  name: string;
}

interface EventRow {
  id: string;
  event_code: string;
  title: string;
  starts_at: string | null;
  status: string;
  dj_id: string | null;
  djs: { display_name: string; photo_url: string | null } | null;
  venues: { name: string } | null;
}

export default function DjBookingsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [djName, setDjName] = useState<string | null>(null);
  const [djPhoto, setDjPhoto] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [venues, setVenues] = useState<VenueOption[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newVenueId, setNewVenueId] = useState("");
  const [newStartsAt, setNewStartsAt] = useState("");
  const [creating, setCreating] = useState(false);
  const [addingVenue, setAddingVenue] = useState(false);
  const [newVenueName, setNewVenueName] = useState("");
  const [newVenueLocation, setNewVenueLocation] = useState("");
  const [savingVenue, setSavingVenue] = useState(false);

  async function load() {
    try {
      const meRes = await fetch("/api/me");
      const meData = await meRes.json();
      if (!meRes.ok) throw new Error(meData.error || "Not signed in");

      const admin = meData.user?.role === "admin";
      setIsAdmin(admin);

      if (!admin && !meData.dj) {
        setError("Your login isn't linked to a DJ profile yet. Ask your admin to link it.");
        setEvents([]);
        return;
      }
      setDjName(admin ? "Admin" : meData.dj?.display_name ?? null);
      setDjPhoto(meData.dj?.photo_url ?? null);

      const res = await fetch("/api/admin/events");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load bookings");

      const rows: EventRow[] = data.events ?? [];
      setEvents(admin ? rows : rows.filter((e) => e.dj_id === meData.dj.id));

      const venuesRes = await fetch("/api/admin/venues");
      const venuesData = await venuesRes.json();
      if (venuesRes.ok) setVenues(venuesData.venues ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreateEvent() {
    if (!newTitle.trim() || !newStartsAt) {
      setError("Title and date/time are required.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/dj/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          venueId: newVenueId || undefined,
          startsAt: new Date(newStartsAt).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create event");
      setNewTitle("");
      setNewVenueId("");
      setNewStartsAt("");
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setCreating(false);
    }
  }

  async function handleAddVenue() {
    if (!newVenueName.trim()) return;
    setSavingVenue(true);
    setError(null);
    try {
      const res = await fetch("/api/dj/venues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newVenueName.trim(), location: newVenueLocation.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add venue");
      setVenues((v) => [...v, { id: data.venue.id, name: data.venue.name }]);
      setNewVenueId(data.venue.id);
      setNewVenueName("");
      setNewVenueLocation("");
      setAddingVenue(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSavingVenue(false);
    }
  }

  async function respond(id: string, action: "confirm" | "decline") {
    setActingId(id);
    try {
      await fetch(`/api/events/${id}/${action}`, { method: "POST" });
      await load();
    } finally {
      setActingId(null);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/dj-dashboard/login");
    router.refresh();
  }

  const pending = events?.filter((e) => e.status === "pending_confirmation") ?? [];
  const upcoming = events?.filter((e) => e.status === "confirmed") ?? [];

  return (
    <div className="min-h-dvh bg-background">
      <header className="flex items-center justify-between border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))] px-6 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          {!isAdmin && djName ? (
            <DjAvatar name={djName} photoUrl={djPhoto} size={38} />
          ) : (
            <span className="glow-ring">
              <Logo variant="icon" color="gold" size={30} />
            </span>
          )}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[2.5px] text-muted">
              {djName ? djName : "Digital Crate DJs"}
            </p>
            <p className="gold-text-gradient text-base font-extrabold tracking-tight">
              {isAdmin ? "All Bookings" : "My Bookings"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link
              href="/admin"
              className="flex items-center gap-1.5 rounded-full border border-gold/40 px-3.5 py-2 text-xs font-semibold text-gold transition-colors hover:bg-gold/10"
            >
              <ShieldCheck size={14} /> Admin Panel
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-full border border-white/12 px-3.5 py-2 text-xs font-medium text-muted transition-colors hover:border-white/25 hover:text-foreground"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </header>

      <main className="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-10 sm:px-8">
        {error && (
          <GlassCard className="border-status-declined/30 text-sm text-status-declined">{error}</GlassCard>
        )}

        {!isAdmin && (
          <section>
            {!showCreate ? (
              <button
                onClick={() => setShowCreate(true)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-gold/35 bg-gold/5 py-4 text-sm font-semibold text-gold transition-colors hover:bg-gold/10 sm:w-fit sm:px-8"
              >
                <Plus size={16} /> Create Event
              </button>
            ) : (
              <GlassCard neon className="flex flex-col gap-4">
                <p className="text-sm font-semibold uppercase tracking-wide text-muted">New Event</p>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Event title"
                  className="w-full rounded-xl border border-white/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="datetime-local"
                    value={newStartsAt}
                    onChange={(e) => setNewStartsAt(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
                  />
                  <select
                    value={newVenueId}
                    onChange={(e) => {
                      if (e.target.value === "__add_new__") {
                        setAddingVenue(true);
                        return;
                      }
                      setNewVenueId(e.target.value);
                    }}
                    className="w-full rounded-xl border border-white/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
                  >
                    <option value="">No venue</option>
                    {venues.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                    <option value="__add_new__">+ Add new venue...</option>
                  </select>
                </div>

                {addingVenue && (
                  <div className="flex flex-col gap-2 rounded-xl border border-gold/30 bg-panel p-3">
                    <input
                      value={newVenueName}
                      onChange={(e) => setNewVenueName(e.target.value)}
                      placeholder="Venue name"
                      className="w-full rounded-lg border border-white/10 bg-background px-3 py-2 text-sm focus:border-gold focus:outline-none"
                    />
                    <input
                      value={newVenueLocation}
                      onChange={(e) => setNewVenueLocation(e.target.value)}
                      placeholder="Location (city, state)"
                      className="w-full rounded-lg border border-white/10 bg-background px-3 py-2 text-sm focus:border-gold focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddVenue}
                        disabled={savingVenue}
                        className="rounded-full bg-gold px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
                      >
                        {savingVenue ? "Saving..." : "Save Venue"}
                      </button>
                      <button
                        onClick={() => setAddingVenue(false)}
                        className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <NeonButton color="gold" onClick={handleCreateEvent} disabled={creating} className="px-4 py-2 text-xs">
                    {creating ? "Creating..." : "Create Event"}
                  </NeonButton>
                  <button
                    onClick={() => setShowCreate(false)}
                    className="rounded-full border border-white/15 px-4 py-2 text-xs text-muted hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </GlassCard>
            )}
          </section>
        )}

        <section>
          <SectionHeading label="Awaiting Your Confirmation" count={pending.length} />
          {events === null && <p className="text-sm text-muted">Loading...</p>}
          {events !== null && pending.length === 0 && !error && (
            <EmptyState text="Nothing needs your confirmation right now." />
          )}
          <div className="flex flex-col gap-3">
            {pending.map((e) => (
              <GlassCard key={e.id} neon className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <EventInfo event={e} isAdmin={isAdmin} />
                <div className="flex gap-2">
                  <button
                    disabled={actingId === e.id}
                    onClick={() => respond(e.id, "confirm")}
                    className="flex items-center gap-1.5 rounded-full bg-status-approved px-4 py-2.5 text-xs font-bold text-black transition-transform hover:scale-[1.02] disabled:opacity-50"
                  >
                    <Check size={14} /> Confirm
                  </button>
                  <button
                    disabled={actingId === e.id}
                    onClick={() => respond(e.id, "decline")}
                    className="flex items-center gap-1.5 rounded-full bg-status-declined px-4 py-2.5 text-xs font-bold text-white transition-transform hover:scale-[1.02] disabled:opacity-50"
                  >
                    <X size={14} /> Decline
                  </button>
                </div>
              </GlassCard>
            ))}
          </div>
        </section>

        <section>
          <SectionHeading label="Confirmed Upcoming Events" count={upcoming.length} />
          {events !== null && upcoming.length === 0 && !error && (
            <EmptyState text="No confirmed events yet." />
          )}
          <div className="flex flex-col gap-3">
            {upcoming.map((e) => (
              <GlassCard
                key={e.id}
                className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <EventInfo event={e} isAdmin={isAdmin} showCode />
                <span className="status-badge approved shrink-0">Confirmed</span>
              </GlassCard>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function SectionHeading({ label, count }: { label: string; count: number }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted">{label}</p>
      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] font-semibold text-gold">
        {count}
      </span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <GlassCard className="flex flex-col items-center gap-2 py-8 text-center">
      <PartyPopper size={22} className="text-gold/70" />
      <p className="text-sm text-muted">{text}</p>
    </GlassCard>
  );
}

function EventInfo({
  event: e,
  isAdmin,
  showCode = false,
}: {
  event: EventRow;
  isAdmin: boolean;
  showCode?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      {isAdmin && e.djs && <DjAvatar name={e.djs.display_name} photoUrl={e.djs.photo_url} size={36} className="mt-0.5" />}
      <div className="min-w-0">
        <p className="text-base font-bold">{e.title}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          {isAdmin && <span>{e.djs?.display_name ?? "Unassigned"}</span>}
          <span className="flex items-center gap-1">
            <MapPin size={12} /> {e.venues?.name ?? "No venue"}
          </span>
          <span className="flex items-center gap-1">
            <CalendarClock size={12} />
            {e.starts_at ? new Date(e.starts_at).toLocaleString() : "No date set"}
          </span>
        </div>
        {showCode && (
          <p className="mt-2 flex items-center gap-2 font-mono text-xs">
            <span className="rounded-md border border-gold/30 bg-gold/5 px-2 py-0.5 tracking-wide text-gold">
              {e.event_code}
            </span>
            <Link
              href={`/dj-dashboard/${e.event_code}`}
              className="text-muted underline underline-offset-2 hover:text-foreground"
            >
              Open Event →
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

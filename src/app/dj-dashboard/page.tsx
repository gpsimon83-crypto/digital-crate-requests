"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { DjAvatar } from "@/components/dashboard/dj-avatar";
import { GlassCard } from "@/components/ui/glass-card";
import {
  CalendarClock,
  Boxes,
  UserCircle,
  ShieldCheck,
  LogOut,
  ChevronRight,
  MapPin,
  CheckSquare,
  Check,
  X,
  PartyPopper
} from "lucide-react";
import { isStaffRole } from "@/lib/roles";
import { cn } from "@/lib/utils";

interface Tile {
  href: string;
  label: string;
  desc: string;
  icon: React.ComponentType<{ size?: number }>;
}

interface EventRow {
  id: string;
  title: string;
  starts_at: string | null;
  status: string;
  dj_id: string | null;
  venues: { name: string } | null;
}

interface TaskRow {
  id: string;
  event_id: string;
  title: string;
  due_date: string | null;
  completed_at: string | null;
}

export default function DjPortalHomePage() {
  const router = useRouter();
  const [djId, setDjId] = useState<string | null>(null);
  const [djName, setDjName] = useState<string | null>(null);
  const [djPhoto, setDjPhoto] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [tasks, setTasks] = useState<TaskRow[] | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  function load() {
    fetch("/api/me")
      .then((r) => r.json())
      .then((meData) => {
        const admin = isStaffRole(meData?.user?.role);
        setIsAdmin(admin);
        setDjName(meData?.dj?.display_name ?? null);
        setDjPhoto(meData?.dj?.photo_url ?? null);
        setDjId(meData?.dj?.id ?? null);
        setLoaded(true);

        if (admin || !meData?.dj?.id) return;

        fetch("/api/admin/events")
          .then((r) => (r.ok ? r.json() : { events: [] }))
          .then((eventsData) => {
            const mine: EventRow[] = (eventsData.events ?? []).filter((e: EventRow) => e.dj_id === meData.dj.id);
            setEvents(mine);

            const upcomingConfirmed = mine
              .filter((e) => e.status === "confirmed")
              .sort((a, b) => new Date(a.starts_at ?? 0).getTime() - new Date(b.starts_at ?? 0).getTime())
              .slice(0, 5);

            Promise.all(
              upcomingConfirmed.map((e) =>
                fetch(`/api/events/${e.id}/tasks`)
                  .then((r) => (r.ok ? r.json() : { tasks: [] }))
                  .then((d) => d.tasks as TaskRow[])
                  .catch(() => [] as TaskRow[])
              )
            ).then((taskLists) => setTasks(taskLists.flat().filter((t) => !t.completed_at)));
          });
      })
      .catch(() => setLoaded(true));
  }

  useEffect(load, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/dj-dashboard/login");
    router.refresh();
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

  const adminTiles: Tile[] = [
    { href: "/dj-dashboard/bookings", label: "All Bookings", desc: "See and manage every event.", icon: CalendarClock },
    { href: "/dj-dashboard/profile", label: "My Profile", desc: "Every admin control, in one place.", icon: UserCircle },
    { href: "/admin", label: "Admin Panel", desc: "Manage DJs, venues, events, and invite codes.", icon: ShieldCheck }
  ];

  const pending = (events ?? []).filter((e) => e.status === "pending_confirmation");
  const upcoming = (events ?? [])
    .filter((e) => e.status === "confirmed")
    .sort((a, b) => new Date(a.starts_at ?? 0).getTime() - new Date(b.starts_at ?? 0).getTime());
  const openTasks = [...(tasks ?? [])].sort((a, b) => new Date(a.due_date ?? "9999").getTime() - new Date(b.due_date ?? "9999").getTime());

  return (
    <div className="min-h-dvh bg-background">
      <PageHeader
        title={loaded ? `Welcome${djName ? `, ${djName}` : ""}` : "Welcome"}
        subtitle={isAdmin ? "Digital Crate Requests — pick where you want to go." : "Here's what's on deck."}
        action={
          <div className="flex items-center gap-3">
            {djName && <DjAvatar name={djName} photoUrl={djPhoto} size={32} />}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-[2px] border border-black/12 px-3.5 py-2 text-xs font-medium text-muted transition-colors hover:border-black/25 hover:text-foreground"
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        }
      />

      {isAdmin && (
        <main className="mx-auto max-w-2xl px-6 py-8 sm:px-8">
          {loaded && (
            <div className="flex flex-col divide-y divide-border border-y border-border">
              {adminTiles.map(({ href, label, desc, icon: Icon }, i) => (
                <Link
                  key={href}
                  href={href}
                  style={{ "--menu-fade-delay": `${i * 60}ms` } as React.CSSProperties}
                  className="menu-fade-item group flex items-center gap-4 py-4 transition-colors hover:bg-gold/[0.04]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-gold/30 text-gold">
                    <Icon size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium group-hover:text-gold">{label}</p>
                    <p className="text-sm text-muted">{desc}</p>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-muted group-hover:text-gold" />
                </Link>
              ))}
            </div>
          )}
        </main>
      )}

      {!isAdmin && loaded && !djId && (
        <main className="mx-auto max-w-2xl px-6 py-8 sm:px-8">
          <GlassCard className="text-sm text-muted">Your login isn&apos;t linked to a DJ profile yet. Ask your admin to link it.</GlassCard>
        </main>
      )}

      {!isAdmin && djId && (
        <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-8 sm:px-8">
          {pending.length > 0 && (
            <section>
              <SectionHeading label="Awaiting Your Confirmation" count={pending.length} />
              <div className="flex flex-col gap-3">
                {pending.map((e) => (
                  <GlassCard key={e.id} neon className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-base font-bold">{e.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                        <span className="flex items-center gap-1">
                          <MapPin size={12} /> {e.venues?.name ?? "No venue"}
                        </span>
                        <span className="flex items-center gap-1">
                          <CalendarClock size={12} /> {e.starts_at ? new Date(e.starts_at).toLocaleString() : "No date set"}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        disabled={actingId === e.id}
                        onClick={() => respond(e.id, "confirm")}
                        className="flex items-center gap-1.5 rounded-[2px] bg-status-approved px-4 py-2.5 text-xs font-bold text-black transition-transform hover:scale-[1.02] disabled:opacity-50"
                      >
                        <Check size={14} /> Confirm
                      </button>
                      <button
                        disabled={actingId === e.id}
                        onClick={() => respond(e.id, "decline")}
                        className="flex items-center gap-1.5 rounded-[2px] bg-status-declined px-4 py-2.5 text-xs font-bold text-white transition-transform hover:scale-[1.02] disabled:opacity-50"
                      >
                        <X size={14} /> Decline
                      </button>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </section>
          )}

          <section>
            <SectionHeading label="Upcoming Events" count={upcoming.length} />
            {upcoming.length === 0 ? (
              <GlassCard className="flex flex-col items-center gap-2 py-8 text-center">
                <PartyPopper size={22} className="text-gold/70" />
                <p className="text-sm text-muted">No confirmed events on the calendar yet.</p>
              </GlassCard>
            ) : (
              <div className="flex flex-col gap-3">
                {upcoming.slice(0, 5).map((e) => (
                  <Link key={e.id} href={`/dj-dashboard/projects/${e.id}`} className="block">
                    <GlassCard className="flex items-center justify-between gap-4 transition-colors hover:border-gold/30">
                      <div className="min-w-0">
                        <p className="text-base font-bold">{e.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                          <span className="flex items-center gap-1">
                            <MapPin size={12} /> {e.venues?.name ?? "No venue"}
                          </span>
                          <span className="flex items-center gap-1">
                            <CalendarClock size={12} /> {e.starts_at ? new Date(e.starts_at).toLocaleString() : "No date set"}
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={16} className="shrink-0 text-muted" />
                    </GlassCard>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {openTasks.length > 0 && (
            <section>
              <SectionHeading label="Tasks Needing Attention" count={openTasks.length} />
              <div className="flex flex-col divide-y divide-border border-y border-border">
                {openTasks.slice(0, 8).map((t) => {
                  const event = events?.find((e) => e.id === t.event_id);
                  const overdue = t.due_date ? new Date(t.due_date) < new Date() : false;
                  return (
                    <Link
                      key={t.id}
                      href={`/dj-dashboard/projects/${t.event_id}`}
                      className="flex items-center gap-3 py-3 transition-colors hover:bg-gold/[0.04]"
                    >
                      <CheckSquare size={15} className={cn("shrink-0", overdue ? "text-status-declined" : "text-muted")} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{t.title}</p>
                        <p className="text-xs text-muted">
                          {event?.title ?? "Event"}
                          {t.due_date && <span className={overdue ? "text-status-declined" : ""}> · Due {new Date(t.due_date).toLocaleDateString()}</span>}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          <section className="flex flex-wrap gap-3">
            <QuickLink href="/dj-dashboard/bookings" label="My Bookings" icon={CalendarClock} />
            <QuickLink href="/dj-dashboard/library" label="Crate Builder" icon={Boxes} />
            <QuickLink href="/dj-dashboard/profile" label="My Profile" icon={UserCircle} />
          </section>
        </main>
      )}
    </div>
  );
}

function SectionHeading({ label, count }: { label: string; count: number }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted">{label}</p>
      <span className="rounded-[2px] border border-black/10 px-2 py-0.5 text-[11px] font-semibold text-gold">{count}</span>
    </div>
  );
}

function QuickLink({ href, label, icon: Icon }: { href: string; label: string; icon: React.ComponentType<{ size?: number }> }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-[2px] border border-black/12 px-4 py-2.5 text-xs font-medium text-muted transition-colors hover:border-gold/40 hover:text-gold"
    >
      <Icon size={14} /> {label}
    </Link>
  );
}

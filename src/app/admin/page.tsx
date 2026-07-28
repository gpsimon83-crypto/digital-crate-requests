"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import {
  Briefcase,
  Users,
  FileText,
  CalendarClock,
  Sparkles,
  Zap,
  Magnet,
  ArrowRight
} from "lucide-react";

interface EventRow {
  id: string;
  title: string;
  status: string;
  starts_at: string | null;
  created_at: string;
  quoted_amount: number | null;
  final_amount: number | null;
  contract_sent_at: string | null;
  contract_signed_at: string | null;
  clients: { company_name: string | null; first_name: string | null; last_name: string | null } | null;
}

interface Me {
  user: { email: string | null };
  dj: { display_name: string } | null;
}

function greetingName(me: Me | null) {
  if (!me) return "";
  if (me.dj?.display_name) return me.dj.display_name;
  const local = me.user.email?.split("@")[0] ?? "";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function timeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function clientName(c: EventRow["clients"]) {
  if (!c) return "No client";
  return c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed client";
}

export default function AdminOverviewPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [events, setEvents] = useState<EventRow[] | null>(null);

  useEffect(() => {
    async function load() {
      const [meRes, eventsRes] = await Promise.all([fetch("/api/me"), fetch("/api/admin/events")]);
      if (meRes.ok) setMe(await meRes.json());
      const eventsData = await eventsRes.json();
      setEvents(eventsRes.ok ? eventsData.events : []);
    }
    load();
  }, []);

  const loading = events === null;

  const leads = events?.filter((e) => e.status === "inquiry") ?? [];
  const pendingContracts = events?.filter((e) => e.contract_sent_at && !e.contract_signed_at) ?? [];

  const now = new Date();
  const weekOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcomingThisWeek =
    events?.filter((e) => {
      if (!e.starts_at || e.status === "declined") return false;
      const d = new Date(e.starts_at);
      return d >= now && d <= weekOut;
    }) ?? [];

  const bookingsThisYear =
    events
      ?.filter((e) => {
        if (!e.starts_at || e.status === "declined" || e.status === "inquiry") return false;
        return new Date(e.starts_at).getFullYear() === now.getFullYear();
      })
      .reduce((sum, e) => sum + (e.final_amount ?? e.quoted_amount ?? 0), 0) ?? 0;

  const recentLeads = [...leads]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-8 p-6 md:p-8">
      <div>
        <p className="font-display text-4xl font-light">
          {timeOfDayGreeting()}
          {me ? `, ${greetingName(me)}` : ""}
        </p>
        <p className="mt-1 text-sm text-muted">Here&apos;s what&apos;s happening across your business.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Magnet} label="New Leads" value={loading ? "..." : leads.length} href="/admin/leads" />
        <StatCard
          icon={FileText}
          label="Pending Contracts"
          value={loading ? "..." : pendingContracts.length}
          href="/admin/events"
        />
        <StatCard
          icon={CalendarClock}
          label="Upcoming This Week"
          value={loading ? "..." : upcomingThisWeek.length}
          href="/admin/calendar"
        />
        <StatCard
          icon={Sparkles}
          label="Bookings This Year"
          value={loading ? "..." : `$${(bookingsThisYear / 100).toLocaleString()}`}
          href="/admin/finance"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <GlassCard className="flex flex-col gap-3">
          <p className="text-sm font-semibold">Create new</p>
          <div className="flex flex-col gap-1">
            <QuickCreateLink href="/admin/events" icon={Briefcase} label="Project / Event" />
            <QuickCreateLink href="/admin/clients" icon={Users} label="Contact" />
            <QuickCreateLink href="/admin/leads" icon={Magnet} label="Lead" />
            <QuickCreateLink href="/admin/finance" icon={FileText} label="Invoice" />
          </div>
        </GlassCard>

        <GlassCard className="flex flex-col gap-3">
          <p className="text-sm font-semibold">Automations</p>
          <div className="flex flex-1 flex-col items-start justify-center gap-2 py-4">
            <Zap size={20} className="text-gold" />
            <p className="text-sm text-muted">
              Automated follow-ups and reminders are coming soon — for now, contracts and payments are tracked
              manually in Projects.
            </p>
          </div>
        </GlassCard>

        <GlassCard className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Recent leads</p>
            <Link href="/admin/leads" className="flex items-center gap-1 text-xs text-gold hover:underline">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="flex flex-col divide-y divide-border">
            {loading && <p className="py-3 text-sm text-muted">Loading...</p>}
            {!loading && recentLeads.length === 0 && <p className="py-3 text-sm text-muted">No new leads.</p>}
            {recentLeads.map((e) => (
              <Link key={e.id} href="/admin/events" className="group flex flex-col py-2.5 first:pt-0 last:pb-0">
                <span className="text-sm font-medium group-hover:text-gold">{e.title}</span>
                <span className="text-xs text-muted">{clientName(e.clients)}</span>
              </Link>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  href
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string | number;
  href: string;
}) {
  return (
    <Link href={href}>
      <GlassCard className="flex flex-col gap-2 transition-colors hover:border-gold/40">
        <Icon size={18} className="text-gold" />
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-xs text-muted">{label}</p>
      </GlassCard>
    </Link>
  );
}

function QuickCreateLink({
  href,
  icon: Icon,
  label
}: {
  href: string;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-[2px] px-2 py-2 text-sm text-muted transition-colors hover:bg-black/5 hover:text-foreground"
    >
      <Icon size={16} />
      {label}
    </Link>
  );
}

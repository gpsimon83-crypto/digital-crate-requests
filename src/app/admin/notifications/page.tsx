"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";
import { Bell, CheckCheck, Megaphone } from "lucide-react";
import { InboxTabs } from "@/components/admin/inbox-tabs";
import { Col, Grid, PageShell, SectionCard } from "@/components/layout/grid";
import { UPDATES } from "@/lib/whats-new";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  event_id: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  read_at: string | null;
  created_at: string;
}

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationRow[] | null>(null);

  function load() {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data) => setNotifications(data.notifications ?? []))
      .catch(() => setNotifications([]));
  }

  useEffect(load, []);

  async function markRead(id: string) {
    setNotifications((prev) => (prev ?? []).map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
  }

  async function markAllRead() {
    const now = new Date().toISOString();
    setNotifications((prev) => (prev ?? []).map((n) => (n.read_at ? n : { ...n, read_at: now })));
    await fetch("/api/notifications/mark-all-read", { method: "POST" });
  }

  const unreadCount = (notifications ?? []).filter((n) => !n.read_at).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Things that need your attention, in one place."
        action={
          unreadCount > 0 ? (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 rounded-[10px] border border-black/12 px-3.5 py-2 text-xs font-medium text-muted transition-colors hover:border-gold/40 hover:text-gold"
            >
              <CheckCheck size={14} /> Mark all read
            </button>
          ) : undefined
        }
        tabs={<InboxTabs active="notifications" />}
      />
      <PageShell>
      <Grid>
      <Col span={8} className="flex flex-col gap-2" aria-label="Notifications">
        {notifications === null && <p className="text-sm text-muted">Loading...</p>}
        {notifications !== null && notifications.length === 0 && (
          <GlassCard className="flex flex-col items-center gap-2 py-10 text-center">
            <Bell size={22} className="text-gold/70" />
            <p className="text-sm text-muted">Nothing here yet — you&apos;ll see contract, payment, and automation alerts as they happen.</p>
          </GlassCard>
        )}
        {(notifications ?? []).map((n) => {
          const content = (
            <div
              className={cn(
                "flex items-start gap-3 border border-black/10 p-4 transition-colors",
                !n.read_at && "border-gold/30 bg-gold/[0.04]"
              )}
            >
              <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-gold")} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{n.title}</p>
                {n.body && <p className="mt-0.5 text-xs text-muted">{n.body}</p>}
                <p className="mt-1 text-[11px] text-muted">{new Date(n.created_at).toLocaleString()}</p>
              </div>
            </div>
          );
          // Venue portal requests link to that venue's admin page.
          const href = n.event_id ? `/admin/events/${n.event_id}` : n.entity_type === "venue" && n.entity_id ? `/admin/venues/${n.entity_id}` : null;
          return href ? (
            <Link key={n.id} href={href} onClick={() => !n.read_at && markRead(n.id)}>
              {content}
            </Link>
          ) : (
            <button key={n.id} onClick={() => !n.read_at && markRead(n.id)} className="text-left">
              {content}
            </button>
          );
        })}
      </Col>
      <Col span={4}>
        <SectionCard icon={Megaphone} title="Latest updates" description="New features and changes to the CRM." actions={<Link href="/admin/whats-new" className="rounded-[6px] text-xs font-semibold text-gold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">All updates</Link>}>
          <ul className="flex flex-col divide-y divide-border">
            {UPDATES.slice(0, 4).map((u) => (
              <li key={u.id} className="py-2.5 first:pt-0 last:pb-0">
                <Link href={`/admin/whats-new/${u.id}`} className="block rounded-[6px] hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
                  <span className="block text-sm font-medium leading-snug">{u.title}</span>
                  <span className="mt-0.5 block text-[11px] text-muted">
                    {new Date(`${u.date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {u.area}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>
      </Col>
      </Grid>
      </PageShell>
    </>
  );
}

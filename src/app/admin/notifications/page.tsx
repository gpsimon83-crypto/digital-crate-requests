"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";
import { Bell, CheckCheck } from "lucide-react";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  event_id: string | null;
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
      />
      <div className="flex flex-col gap-2 p-6">
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
          return n.event_id ? (
            <Link key={n.id} href={`/admin/events/${n.event_id}`} onClick={() => !n.read_at && markRead(n.id)}>
              {content}
            </Link>
          ) : (
            <button key={n.id} onClick={() => !n.read_at && markRead(n.id)} className="text-left">
              {content}
            </button>
          );
        })}
      </div>
    </>
  );
}

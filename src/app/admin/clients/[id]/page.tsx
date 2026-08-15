"use client";

import { use as usePromise, useEffect, useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";
import { ArrowLeft, Building2, Mail, Phone, CalendarDays, ChevronRight } from "lucide-react";

interface ClientDetail {
  id: string;
  type: string;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  events: { id: string; title: string; starts_at: string | null; status: string; final_amount: number | null }[];
}

interface ClientMessage {
  id: string;
  event_id: string;
  direction: "outbound" | "inbound";
  from_email: string;
  from_name: string | null;
  subject: string | null;
  body: string;
  seen_at: string | null;
  created_at: string;
  events: { title: string | null; event_code: string } | null;
}

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [messages, setMessages] = useState<ClientMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/clients/${id}`)
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || "Failed to load client");
        setClient(data.client);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."));

    fetch(`/api/admin/clients/${id}/messages`)
      .then((r) => r.json())
      .then((data) => setMessages(data.messages ?? []))
      .catch(() => setMessages([]));
  }, [id]);

  if (error) {
    return (
      <div className="p-8">
        <p className="text-sm text-status-declined">{error}</p>
        <Link href="/admin/clients" className="mt-4 inline-block text-sm text-gold">
          ← Back to Contacts
        </Link>
      </div>
    );
  }

  if (!client) {
    return <div className="p-8 text-sm text-muted">Loading...</div>;
  }

  const name = client.company_name || [client.first_name, client.last_name].filter(Boolean).join(" ") || "Unnamed contact";
  const events = [...client.events].sort((a, b) => new Date(b.starts_at ?? 0).getTime() - new Date(a.starts_at ?? 0).getTime());

  return (
    <div className="pb-16">
      <Link
        href="/admin/clients"
        className="ml-6 mt-5 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[1.5px] text-muted hover:text-foreground sm:ml-8"
      >
        <ArrowLeft size={14} /> Contacts
      </Link>

      <div className="mx-6 mt-3 flex flex-col gap-6 sm:mx-8">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-light">
            {client.company_name && <Building2 size={20} className="text-gold" />}
            {name}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            {client.email && (
              <span className="flex items-center gap-1.5">
                <Mail size={13} /> {client.email}
              </span>
            )}
            {client.phone && (
              <span className="flex items-center gap-1.5">
                <Phone size={13} /> {client.phone}
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <GlassCard className="flex h-fit flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-[1.5px] text-muted">
              Events ({events.length})
            </p>
            {events.length === 0 ? (
              <p className="text-sm text-muted">No events yet.</p>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {events.map((e) => (
                  <Link
                    key={e.id}
                    href={`/admin/events/${e.id}`}
                    className="group flex items-center justify-between gap-2 py-2.5 first:pt-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium group-hover:text-gold">{e.title}</p>
                      <p className="flex items-center gap-1 text-xs text-muted">
                        <CalendarDays size={11} />
                        {e.starts_at ? new Date(e.starts_at).toLocaleDateString() : "No date set"}
                      </p>
                    </div>
                    <ChevronRight size={14} className="shrink-0 text-muted group-hover:text-gold" />
                  </Link>
                ))}
              </div>
            )}
          </GlassCard>

          <GlassCard className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-[1.5px] text-muted">
              Communication history{messages ? ` (${messages.length})` : ""}
            </p>
            <p className="text-xs text-muted">
              Every email across all of {name}&rsquo;s events, most recent first. Reply from the relevant project&rsquo;s Activity tab.
            </p>

            {messages === null && <p className="text-sm text-muted">Loading…</p>}
            {messages !== null && messages.length === 0 && (
              <p className="text-sm text-muted">No emails with this client yet.</p>
            )}

            {messages !== null && messages.length > 0 && (
              <div className="flex flex-col gap-3">
                {messages.map((m) => (
                  <Link
                    key={m.id}
                    href={`/admin/events/${m.event_id}?tab=Activity`}
                    className={cn(
                      "flex flex-col gap-1 rounded-[10px] border p-3 text-sm transition-colors hover:border-gold/50",
                      m.direction === "outbound" ? "border-black/10 bg-panel" : "border-gold/30 bg-gold/5"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-muted">
                      <span className="font-medium text-foreground">
                        {m.direction === "outbound" ? m.from_name || m.from_email : m.from_email}
                      </span>
                      <span>{new Date(m.created_at).toLocaleString()}</span>
                    </div>
                    {m.subject && <p className="text-xs font-medium text-muted">{m.subject}</p>}
                    <p className="line-clamp-2 whitespace-pre-wrap">{m.body}</p>
                    <div className="flex items-center justify-between text-[11px] text-muted">
                      <span>{m.events?.title ?? "Unknown event"}</span>
                      {m.direction === "outbound" && <span>{m.seen_at ? `Seen ${new Date(m.seen_at).toLocaleDateString()}` : "Not yet seen"}</span>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

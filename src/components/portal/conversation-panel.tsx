"use client";

import { useEffect, useRef, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  direction: "outbound" | "inbound";
  from_name: string | null;
  body: string;
  created_at: string;
}

/** Full thread + reply compose — reuses the real DJ email thread, a reply sends as a real email. */
export function ConversationPanel({ eventId }: { eventId: string }) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [djEmailConnected, setDjEmailConnected] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  function load() {
    fetch(`/api/portal/events/${eventId}/messages`)
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || "Failed to load messages");
        setMessages(data.messages);
        setDjEmailConnected(data.djEmailConnected);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."));
  }

  useEffect(load, [eventId]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages]);

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/events/${eventId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      setText("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  return (
    <GlassCard className="flex flex-col gap-4">
      <p className="text-sm font-semibold">Conversations</p>

      <div className="flex max-h-[420px] flex-col gap-3 overflow-y-auto">
        {messages === null && <p className="text-xs text-muted">Loading…</p>}
        {messages && messages.length === 0 && <p className="text-xs text-muted">No messages yet — say hello below.</p>}
        {messages?.map((m) => (
          <div key={m.id} className={cn("max-w-[85%] rounded-[10px] px-3.5 py-2.5 text-sm", m.direction === "inbound" ? "self-end bg-gold/10 text-foreground" : "self-start bg-panel text-foreground")}>
            <p className="whitespace-pre-wrap">{m.body}</p>
            <p className="mt-1 text-[10px] text-muted">
              {m.direction === "inbound" ? "You" : m.from_name || "Your DJ"} · {new Date(m.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-xs text-status-declined">{error}</p>}

      {djEmailConnected ? (
        <div className="flex items-end gap-2 border-t border-border pt-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a message to your DJ…"
            className="min-h-[44px] flex-1 resize-none rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
          />
          <Button variant="primary" size="sm" onClick={send} disabled={sending || !text.trim()}>
            {sending ? "Sending…" : "Send"}
          </Button>
        </div>
      ) : (
        <p className="rounded-[10px] border border-dashed border-border bg-panel px-3 py-2 text-xs text-muted">
          Your DJ hasn&rsquo;t set up messaging yet — email us directly and we&rsquo;ll make sure it reaches them.
        </p>
      )}
    </GlassCard>
  );
}

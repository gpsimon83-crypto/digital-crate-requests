"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fillMergeFields, type MergeContext } from "@/lib/merge-fields";
import { Paperclip, X } from "lucide-react";

interface EmailMessage {
  id: string;
  direction: "outbound" | "inbound";
  from_email: string;
  from_name: string | null;
  to_email: string;
  subject: string | null;
  body: string;
  seen_at: string | null;
  created_at: string;
}

interface EmailTemplateOption {
  id: string;
  title: string;
  subject: string | null;
  body: string | null;
}

export function EmailThreadPanel({
  eventId,
  hasClient,
  clientDisplayName,
  mergeContext
}: {
  eventId: string;
  hasClient: boolean;
  clientDisplayName: string | null;
  mergeContext: MergeContext;
}) {
  const [messages, setMessages] = useState<EmailMessage[] | null>(null);
  const [composeSubject, setComposeSubject] = useState("");
  const [composeText, setComposeText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplateOption[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadMessages() {
    try {
      const res = await fetch(`/api/events/${eventId}/messages`);
      const data = await res.json();
      setMessages(res.ok ? data.messages : []);
    } catch {
      setMessages([]);
    }
  }

  async function loadEmailTemplates() {
    try {
      const res = await fetch("/api/admin/library?category=email_template");
      const data = await res.json();
      if (res.ok) setEmailTemplates(data.items);
    } catch {
      // template picker just won't have options — compose box still works freeform
    }
  }

  useEffect(() => {
    loadMessages();
    loadEmailTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  function applyTemplate(templateId: string) {
    setSelectedTemplateId(templateId);
    if (!templateId) return;
    const template = emailTemplates.find((t) => t.id === templateId);
    if (!template) return;
    setComposeSubject(fillMergeFields(template.subject ?? "", mergeContext));
    setComposeText(fillMergeFields(template.body ?? "", mergeContext));
  }

  async function handleSendMessage() {
    if (!composeText.trim()) return;
    setSendingMessage(true);
    setMessageError(null);
    try {
      let res: Response;
      if (attachments.length > 0) {
        const form = new FormData();
        form.set("body", composeText.trim());
        if (composeSubject.trim()) form.set("subject", composeSubject.trim());
        attachments.forEach((f) => form.append("attachments", f));
        res = await fetch(`/api/events/${eventId}/messages`, { method: "POST", body: form });
      } else {
        res = await fetch(`/api/events/${eventId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: composeText.trim(), subject: composeSubject.trim() || undefined })
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      setComposeSubject("");
      setComposeText("");
      setSelectedTemplateId("");
      setAttachments([]);
      await loadMessages();
    } catch (err) {
      setMessageError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSendingMessage(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-[1.5px] text-muted">Email</p>

      {messages === null && <p className="text-sm text-muted">Loading…</p>}

      {messages !== null && messages.length === 0 && (
        <p className="text-sm text-muted">No emails yet — the first message you send here starts the thread.</p>
      )}

      {messages !== null && messages.length > 0 && (
        <div className="flex flex-col gap-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex flex-col gap-1 rounded-[2px] border p-3 text-sm",
                m.direction === "outbound" ? "border-black/10 bg-panel" : "border-gold/30 bg-gold/5"
              )}
            >
              <div className="flex items-center justify-between gap-2 text-xs text-muted">
                <span className="font-medium text-foreground">{m.direction === "outbound" ? m.from_name || m.from_email : m.from_email}</span>
                <span>{new Date(m.created_at).toLocaleString()}</span>
              </div>
              <p className="whitespace-pre-wrap">{m.body}</p>
              {m.direction === "outbound" && (
                <span className="text-[11px] text-muted">{m.seen_at ? `Seen ${new Date(m.seen_at).toLocaleDateString()}` : "Not yet seen"}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {messageError && <p className="text-xs text-status-declined">{messageError}</p>}

      <div className="flex flex-col gap-2">
        {emailTemplates.length > 0 && (
          <select
            value={selectedTemplateId}
            onChange={(e) => applyTemplate(e.target.value)}
            disabled={!hasClient}
            className="rounded-[2px] border border-black/10 bg-panel px-3 py-2 text-xs focus:border-gold focus:outline-none disabled:opacity-50"
          >
            <option value="">Use a template…</option>
            {emailTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        )}
        <input
          value={composeSubject}
          onChange={(e) => setComposeSubject(e.target.value)}
          placeholder="Subject (optional)"
          disabled={!hasClient}
          className="w-full rounded-[2px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none disabled:opacity-50"
        />
        <textarea
          value={composeText}
          onChange={(e) => setComposeText(e.target.value)}
          placeholder={hasClient ? `Message ${clientDisplayName ?? "your client"}...` : "This project has no client linked yet."}
          disabled={!hasClient}
          className="min-h-[90px] w-full rounded-[2px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none disabled:opacity-50"
        />
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {attachments.map((f, i) => (
              <span key={`${f.name}-${i}`} className="flex items-center gap-1.5 rounded-[2px] border border-black/10 bg-panel px-2.5 py-1 text-xs">
                {f.name}
                <button onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))} className="text-muted hover:text-status-declined">
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length > 0) setAttachments((prev) => [...prev, ...files]);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!hasClient}
            className="flex items-center gap-1.5 rounded-[2px] border border-black/10 px-2.5 py-1.5 text-xs text-muted hover:border-gold hover:text-gold disabled:opacity-50"
          >
            <Paperclip size={12} /> Attach
          </button>
          <Button variant="primary" size="sm" onClick={handleSendMessage} disabled={sendingMessage || !composeText.trim()} className="w-fit">
            {sendingMessage ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>
    </section>
  );
}

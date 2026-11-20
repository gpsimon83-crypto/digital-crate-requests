"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { FileText, Paperclip, File as FileIcon } from "lucide-react";

interface EventFileRow {
  id: string;
  category: "email_attachment" | "other";
  file_url: string;
  file_name: string;
  created_at: string;
}

const CATEGORY_ICON: Record<EventFileRow["category"], typeof FileText> = {
  email_attachment: Paperclip,
  other: FileIcon
};

export function PortalFilesList({ eventId }: { eventId: string }) {
  const [files, setFiles] = useState<EventFileRow[] | null>(null);

  function load() {
    fetch(`/api/portal/events/${eventId}/files`)
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => setFiles(ok ? data.files : []))
      .catch(() => setFiles([]));
  }

  useEffect(load, [eventId]);

  if (!files) return null;
  if (files.length === 0)
    return (
      <GlassCard className="flex max-w-2xl flex-col gap-1">
        <p className="text-sm font-semibold">Documents</p>
        <p className="text-sm text-muted">Nothing shared yet. Files your DJ shares with you, like timelines and attachments, will show up here.</p>
      </GlassCard>
    );

  return (
    <GlassCard className="flex flex-col gap-3">
      <p className="text-sm font-semibold">Documents</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {files.map((f) => {
          const Icon = CATEGORY_ICON[f.category];
          return (
            <a
              key={f.id}
              href={f.file_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-[10px] border border-border px-3 py-2.5 text-sm transition-colors hover:border-gold/50 hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <Icon size={16} className="shrink-0 text-gold" />
              <div className="min-w-0 flex-1">
                <p className="truncate">{f.file_name}</p>
                <p className="text-xs text-muted">{new Date(f.created_at).toLocaleDateString()}</p>
              </div>
            </a>
          );
        })}
      </div>
    </GlassCard>
  );
}

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

  if (!files || files.length === 0) return null;

  return (
    <GlassCard className="flex flex-col gap-3">
      <p className="text-sm font-semibold">Documents</p>
      <div className="flex flex-col divide-y divide-border">
        {files.map((f) => {
          const Icon = CATEGORY_ICON[f.category];
          return (
            <a
              key={f.id}
              href={f.file_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 py-2.5 text-sm hover:text-gold"
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

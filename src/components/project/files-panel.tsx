"use client";

import { useEffect, useRef, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { FileText, Paperclip, File as FileIcon, Trash2, Upload } from "lucide-react";

interface EventFileRow {
  id: string;
  category: "contract" | "email_attachment" | "other";
  file_url: string;
  file_name: string;
  source: "upload" | "email";
  created_at: string;
}

const CATEGORY_LABEL: Record<EventFileRow["category"], string> = {
  contract: "Contract",
  email_attachment: "Emailed",
  other: "File"
};

const CATEGORY_ICON: Record<EventFileRow["category"], typeof FileText> = {
  contract: FileText,
  email_attachment: Paperclip,
  other: FileIcon
};

export function FilesPanel({ eventId }: { eventId: string }) {
  const [files, setFiles] = useState<EventFileRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadCategory, setUploadCategory] = useState<"contract" | "other">("other");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function load() {
    fetch(`/api/events/${eventId}/files`)
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || "Failed to load files");
        setFiles(data.files);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."));
  }

  useEffect(load, [eventId]);

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("category", uploadCategory);
      form.set("file", file);
      const res = await fetch(`/api/events/${eventId}/files`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setFiles((prev) => (prev ? [data.file, ...prev] : [data.file]));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(file: EventFileRow) {
    setFiles((prev) => prev?.filter((f) => f.id !== file.id) ?? null);
    await fetch(`/api/events/${eventId}/files/${file.id}`, { method: "DELETE" });
  }

  if (!files) return <p className="text-sm text-muted">Loading...</p>;

  return (
    <GlassCard className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Files</p>
        <div className="flex items-center gap-2">
          <select
            value={uploadCategory}
            onChange={(e) => setUploadCategory(e.target.value as "contract" | "other")}
            className="rounded-[2px] border border-black/10 bg-panel px-2 py-1.5 text-xs focus:border-gold focus:outline-none"
          >
            <option value="other">File</option>
            <option value="contract">Contract</option>
          </select>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = "";
            }}
          />
          <NeonButton color="gold" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="px-3 py-1.5 text-xs">
            <Upload size={13} /> {uploading ? "Uploading…" : "Upload"}
          </NeonButton>
        </div>
      </div>

      {error && <p className="text-xs text-status-declined">{error}</p>}

      {files.length === 0 ? (
        <p className="text-sm text-muted">
          Nothing here yet — files you upload, and anything emailed as an attachment (either direction), will show up here.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {files.map((f) => {
            const Icon = CATEGORY_ICON[f.category];
            return (
              <div key={f.id} className="flex items-center gap-3 py-2.5">
                <Icon size={16} className="shrink-0 text-gold" />
                <div className="min-w-0 flex-1">
                  <a href={f.file_url} target="_blank" rel="noreferrer" className="block truncate text-sm text-gold hover:underline">
                    {f.file_name}
                  </a>
                  <p className="text-xs text-muted">
                    {CATEGORY_LABEL[f.category]} · {f.source === "email" ? "Emailed" : "Uploaded"} · {new Date(f.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button onClick={() => handleDelete(f)} className="shrink-0 text-muted hover:text-status-declined">
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}

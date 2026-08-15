"use client";

import { useEffect, useRef, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { FileText, Paperclip, File as FileIcon, BookOpen, Trash2, Upload, Library, Mail, Check } from "lucide-react";

interface EventFileRow {
  id: string;
  category: "contract" | "email_attachment" | "other";
  file_url: string;
  file_name: string;
  source: "upload" | "email" | "library";
  created_at: string;
}

interface LibraryItemOption {
  id: string;
  title: string;
  category: "email_template" | "contract" | "brochure";
  file_url: string | null;
  file_name: string | null;
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

const SOURCE_LABEL: Record<EventFileRow["source"], string> = {
  upload: "Uploaded",
  email: "Emailed",
  library: "From Library"
};

export function FilesPanel({ eventId }: { eventId: string }) {
  const [files, setFiles] = useState<EventFileRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadCategory, setUploadCategory] = useState<"contract" | "other">("other");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  const [libraryItems, setLibraryItems] = useState<LibraryItemOption[] | null>(null);
  const [selectedLibraryId, setSelectedLibraryId] = useState("");
  const [addingFromLibrary, setAddingFromLibrary] = useState(false);

  const [notifyingId, setNotifyingId] = useState<string | null>(null);
  const [notifiedIds, setNotifiedIds] = useState<Set<string>>(new Set());
  const [notifyError, setNotifyError] = useState<string | null>(null);

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

  async function toggleLibraryPicker() {
    const next = !showLibraryPicker;
    setShowLibraryPicker(next);
    if (next && libraryItems === null) {
      try {
        const res = await fetch("/api/admin/library");
        const data = await res.json();
        if (res.ok) {
          setLibraryItems((data.items as LibraryItemOption[]).filter((i) => i.category !== "email_template" && i.file_url));
        } else {
          setLibraryItems([]);
        }
      } catch {
        setLibraryItems([]);
      }
    }
  }

  async function handleAddFromLibrary() {
    if (!selectedLibraryId) return;
    setAddingFromLibrary(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ libraryItemId: selectedLibraryId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add from Library");
      setFiles((prev) => (prev ? [data.file, ...prev] : [data.file]));
      setSelectedLibraryId("");
      setShowLibraryPicker(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setAddingFromLibrary(false);
    }
  }

  async function handleDelete(file: EventFileRow) {
    setFiles((prev) => prev?.filter((f) => f.id !== file.id) ?? null);
    await fetch(`/api/events/${eventId}/files/${file.id}`, { method: "DELETE" });
  }

  async function handleNotify(file: EventFileRow) {
    setNotifyingId(file.id);
    setNotifyError(null);
    try {
      const portalLink = `${window.location.origin}/portal/events/${eventId}`;
      const res = await fetch(`/api/events/${eventId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: "New document available",
          body: `We've added a new document to your event portal: "${file.file_name}".\n\nView it here: ${portalLink}`
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      setNotifiedIds((prev) => new Set(prev).add(file.id));
    } catch (err) {
      setNotifyError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setNotifyingId(null);
    }
  }

  if (!files) return <p className="text-sm text-muted">Loading...</p>;

  return (
    <GlassCard className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
          <Button variant="primary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Upload size={13} /> {uploading ? "Uploading…" : "Upload"}
          </Button>
          <button
            onClick={toggleLibraryPicker}
            className="flex items-center gap-1.5 rounded-[2px] border border-black/10 px-3 py-1.5 text-xs font-medium text-muted hover:border-gold hover:text-gold"
          >
            <Library size={13} /> Add from Library
          </button>
        </div>
      </div>

      {showLibraryPicker && (
        <div className="flex items-center gap-2 rounded-[2px] border border-dashed border-black/15 bg-panel p-3">
          {libraryItems === null ? (
            <p className="text-xs text-muted">Loading Library…</p>
          ) : libraryItems.length === 0 ? (
            <p className="text-xs text-muted">No contracts or brochures in the Library yet — add one from Admin → Library.</p>
          ) : (
            <>
              <BookOpen size={14} className="shrink-0 text-gold" />
              <select
                value={selectedLibraryId}
                onChange={(e) => setSelectedLibraryId(e.target.value)}
                className="flex-1 rounded-[2px] border border-black/10 bg-card px-2 py-1.5 text-xs focus:border-gold focus:outline-none"
              >
                <option value="">Choose a contract or brochure…</option>
                {libraryItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title} ({item.category === "contract" ? "Contract" : "Brochure"})
                  </option>
                ))}
              </select>
              <Button variant="primary" size="sm" onClick={handleAddFromLibrary} disabled={!selectedLibraryId || addingFromLibrary}>
                {addingFromLibrary ? "Adding…" : "Add to Portal"}
              </Button>
            </>
          )}
        </div>
      )}

      {error && <p className="text-xs text-status-declined">{error}</p>}
      {notifyError && <p className="text-xs text-status-declined">{notifyError}</p>}

      {files.length === 0 ? (
        <p className="text-sm text-muted">
          Nothing here yet — files you upload, files added from the Library, and anything emailed as an attachment (either direction), will show up here and in the client&rsquo;s portal.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {files.map((f) => {
            const Icon = CATEGORY_ICON[f.category];
            const notified = notifiedIds.has(f.id);
            return (
              <div key={f.id} className="flex items-center gap-3 py-2.5">
                <Icon size={16} className="shrink-0 text-gold" />
                <div className="min-w-0 flex-1">
                  <a href={f.file_url} target="_blank" rel="noreferrer" className="block truncate text-sm text-gold hover:underline">
                    {f.file_name}
                  </a>
                  <p className="text-xs text-muted">
                    {CATEGORY_LABEL[f.category]} · {SOURCE_LABEL[f.source]} · {new Date(f.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleNotify(f)}
                  disabled={notifyingId === f.id || notified}
                  title="Email the client a link to view this in their portal"
                  className="flex shrink-0 items-center gap-1 text-xs text-muted hover:text-gold disabled:opacity-60"
                >
                  {notified ? (
                    <>
                      <Check size={13} className="text-status-approved" /> Sent
                    </>
                  ) : (
                    <>
                      <Mail size={13} /> {notifyingId === f.id ? "Sending…" : "Notify Client"}
                    </>
                  )}
                </button>
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

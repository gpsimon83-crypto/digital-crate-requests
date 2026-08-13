"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Mail, FileText, BookOpen, FolderOpen, ListChecks, Plus, X, Download, Trash2, Pencil } from "lucide-react";
import Link from "next/link";

type Category = "email_template" | "contract" | "brochure";

interface LibraryItem {
  id: string;
  category: Category;
  title: string;
  description: string | null;
  subject: string | null;
  body: string | null;
  file_url: string | null;
  file_name: string | null;
  created_at: string;
}

const CATEGORY_TABS: { key: Category | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "email_template", label: "Email Templates" },
  { key: "contract", label: "Contracts" },
  { key: "brochure", label: "Brochures" }
];

const CATEGORY_ICON: Record<Category, typeof Mail> = {
  email_template: Mail,
  contract: FileText,
  brochure: BookOpen
};

const CATEGORY_LABEL: Record<Category, string> = {
  email_template: "Email Template",
  contract: "Contract",
  brochure: "Brochure"
};

function AdminLibraryPageInner() {
  const searchParams = useSearchParams();
  const activeCategory = (searchParams.get("category") as Category | "all" | null) ?? "all";

  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addCategory, setAddCategory] = useState<Category>("email_template");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/admin/library");
      const data = await res.json();
      setItems(res.ok ? data.items : []);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function resetAddForm() {
    setTitle("");
    setDescription("");
    setSubject("");
    setBody("");
    setFile(null);
  }

  async function handleAdd() {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let res: Response;
      if (addCategory === "email_template") {
        if (!subject.trim() || !body.trim()) {
          setError("Subject and body are required for an email template.");
          setSaving(false);
          return;
        }
        res = await fetch("/api/admin/library", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, description, subject, body })
        });
      } else {
        if (!file) {
          setError("Choose a file to upload.");
          setSaving(false);
          return;
        }
        const form = new FormData();
        form.append("category", addCategory);
        form.append("title", title);
        form.append("description", description);
        form.append("file", file);
        res = await fetch("/api/admin/library", { method: "POST", body: form });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      resetAddForm();
      setShowAdd(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/library/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  function startEdit(item: LibraryItem) {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditDescription(item.description ?? "");
    setEditSubject(item.subject ?? "");
    setEditBody(item.body ?? "");
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    setSavingEdit(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/library/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, description: editDescription, subject: editSubject, body: editBody })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSavingEdit(false);
    }
  }

  const visibleItems = (items ?? []).filter((i) => activeCategory === "all" || i.category === activeCategory);

  return (
    <>
      <PageHeader
        title="Library"
        subtitle="Email templates, contracts, and brochures in one place."
        action={
          <Button variant="primary" onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? <X size={15} /> : <Plus size={15} />}
            {showAdd ? "Cancel" : "Add"}
          </Button>
        }
      />
      <div className="flex flex-col gap-4 p-6">
        <Link
          href="/admin/questionnaires"
          className="flex w-fit items-center gap-1.5 text-xs font-medium text-muted hover:text-gold"
        >
          <ListChecks size={13} /> Looking for the client planning questionnaires? Manage those in the Questionnaire Builder →
        </Link>

        {showAdd && (
          <div className="border border-border p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Category</span>
                <select
                  value={addCategory}
                  onChange={(e) => setAddCategory(e.target.value as Category)}
                  className="w-full rounded-[2px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
                >
                  <option value="email_template">Email Template</option>
                  <option value="contract">Contract</option>
                  <option value="brochure">Brochure</option>
                </select>
              </label>
              <Field label="Title" value={title} onChange={setTitle} placeholder="e.g. Booking Confirmation" />
              <div className="sm:col-span-2">
                <Field label="Description (optional)" value={description} onChange={setDescription} placeholder="What this is for" />
              </div>
            </div>

            {addCategory === "email_template" ? (
              <div className="mt-3 flex flex-col gap-3">
                <Field label="Subject" value={subject} onChange={setSubject} placeholder="Your event with Digital Crate DJs" />
                <label className="block">
                  <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Body</span>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Write the reusable email text here..."
                    className="min-h-[140px] w-full rounded-[2px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
                  />
                </label>
              </div>
            ) : (
              <div className="mt-3">
                <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">File</span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm"
                />
              </div>
            )}

            {error && <p className="mt-3 text-xs text-status-declined">{error}</p>}
            <div className="mt-4">
              <Button variant="primary" onClick={handleAdd} disabled={saving}>
                {saving ? "Saving…" : "Save to Library"}
              </Button>
            </div>
          </div>
        )}

        <Tabs
          items={CATEGORY_TABS}
          active={activeCategory}
          hrefFor={(key) => (key === "all" ? "/admin/files" : `/admin/files?category=${key}`)}
        />

        {error && !showAdd && <p className="text-sm text-status-declined">{error}</p>}

        {items === null && <p className="text-sm text-muted">Loading…</p>}

        {items !== null && visibleItems.length === 0 && (
          <EmptyState icon={FolderOpen} title="Nothing here yet" body="Add an email template or upload a file to get started." />
        )}

        {visibleItems.length > 0 && (
          <div className="flex flex-col divide-y divide-border border-y border-border">
            {visibleItems.map((item) => {
              const Icon = CATEGORY_ICON[item.category];
              const isEditing = editingId === item.id;
              return (
                <div key={item.id} className="flex flex-col gap-3 py-4">
                  {isEditing ? (
                    <div className="flex flex-col gap-3">
                      <Field label="Title" value={editTitle} onChange={setEditTitle} />
                      <Field label="Description" value={editDescription} onChange={setEditDescription} />
                      <Field label="Subject" value={editSubject} onChange={setEditSubject} />
                      <label className="block">
                        <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Body</span>
                        <textarea
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          className="min-h-[120px] w-full rounded-[2px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
                        />
                      </label>
                      <div className="flex gap-2">
                        <Button variant="primary" size="sm" onClick={handleSaveEdit} disabled={savingEdit}>
                          {savingEdit ? "Saving…" : "Save"}
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <Icon size={16} className="mt-0.5 shrink-0 text-gold" />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{item.title}</p>
                            <span className={cn("status-dot", "muted")}>{CATEGORY_LABEL[item.category]}</span>
                          </div>
                          {item.description && <p className="mt-0.5 text-sm text-muted">{item.description}</p>}
                          {item.category === "email_template" && item.subject && (
                            <p className="mt-1 text-xs text-muted">Subject: {item.subject}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {item.file_url && (
                          <a href={item.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-gold hover:underline">
                            <Download size={12} /> Open
                          </a>
                        )}
                        {item.category === "email_template" && (
                          <button onClick={() => startEdit(item)} className="flex items-center gap-1 text-xs text-gold hover:underline">
                            <Pencil size={12} /> Edit
                          </button>
                        )}
                        <button onClick={() => handleDelete(item.id)} className="flex items-center gap-1 text-xs text-status-declined hover:underline">
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

export default function AdminLibraryPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted">Loading...</div>}>
      <AdminLibraryPageInner />
    </Suspense>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[2px] border border-black/10 bg-panel px-3 py-2 text-sm placeholder:text-muted/60 focus:border-gold focus:outline-none"
      />
    </label>
  );
}

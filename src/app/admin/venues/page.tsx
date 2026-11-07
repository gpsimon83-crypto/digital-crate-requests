"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import Link from "next/link";
import { MapPin } from "lucide-react";

interface VenueRow {
  id: string;
  name: string;
  location: string | null;
  city?: string | null;
  state?: string | null;
  is_active?: boolean;
  portal_enabled?: boolean;
  managers?: number;
}

export default function AdminVenuesPage() {
  const [venues, setVenues] = useState<VenueRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [adding, setAdding] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [migrated, setMigrated] = useState(true);

  async function load() {
    try {
      const res = await fetch("/api/admin/venues/directory");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load venues");
      setVenues(data.venues ?? []);
      setMigrated(data.migrated !== false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function handleAdd() {
    if (!name.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/venues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), location: location.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add venue");
      setName("");
      setLocation("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/admin/venues/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove venue");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPendingDeleteId(null);
    }
  }

  return (
    <>
      <PageHeader title="Venues" subtitle="Venue partners, their portal access, managers and branding." />
      <div className="flex flex-col gap-4 p-6">
        {!migrated && (
          <p className="rounded-[10px] border border-status-pending/40 bg-status-pending/10 p-3 text-xs">
            The Venue Partner Portal database update (migration 0044) hasn&apos;t been run yet. Run it in Supabase to manage portals and managers.
          </p>
        )}
        <div className="flex flex-col gap-3 border border-border p-4 sm:flex-row sm:items-end">
          <label className="block flex-1">
            <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Venue Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Venue name"
              className="w-full rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
            />
          </label>
          <label className="block flex-1">
            <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Location</span>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City, State"
              className="w-full rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
            />
          </label>
          <Button variant="primary" onClick={handleAdd} disabled={adding} className="shrink-0">
            {adding ? "Adding…" : "Add Venue"}
          </Button>
        </div>

        {error && <p className="text-xs text-status-declined">{error}</p>}

        <DataTable
          columns={columns(setPendingDeleteId)}
          rows={venues ?? []}
          rowKey={(v) => v.id}
          loading={venues === null}
          searchFn={(v, q) => v.name.toLowerCase().includes(q) || (v.location ?? "").toLowerCase().includes(q)}
          searchPlaceholder="Search venues…"
          emptyIcon={MapPin}
          emptyTitle="No venues yet"
          emptyBody="Add your first venue partner."
        />
      </div>

      <ConfirmModal
        open={!!pendingDeleteId}
        title="Remove this venue?"
        body="This cannot be undone."
        confirmLabel="Remove"
        onConfirm={() => pendingDeleteId && handleDelete(pendingDeleteId)}
        onCancel={() => setPendingDeleteId(null)}
      />
    </>
  );
}

function columns(onDelete: (id: string) => void): DataTableColumn<VenueRow>[] {
  return [
    { key: "name", header: "Name", sortValue: (v) => v.name, render: (v) => <span className="font-medium">{v.name}</span> },
    {
      key: "location",
      header: "Location",
      sortValue: (v) => v.location ?? "",
      render: (v) => <span className="text-muted">{v.location || [v.city, v.state].filter(Boolean).join(", ") || "—"}</span>
    },
    {
      key: "portal",
      header: "Portal",
      sortValue: (v) => (v.portal_enabled ? 1 : 0),
      render: (v) =>
        v.is_active === false ? (
          <span className="text-xs text-muted">Inactive</span>
        ) : v.portal_enabled ? (
          <span className="rounded-full bg-status-approved/15 px-2 py-0.5 text-xs text-status-approved">On</span>
        ) : (
          <span className="text-xs text-muted">Off</span>
        )
    },
    { key: "managers", header: "Managers", align: "right", sortValue: (v) => v.managers ?? 0, render: (v) => <span>{v.managers ?? 0}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (v) => (
        <span className="flex items-center justify-end gap-4">
          <Link href={`/admin/venues/${v.id}`} className="text-xs font-medium text-gold-dim hover:underline">
            Manage
          </Link>
          <button onClick={() => onDelete(v.id)} className="text-xs text-status-declined hover:underline">
            Remove
          </button>
        </span>
      )
    }
  ];
}

"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MapPin } from "lucide-react";

interface VenueRow {
  id: string;
  name: string;
  location: string | null;
}

export default function AdminVenuesPage() {
  const [venues, setVenues] = useState<VenueRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [adding, setAdding] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/admin/venues");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load venues");
      setVenues(data.venues ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  useEffect(() => {
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
    if (!confirm("Remove this venue? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/admin/venues/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove venue");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <>
      <PageHeader title="Venues" subtitle="Add, edit, or remove venue partners." />
      <div className="flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-3 border border-border p-4 sm:flex-row sm:items-end">
          <label className="block flex-1">
            <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Venue Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Venue name"
              className="w-full rounded-[2px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
            />
          </label>
          <label className="block flex-1">
            <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Location</span>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City, State"
              className="w-full rounded-[2px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
            />
          </label>
          <Button variant="primary" onClick={handleAdd} disabled={adding} className="shrink-0">
            {adding ? "Adding…" : "Add Venue"}
          </Button>
        </div>

        {error && <p className="text-xs text-status-declined">{error}</p>}

        {venues === null && <p className="text-sm text-muted">Loading…</p>}
        {venues?.length === 0 && <EmptyState icon={MapPin} title="No venues yet" body="Add your first venue partner." />}
        {venues && venues.length > 0 && (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Location</th>
                  <th className="sr-only">Actions</th>
                </tr>
              </thead>
              <tbody>
                {venues.map((v) => (
                  <tr key={v.id}>
                    <td className="font-medium">{v.name}</td>
                    <td className="text-muted">{v.location ?? "—"}</td>
                    <td>
                      <button onClick={() => handleDelete(v.id)} className="text-xs text-status-declined hover:underline">
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

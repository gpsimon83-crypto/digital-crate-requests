"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
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
      <PageHeader title="Manage Venues" subtitle="Add, edit, or remove venue partners." />
      <div className="flex flex-col gap-6 p-6">
        <GlassCard neon className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1">
            <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Venue Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Venue name"
              className="w-full rounded-xl border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
            />
          </label>
          <label className="block flex-1">
            <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Location</span>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City, State"
              className="w-full rounded-xl border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
            />
          </label>
          <NeonButton color="gold" onClick={handleAdd} disabled={adding} className="shrink-0">
            {adding ? "Adding..." : "+ Add Venue"}
          </NeonButton>
        </GlassCard>

        {error && <p className="text-xs text-status-declined">{error}</p>}

        <div className="flex flex-col gap-3">
          {venues === null && <p className="text-sm text-muted">Loading...</p>}
          {venues?.length === 0 && <p className="text-sm text-muted">No venues yet.</p>}
          {venues?.map((v) => (
            <GlassCard key={v.id} className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{v.name}</p>
                {v.location && (
                  <p className="flex items-center gap-1 text-xs text-muted">
                    <MapPin size={11} /> {v.location}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleDelete(v.id)}
                className="rounded-full border border-status-declined/40 px-3 py-1.5 text-xs text-status-declined"
              >
                Remove
              </button>
            </GlassCard>
          ))}
        </div>
      </div>
    </>
  );
}

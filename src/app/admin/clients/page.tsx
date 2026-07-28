"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { Mail, Phone, Building2 } from "lucide-react";

interface ClientRow {
  id: string;
  type: string;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
}

export default function AdminClientsPage() {
  const [clients, setClients] = useState<ClientRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [adding, setAdding] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/admin/clients");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load clients");
      setClients(data.clients ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd() {
    if (!companyName.trim() && !(firstName.trim() && lastName.trim())) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName.trim() || undefined,
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add client");
      setCompanyName("");
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this client? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/admin/clients/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove client");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <>
      <PageHeader title="Manage Clients" subtitle="The people and companies who book Digital Crate DJs." />
      <div className="flex flex-col gap-6 p-6">
        <GlassCard neon className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Company (optional)</span>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Corp"
                className="w-full rounded-[2px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">First Name</span>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-[2px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Last Name</span>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded-[2px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
                />
              </label>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-[2px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Phone</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-[2px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
              />
            </label>
          </div>
          <NeonButton color="gold" onClick={handleAdd} disabled={adding} className="self-start">
            {adding ? "Adding..." : "+ Add Client"}
          </NeonButton>
        </GlassCard>

        {error && <p className="text-xs text-status-declined">{error}</p>}

        <div className="flex flex-col gap-3">
          {clients === null && <p className="text-sm text-muted">Loading...</p>}
          {clients?.length === 0 && <p className="text-sm text-muted">No clients yet.</p>}
          {clients?.map((c) => {
            const name = c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed client";
            return (
              <GlassCard key={c.id} className="flex items-center justify-between">
                <div>
                  <p className="flex items-center gap-1.5 font-semibold">
                    {c.company_name && <Building2 size={14} />}
                    {name}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted">
                    {c.email && (
                      <span className="flex items-center gap-1">
                        <Mail size={11} /> {c.email}
                      </span>
                    )}
                    {c.phone && (
                      <span className="flex items-center gap-1">
                        <Phone size={11} /> {c.phone}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="rounded-[2px] border border-status-declined/40 px-3 py-1.5 text-xs text-status-declined"
                >
                  Remove
                </button>
              </GlassCard>
            );
          })}
        </div>
      </div>
    </>
  );
}

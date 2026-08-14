"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Plus, X, Users, Building2 } from "lucide-react";

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
  const [showCreate, setShowCreate] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("new") === "1"
  );

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
      setShowCreate(false);
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
      <PageHeader
        title="Contacts"
        subtitle="The people and companies who book Digital Crate DJs."
        action={
          <Button variant="primary" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? <X size={15} /> : <Plus size={15} />}
            {showCreate ? "Cancel" : "New Contact"}
          </Button>
        }
      />
      <div className="flex flex-col gap-4 p-6">
        {showCreate && (
          <div className="border border-border p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Company (optional)" value={companyName} onChange={setCompanyName} placeholder="Acme Corp" />
              <Field label="First Name" value={firstName} onChange={setFirstName} />
              <Field label="Last Name" value={lastName} onChange={setLastName} />
              <Field label="Email" value={email} onChange={setEmail} type="email" />
              <Field label="Phone" value={phone} onChange={setPhone} />
            </div>
            {error && <p className="mt-3 text-xs text-status-declined">{error}</p>}
            <div className="mt-4">
              <Button variant="primary" onClick={handleAdd} disabled={adding}>
                {adding ? "Adding…" : "Add Contact"}
              </Button>
            </div>
          </div>
        )}

        {clients === null && <p className="text-sm text-muted">Loading…</p>}
        {clients?.length === 0 && <EmptyState icon={Users} title="No contacts yet" body="Add your first client to get started." />}
        {clients && clients.length > 0 && (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th className="sr-only">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => {
                  const name = c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed contact";
                  return (
                    <tr key={c.id}>
                      <td>
                        <span className="flex items-center gap-1.5 font-medium">
                          {c.company_name && <Building2 size={13} className="shrink-0 text-muted" />}
                          {name}
                        </span>
                      </td>
                      <td className="text-muted">{c.email ?? "—"}</td>
                      <td className="text-muted">{c.phone ?? "—"}</td>
                      <td>
                        <button onClick={() => handleDelete(c.id)} className="text-xs text-status-declined hover:underline">
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[2px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
      />
    </label>
  );
}

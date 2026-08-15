"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Plus, X, Users, Building2, ChevronRight } from "lucide-react";
import { clientName } from "@/lib/format";

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
  const router = useRouter();
  const [clients, setClients] = useState<ClientRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
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
    try {
      const res = await fetch(`/api/admin/clients/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove client");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPendingDeleteId(null);
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

        <DataTable
          columns={columns(setPendingDeleteId)}
          rows={clients ?? []}
          rowKey={(c) => c.id}
          onRowClick={(c) => router.push(`/admin/clients/${c.id}`)}
          loading={clients === null}
          searchFn={(c, q) => (clientName(c, "") ?? "").toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q)}
          searchPlaceholder="Search contacts…"
          emptyIcon={Users}
          emptyTitle="No contacts yet"
          emptyBody="Add your first client to get started."
        />
      </div>

      <ConfirmModal
        open={!!pendingDeleteId}
        title="Remove this client?"
        body="This cannot be undone."
        confirmLabel="Remove"
        onConfirm={() => pendingDeleteId && handleDelete(pendingDeleteId)}
        onCancel={() => setPendingDeleteId(null)}
      />
    </>
  );
}

function columns(onDelete: (id: string) => void): DataTableColumn<ClientRow>[] {
  return [
    {
      key: "name",
      header: "Name",
      sortValue: (c) => clientName(c, "") ?? "",
      render: (c) => (
        <span className="flex items-center gap-1.5 font-medium">
          {c.company_name && <Building2 size={13} className="shrink-0 text-muted" />}
          {clientName(c, "Unnamed contact")}
        </span>
      )
    },
    { key: "email", header: "Email", sortValue: (c) => c.email ?? "", render: (c) => <span className="text-muted">{c.email ?? "—"}</span> },
    { key: "phone", header: "Phone", render: (c) => <span className="text-muted">{c.phone ?? "—"}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (c) => (
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(c.id);
            }}
            className="text-xs text-status-declined hover:underline"
          >
            Remove
          </button>
          <ChevronRight size={15} className="text-muted" />
        </div>
      )
    }
  ];
}

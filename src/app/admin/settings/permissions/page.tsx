"use client";

import { Fragment, useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { cn } from "@/lib/utils";
import { ROLES as ROLE_VALUES, CAPABILITY_GROUPS } from "@/lib/permission-capabilities";

const ROLE_LABELS: Record<string, string> = { owner: "Owner", admin: "Admin", manager: "Manager", dj: "DJ", client: "Client" };
const ROLES = ROLE_VALUES.map((value) => ({ value, label: ROLE_LABELS[value] }));

interface PermissionRow {
  role: string;
  capability: string;
}

export default function AdminPermissionsPage() {
  const [grants, setGrants] = useState<Set<string> | null>(null);
  const [error, setError] = useState<string | null>(null);

  function key(role: string, capability: string) {
    return `${role}::${capability}`;
  }

  function load() {
    fetch("/api/admin/permissions")
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || "Failed to load permissions");
        setGrants(new Set((data.permissions as PermissionRow[]).map((p) => key(p.role, p.capability))));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."));
  }

  useEffect(load, []);

  async function toggle(role: string, capability: string) {
    const granted = !grants?.has(key(role, capability));
    setGrants((prev) => {
      const next = new Set(prev);
      if (granted) next.add(key(role, capability));
      else next.delete(key(role, capability));
      return next;
    });
    setError(null);
    const res = await fetch("/api/admin/permissions/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, capability, granted })
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to save — reverting.");
      load();
    }
  }

  return (
    <>
      <PageHeader
        title="Permissions"
        subtitle="What each role can see and do. Owner and admin currently match — both have full clearance."
      />
      <div className="flex flex-col gap-6 p-6">
        {error && <p className="text-sm text-status-declined">{error}</p>}
        {grants === null && !error && <p className="text-sm text-muted">Loading...</p>}

        {grants !== null && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-muted">Capability</th>
                  {ROLES.map((r) => (
                    <th key={r.value} className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted">
                      {r.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CAPABILITY_GROUPS.map((g) => (
                  <Fragment key={g.group}>
                    <tr>
                      <td colSpan={ROLES.length + 1} className="pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-gold">
                        {g.group}
                      </td>
                    </tr>
                    {g.capabilities.map((c) => (
                      <tr key={c.value} className="border-b border-border/60">
                        <td className="py-2 pr-4">{c.label}</td>
                        {ROLES.map((r) => {
                          const checked = grants.has(key(r.value, c.value));
                          return (
                            <td key={r.value} className="px-3 py-2 text-center">
                              <button
                                onClick={() => toggle(r.value, c.value)}
                                className={cn(
                                  "inline-flex h-5 w-5 items-center justify-center rounded-[3px] border transition-colors",
                                  checked ? "border-gold bg-gold text-black" : "border-black/15 bg-panel text-transparent hover:border-black/30"
                                )}
                              >
                                {checked && "✓"}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

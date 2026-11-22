"use client";

import { useEffect, useState } from "react";
import { isStaffRole } from "@/lib/roles";
import { ClassicHome } from "@/components/dj/classic-home";
import { DjOverview } from "@/components/dj/dj-overview";

/**
 * DJ portal home. DJs (and staff viewing as a DJ) get the full dashboard;
 * staff on their own, or a login not linked to a DJ yet, get the simple
 * page that was here before.
 */
export default function DjPortalHomePage() {
  const [me, setMe] = useState<{ staff: boolean; dj: { id: string; display_name: string } | null } | null>(null);
  useEffect(() => {
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMe({ staff: isStaffRole(d?.user?.role), dj: d?.dj ?? null }))
      .catch(() => setMe({ staff: false, dj: null }));
  }, []);
  if (!me) return <div className="min-h-[60vh]" aria-busy="true" />;
  if (me.staff || !me.dj) return <ClassicHome />;
  return <DjOverview djId={me.dj.id} djName={me.dj.display_name} />;
}

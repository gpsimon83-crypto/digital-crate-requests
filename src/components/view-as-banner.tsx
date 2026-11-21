"use client";

import { useState, useSyncExternalStore } from "react";
import { Eye, X } from "lucide-react";

const NAME_COOKIE = "dcdj_view_as_name";

function readName(): string | null {
  const m = document.cookie.split("; ").find((c) => c.startsWith(`${NAME_COOKIE}=`));
  if (!m) return null;
  try {
    return decodeURIComponent(decodeURIComponent(m.slice(NAME_COOKIE.length + 1))) || null;
  } catch {
    return null;
  }
}

/**
 * Shown on every page while staff are in "View as DJ": who you're seeing
 * the site as, that it's read-only, and the way out.
 */
export function ViewAsBanner() {
  const name = useSyncExternalStore(
    () => () => {},
    readName,
    () => null
  );
  const [leaving, setLeaving] = useState(false);
  if (!name) return null;
  async function exit() {
    setLeaving(true);
    await fetch("/api/admin/view-as", { method: "DELETE" }).catch(() => {});
    window.location.href = "/admin/djs";
  }
  return (
    <div role="status" className="sticky top-0 z-[60] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-[#1f6f5c] px-4 py-2 text-center text-sm text-white" data-tour="view-as-banner">
      <Eye size={16} aria-hidden />
      <span>
        Viewing as <b>{name}</b>: you see exactly what they see. Read-only, nothing can be changed.
      </span>
      <button type="button" onClick={exit} disabled={leaving} className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
        <X size={13} aria-hidden /> {leaving ? "Leaving…" : "Exit"}
      </button>
    </div>
  );
}

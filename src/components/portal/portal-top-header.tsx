"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Bell, ChevronDown } from "lucide-react";

export function PortalTopHeader({ eventId, firstName }: { eventId?: string; firstName: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/portal/login");
    router.refresh();
  }

  return (
    <header className="flex items-center justify-between border-b border-border bg-background px-[4%] py-4">
      <div className="flex items-center gap-3">
        <Link href="/portal" className="font-display text-xl italic">
          Digital Crate DJs
        </Link>
        <span className="h-4 w-px bg-border" />
        <span className="text-[10px] font-semibold uppercase tracking-[2px] text-muted">Client Experience</span>
      </div>

      <div className="flex items-center gap-4">
        <Link href={eventId ? `/portal/events/${eventId}?tab=conversations` : "/portal"} aria-label="Conversations" className="text-muted hover:text-foreground">
          <Bell size={18} />
        </Link>
        <div className="relative" ref={menuRef}>
          <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 text-sm">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white" style={{ background: "var(--foreground)" }}>
              {firstName ? firstName.charAt(0).toUpperCase() : "?"}
            </span>
            <span className="hidden sm:inline">Hi, {firstName ?? "there"}</span>
            <ChevronDown size={14} className="text-muted" />
          </button>
          {open && (
            <div className="absolute right-0 top-full z-20 mt-2 w-40 rounded-[10px] border border-border bg-card py-1 shadow-lg">
              <button onClick={handleSignOut} className="block w-full px-3 py-2 text-left text-sm hover:bg-black/5">
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

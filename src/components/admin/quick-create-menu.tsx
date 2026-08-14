"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, Briefcase, Users, Disc3, MapPin, Boxes } from "lucide-react";

const ITEMS = [
  { href: "/admin/events?new=1", label: "New Event", icon: Briefcase },
  { href: "/admin/clients?new=1", label: "New Client", icon: Users },
  { href: "/admin/djs?new=1", label: "New DJ", icon: Disc3 },
  { href: "/admin/venues?new=1", label: "New Venue", icon: MapPin },
  { href: "/admin/equipment?new=1", label: "New Equipment", icon: Boxes }
];

export function QuickCreateMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative mb-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="menu-fade-item flex w-full items-center gap-3 rounded-[2px] bg-gold px-3 py-2.5 text-sm font-semibold text-black transition-transform hover:scale-[1.02]"
      >
        <Plus size={18} className="shrink-0" />
        <span className="whitespace-nowrap opacity-0 transition-opacity delay-75 duration-150 group-hover:opacity-100">New</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-52 rounded-[3px] border border-black/10 bg-panel py-1.5 shadow-xl">
          {ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-muted transition-colors hover:bg-gold/10 hover:text-foreground"
            >
              <Icon size={15} className="shrink-0" />
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

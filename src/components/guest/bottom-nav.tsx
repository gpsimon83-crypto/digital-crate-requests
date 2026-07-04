"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, Search, ThumbsUp, ListMusic, Gift } from "lucide-react";

export function BottomNav() {
  const pathname = usePathname();
  const params = useParams<{ eventCode: string }>();
  const base = `/r/${params.eventCode}`;

  const items = [
    { href: base, label: "Event", icon: Home },
    { href: `${base}/request`, label: "Request", icon: Search },
    { href: `${base}/vote`, label: "Vote", icon: ThumbsUp },
    { href: `${base}/my-requests`, label: "Mine", icon: ListMusic },
    { href: `${base}/rewards`, label: "Rewards", icon: Gift },
  ];

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-20 border-t border-white/10 bg-panel/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]"
      aria-label="Primary"
    >
      <div className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium min-h-[56px] justify-center transition-colors",
                active ? "text-neon-cyan" : "text-muted"
              )}
            >
              <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

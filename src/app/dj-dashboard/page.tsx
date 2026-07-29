"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { DjAvatar } from "@/components/dashboard/dj-avatar";
import { CalendarClock, Boxes, UserCircle, ShieldCheck, LogOut, ChevronRight } from "lucide-react";
import { isStaffRole } from "@/lib/roles";

interface Tile {
  href: string;
  label: string;
  desc: string;
  icon: React.ComponentType<{ size?: number }>;
}

export default function DjPortalHomePage() {
  const router = useRouter();
  const [djName, setDjName] = useState<string | null>(null);
  const [djPhoto, setDjPhoto] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => {
        setIsAdmin(isStaffRole(data?.user?.role));
        setDjName(data?.dj?.display_name ?? null);
        setDjPhoto(data?.dj?.photo_url ?? null);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/dj-dashboard/login");
    router.refresh();
  }

  const tiles: Tile[] = loaded
    ? [
        {
          href: "/dj-dashboard/bookings",
          label: isAdmin ? "All Bookings" : "My Bookings",
          desc: "See and manage your upcoming events.",
          icon: CalendarClock,
        },
        ...(!isAdmin
          ? [
              {
                href: "/dj-dashboard/library",
                label: "Crate Builder",
                desc: "Organize your music library and build crates.",
                icon: Boxes,
              },
            ]
          : []),
        {
          href: "/dj-dashboard/profile",
          label: "My Profile",
          desc: isAdmin ? "Every admin control, in one place." : "Update your photo and hero settings.",
          icon: UserCircle,
        },
        ...(isAdmin
          ? [
              {
                href: "/admin",
                label: "Admin Panel",
                desc: "Manage DJs, venues, events, and invite codes.",
                icon: ShieldCheck,
              },
            ]
          : []),
      ]
    : [];

  return (
    <div className="min-h-dvh bg-background">
      <PageHeader
        title={loaded ? `Welcome${djName ? `, ${djName}` : ""}` : "Welcome"}
        subtitle="Digital Crate Requests — pick where you want to go."
        action={
          <div className="flex items-center gap-3">
            {djName && <DjAvatar name={djName} photoUrl={djPhoto} size={32} />}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-[2px] border border-black/12 px-3.5 py-2 text-xs font-medium text-muted transition-colors hover:border-black/25 hover:text-foreground"
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        }
      />
      <main className="mx-auto max-w-2xl px-6 py-8 sm:px-8">
        {loaded && (
          <div className="flex flex-col divide-y divide-border border-y border-border">
            {tiles.map(({ href, label, desc, icon: Icon }, i) => (
              <Link
                key={href}
                href={href}
                style={{ "--menu-fade-delay": `${i * 60}ms` } as React.CSSProperties}
                className="menu-fade-item group flex items-center gap-4 py-4 transition-colors hover:bg-gold/[0.04]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-gold/30 text-gold">
                  <Icon size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium group-hover:text-gold">{label}</p>
                  <p className="text-sm text-muted">{desc}</p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-muted group-hover:text-gold" />
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

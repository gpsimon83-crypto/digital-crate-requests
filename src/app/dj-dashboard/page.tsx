"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { DjAvatar } from "@/components/dashboard/dj-avatar";
import { CalendarClock, Boxes, UserCircle, ShieldCheck, LogOut } from "lucide-react";
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

  const tiles: Tile[] = [
    {
      href: "/dj-dashboard/bookings",
      label: isAdmin ? "All Bookings" : "My Bookings",
      desc: "See and manage your upcoming events.",
      icon: CalendarClock,
    },
    {
      href: "/dj-dashboard/library",
      label: "Crate Builder",
      desc: "Organize your music library and build crates.",
      icon: Boxes,
    },
  ];
  tiles.push({
    href: "/dj-dashboard/profile",
    label: "My Profile",
    desc: isAdmin ? "Every admin control, in one place." : "Update your photo and hero settings.",
    icon: UserCircle,
  });
  if (isAdmin) {
    tiles.push({
      href: "/admin",
      label: "Admin Panel",
      desc: "Manage DJs, venues, events, and invite codes.",
      icon: ShieldCheck,
    });
  }

  return (
    <div className="min-h-dvh bg-background">
      <PageHeader
        title={loaded ? `Welcome${djName ? `, ${djName}` : ""}` : "Welcome"}
        subtitle="Digital Crate Requests — pick where you want to go."
        action={
          <div className="flex items-center gap-3">
            {djName && <DjAvatar name={djName} photoUrl={djPhoto} size={36} />}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-full border border-black/12 px-3.5 py-2 text-xs font-medium text-muted transition-colors hover:border-black/25 hover:text-foreground"
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        }
      />
      <main className="mx-auto grid max-w-3xl grid-cols-1 gap-4 px-6 py-10 sm:grid-cols-2 sm:px-8">
        {tiles.map(({ href, label, desc, icon: Icon }, i) => (
          <Link
            key={href}
            href={href}
            style={{ "--menu-fade-delay": `${i * 60}ms` } as React.CSSProperties}
            className="menu-fade-item"
          >
            <GlassCard neon className="flex h-full flex-col gap-3 transition-transform hover:-translate-y-0.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/15 text-gold">
                <Icon size={20} />
              </span>
              <div>
                <p className="font-semibold">{label}</p>
                <p className="mt-1 text-sm text-muted">{desc}</p>
              </div>
            </GlassCard>
          </Link>
        ))}
      </main>
    </div>
  );
}

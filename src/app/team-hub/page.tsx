import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { GlassCard } from "@/components/ui/glass-card";
import { MOCK_TEAM, MOCK_ANNOUNCEMENTS, MOCK_UPCOMING_ASSIGNMENTS } from "@/lib/mock-data";
import { Megaphone, CalendarDays } from "lucide-react";

export default function TeamHubPage() {
  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-16">
        <header className="mb-10 text-center">
          <h1 className="text-3xl font-extrabold">Team Hub</h1>
          <p className="mt-2 text-muted">Internal roster, assignments, and announcements for the Digital Crate DJs team.</p>
        </header>

        <section className="mb-10">
          <p className="mb-4 text-sm font-semibold">Roster</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MOCK_TEAM.map((m) => (
              <GlassCard key={m.id} className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{m.name}</p>
                  <p className="text-xs text-muted">{m.role}</p>
                  <p className="mt-1 text-xs text-gold">{m.eventsThisMonth} events this month</p>
                </div>
                <span
                  className={
                    m.status === "Available" ? "status-badge approved" : "status-badge pending"
                  }
                >
                  {m.status}
                </span>
              </GlassCard>
            ))}
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          <section>
            <p className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <CalendarDays size={16} className="text-gold" /> Upcoming Assignments
            </p>
            <div className="flex flex-col gap-3">
              {MOCK_UPCOMING_ASSIGNMENTS.map((a) => (
                <GlassCard key={a.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{a.event}</p>
                    <p className="text-xs text-muted">{a.dj}</p>
                  </div>
                  <span className="text-xs text-muted">{a.date}</span>
                </GlassCard>
              ))}
            </div>
          </section>

          <section>
            <p className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <Megaphone size={16} className="text-gold" /> Announcements
            </p>
            <div className="flex flex-col gap-3">
              {MOCK_ANNOUNCEMENTS.map((a) => (
                <GlassCard key={a.id} className="text-sm">
                  <p className="text-muted">{a.text}</p>
                  <p className="mt-2 text-xs text-muted/60">
                    {a.author} &middot; {a.time}
                  </p>
                </GlassCard>
              ))}
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

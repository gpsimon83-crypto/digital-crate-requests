import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { Music2, LayoutTemplate, FileStack } from "lucide-react";

const MUSIC_PLAN_SECTIONS = [
  { label: "Ceremony", items: ["Processional", "Wedding party entrance", "Bride entrance", "Recessional"] },
  {
    label: "Reception",
    items: ["Bridal party order", "Grand march", "First dance", "Father/daughter dance", "Mother/son dance"]
  },
  { label: "Special dances", items: ["Snowball Dance", "Anniversary Dance", "Surprise Guest First Dance"] },
  { label: "Games", items: ["Shoe Game", "Table Dash Game"] }
];

export default function AdminTemplatesPage() {
  return (
    <>
      <PageHeader title="Templates" subtitle="Reusable forms and questionnaires you send to clients." />
      <div className="flex flex-col gap-4 p-6">
        <GlassCard className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <Music2 size={20} className="mt-0.5 shrink-0 text-gold" />
            <div>
              <p className="text-sm font-semibold">Wedding Music Plan</p>
              <p className="mt-1 text-sm text-muted">
                Sent to a couple from a wedding project&rsquo;s Files tab, once their first payment is in. They fill it
                out in their portal — type each song themselves or search Spotify to fill it in for them.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 sm:grid-cols-4">
            {MUSIC_PLAN_SECTIONS.map((s) => (
              <div key={s.label}>
                <p className="text-[10px] uppercase tracking-[1.5px] text-muted">{s.label}</p>
                <ul className="mt-1 flex flex-col gap-0.5 text-xs text-muted">
                  {s.items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </GlassCard>

        <Link href="/admin/crate-templates">
          <GlassCard className="flex items-start gap-3 transition-colors hover:border-gold/40">
            <LayoutTemplate size={20} className="mt-0.5 shrink-0 text-gold" />
            <div>
              <p className="text-sm font-semibold">Crate Templates</p>
              <p className="text-xs text-muted">Recommended genre/era balance for common event types — manage these separately.</p>
            </div>
          </GlassCard>
        </Link>

        <div className="flex items-start gap-3 border border-border p-4">
          <FileStack size={18} className="mt-0.5 shrink-0 text-muted" />
          <p className="text-sm text-muted">
            Contract and email reply templates aren&rsquo;t editable here yet — contracts are still sent as a linked
            document from a project&rsquo;s Files tab.
          </p>
        </div>
      </div>
    </>
  );
}

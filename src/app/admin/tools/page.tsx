import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { LayoutTemplate, Boxes, DollarSign, KeyRound, CreditCard, Database, ExternalLink, CalendarClock, FolderOpen } from "lucide-react";

const INTERNAL_TOOLS = [
  { href: "/admin/tools/scheduler", label: "Scheduler", description: "Set weekly hours so leads can book a consultation call.", icon: CalendarClock },
  { href: "/admin/files", label: "Library", description: "Email templates, contracts, brochures, and questionnaires.", icon: FolderOpen },
  { href: "/admin/crate-templates", label: "Crate Templates", description: "Manage the DJ music-curation crates.", icon: LayoutTemplate },
  { href: "/admin/equipment", label: "Equipment", description: "Track gear inventory and maintenance.", icon: Boxes },
  { href: "/admin/monetization", label: "Monetization", description: "Pricing, tip splits, and Stripe settings.", icon: DollarSign },
  { href: "/admin/invite-codes", label: "Invite Codes", description: "Generate and manage DJ signup codes.", icon: KeyRound }
];

const EXTERNAL_TOOLS = [
  { href: "https://dashboard.stripe.com", label: "Stripe Dashboard", description: "Payments, payouts, and disputes.", icon: CreditCard },
  { href: "https://supabase.com/dashboard", label: "Supabase", description: "Database, auth, and storage.", icon: Database }
];

export default function AdminToolsPage() {
  return (
    <>
      <PageHeader title="Tools" subtitle="Utilities and connected services for running the business." />
      <div className="flex flex-col gap-6 p-6">
        <div>
          <p className="mb-3 text-xs uppercase tracking-[2px] text-muted">Internal</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {INTERNAL_TOOLS.map(({ href, label, description, icon: Icon }) => (
              <Link key={href} href={href}>
                <GlassCard className="flex items-start gap-3 transition-colors hover:border-gold/40">
                  <Icon size={20} className="mt-0.5 shrink-0 text-gold" />
                  <div>
                    <p className="text-sm font-semibold">{label}</p>
                    <p className="text-xs text-muted">{description}</p>
                  </div>
                </GlassCard>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-3 text-xs uppercase tracking-[2px] text-muted">Connected services</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {EXTERNAL_TOOLS.map(({ href, label, description, icon: Icon }) => (
              <a key={href} href={href} target="_blank" rel="noreferrer">
                <GlassCard className="flex items-start gap-3 transition-colors hover:border-gold/40">
                  <Icon size={20} className="mt-0.5 shrink-0 text-gold" />
                  <div className="flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-semibold">
                      {label} <ExternalLink size={12} className="text-muted" />
                    </p>
                    <p className="text-xs text-muted">{description}</p>
                  </div>
                </GlassCard>
              </a>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

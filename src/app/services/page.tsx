import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/site/logo";
import { ServicesBrowser } from "@/components/site/services-browser";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadAdminCatalog, toPublicCatalog, type PublicCategory } from "@/lib/data/catalog";

export const metadata: Metadata = { title: "Services & Packages | Digital Crate DJs", description: "DJ packages for weddings, private parties, bars, school events and corporate events." };
// Catalog edits show within a minute.
export const revalidate = 60;

async function getCatalog(): Promise<PublicCategory[]> {
  try {
    const c = await loadAdminCatalog(createAdminClient(), { withPayout: false });
    return c.ready ? toPublicCatalog(c) : [];
  } catch {
    return [];
  }
}

export default async function ServicesPage() {
  const categories = await getCatalog();
  return (
    <div className="min-h-dvh bg-background">
      <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-black/8 bg-background/90 px-6 py-4 backdrop-blur sm:px-10">
        <Link href="/" className="flex items-center gap-2">
          <Logo variant="icon" brand="crates-djs" size={32} />
          <span className="text-sm font-semibold tracking-wide">Digital Crate DJs</span>
        </Link>
        <Link href="/#booking" className="text-xs font-semibold uppercase tracking-widest text-gold">
          Check your date
        </Link>
      </nav>
      <main className="mx-auto w-full max-w-[1280px] px-4 pb-20 pt-10 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Services</p>
        <h1 className="mt-2 font-display text-4xl font-light sm:text-5xl">Packages for every kind of night</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted">Pick your event type to see what&apos;s included. Every booking starts with a quick request so we can confirm your date and DJ.</p>
        {categories.length ? <ServicesBrowser categories={categories} /> : <p className="mt-10 text-sm text-muted">Our packages are being updated. Send a request and we&apos;ll send you options for your event.</p>}
      </main>
    </div>
  );
}

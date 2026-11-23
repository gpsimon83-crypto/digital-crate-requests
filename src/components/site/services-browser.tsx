"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { priceLabel, type PublicCategory } from "@/lib/data/catalog";

/** Category tabs with package cards and add-ons. Client-facing: only public fields. */
export function ServicesBrowser({ categories }: { categories: PublicCategory[] }) {
  const [slug, setSlug] = useState(categories[0]?.slug);
  const cat = categories.find((c) => c.slug === slug) ?? categories[0];
  return (
    <div className="mt-8 flex flex-col gap-8">
      <div role="tablist" aria-label="Event type" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {categories.map((c) => (
          <button
            key={c.slug}
            role="tab"
            id={`tab-${c.slug}`}
            aria-selected={c.slug === cat.slug}
            aria-controls="services-panel"
            onClick={() => setSlug(c.slug)}
            className={cn(
              "h-10 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
              c.slug === cat.slug ? "border-gold bg-gold font-semibold text-[var(--on-gold,#1a140a)]" : "border-border hover:border-gold/60"
            )}
          >
            {c.name}
          </button>
        ))}
      </div>
      <section id="services-panel" role="tabpanel" aria-labelledby={`tab-${cat.slug}`} className="flex flex-col gap-10">
        <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {cat.packages.map((p) => (
            <li key={p.id} className="glass-card flex min-w-0 flex-col gap-3 p-6" data-public-package={p.name}>
              <div className="flex items-start justify-between gap-3">
                <h2 className="min-w-0 break-words text-xl font-semibold leading-snug">{p.name}</h2>
                <p className="shrink-0 text-right text-lg font-semibold text-gold">{priceLabel(p)}</p>
              </div>
              {p.hours != null && <p className="-mt-1 text-sm text-muted">{p.pricing_type === "starting_at" ? `Up to ${p.hours} hours` : `${p.hours} hours`}</p>}
              {p.description && <p className="text-sm text-foreground/85">{p.description}</p>}
              <ul className="flex flex-col gap-1.5 text-sm">
                {p.features.map((f, i) => (
                  <li key={`${f}-${i}`} className="flex gap-2">
                    <Check size={15} aria-hidden className="mt-0.5 shrink-0 text-gold" />
                    {f}
                  </li>
                ))}
                {p.included_addons
                  .filter((a) => !p.features.some((f) => f.toLowerCase().includes(a.toLowerCase().replace(/^room /, ""))))
                  .map((a) => (
                    <li key={a} className="flex gap-2">
                      <Check size={15} aria-hidden className="mt-0.5 shrink-0 text-gold" />
                      {a} <span className="text-xs text-muted">Included</span>
                    </li>
                  ))}
              </ul>
              {p.quote_before_payment && <p className="text-xs text-muted">We confirm your exact quote before any payment.</p>}
              <Link href={`/?package=${p.id}#booking`} className="mt-auto inline-flex h-11 items-center justify-center rounded-[10px] border border-gold px-4 text-sm font-semibold transition-colors hover:bg-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
                {p.pricing_type === "quote" ? "Request a quote" : "Request this package"}
              </Link>
            </li>
          ))}
        </ul>
        {cat.addons.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold">Add-ons</h2>
            <ul className="mt-3 divide-y divide-border border-y border-border">
              {cat.addons.map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">{a.name}</p>
                    {a.description && <p className="text-sm text-muted">{a.description}</p>}
                  </div>
                  <span className="font-semibold text-gold">${a.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">Add-ons a package already includes are marked Included and aren&apos;t charged again.</p>
          </div>
        )}
      </section>
    </div>
  );
}

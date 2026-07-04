import Link from "next/link";
import { Logo } from "@/components/site/logo";

const NAV = [
  { href: "/book-a-dj", label: "Book a DJ" },
  { href: "/djs", label: "Meet Our DJs" },
  { href: "/venues", label: "Venues" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <Logo variant="icon" color="gold" size={26} />
          <span className="text-sm font-bold tracking-wide">Digital Crate DJs</span>
        </Link>
        <nav className="hidden gap-6 text-sm text-muted md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hover:text-foreground transition-colors">
              {n.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/r"
          className="rounded-full border border-gold/50 px-4 py-2 text-xs font-semibold text-gold"
        >
          Crate Requests
        </Link>
      </div>
    </header>
  );
}

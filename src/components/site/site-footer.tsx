import { Logo } from "@/components/site/logo";

export function SiteFooter() {
  return (
    <footer className="flex flex-col items-center gap-3 border-t border-white/10 px-6 py-10 text-center text-xs text-muted">
      <Logo variant="icon" color="gold" size={22} />
      <p>&copy; {new Date().getFullYear()} Digital Crate DJs. Digital Crate Requests™ is a product of Digital Crate DJs.</p>
    </footer>
  );
}

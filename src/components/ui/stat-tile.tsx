import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Compact metric tile — one connected surface (tonal shift, not a heavy
 * card), sized to the number it shows rather than a fixed oversized box.
 */
export function StatTile({
  icon: Icon,
  label,
  value,
  href,
  tone = "default"
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  href?: string;
  tone?: "default" | "urgent";
}) {
  const content = (
    <div className="flex items-center gap-3 border-r border-border px-4 py-3 last:border-r-0">
      <Icon size={16} className={tone === "urgent" ? "text-status-urgent" : "text-gold"} strokeWidth={1.75} />
      <div className="flex flex-col">
        <span className={cn("text-lg font-semibold leading-tight tabular-nums", tone === "urgent" && "text-status-urgent")}>
          {value}
        </span>
        <span className="text-[11px] leading-tight text-muted">{label}</span>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="transition-colors hover:bg-black/[0.02]">
        {content}
      </Link>
    );
  }
  return content;
}

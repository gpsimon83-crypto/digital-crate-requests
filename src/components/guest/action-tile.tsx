import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ActionTile({
  icon: Icon,
  title,
  subtitle,
  variant = "solid",
  className,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  variant?: "solid" | "outline";
  className?: string;
}) {
  const solid = variant === "solid";
  return (
    <div
      className={cn(
        "flex w-full items-center gap-4 rounded-2xl px-5 py-4 transition-transform active:scale-[0.98]",
        solid
          ? "text-black"
          : "glass-card border-gold/30 text-foreground",
        className
      )}
      style={
        solid
          ? { background: "linear-gradient(155deg, var(--gold-light), var(--gold) 55%)", boxShadow: "0 6px 16px -6px rgba(240,185,74,0.45)" }
          : undefined
      }
    >
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
          solid ? "bg-black/15" : "bg-gold/15"
        )}
      >
        <Icon size={20} className={solid ? "text-black" : "text-gold"} />
      </span>
      <span className="text-left">
        <span className="block text-sm font-bold">{title}</span>
        <span className={cn("block text-xs", solid ? "text-black/70" : "text-muted")}>{subtitle}</span>
      </span>
    </div>
  );
}

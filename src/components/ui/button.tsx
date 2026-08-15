import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "text" | "icon" | "destructive" | "cta" | "cta-outline";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-gold text-[#1A140A] border border-transparent hover:brightness-[1.06]",
  secondary: "bg-transparent text-foreground border border-black/15 hover:border-gold",
  text: "bg-transparent text-gold border border-transparent hover:underline px-1.5",
  icon: "bg-transparent text-muted border border-transparent hover:text-foreground hover:bg-black/5",
  destructive: "bg-transparent text-status-declined border border-status-declined/30 hover:bg-status-declined/10",
  cta: "btn-glow text-black border border-transparent",
  ["cta-outline"]: "btn-glow bg-transparent border-2 border-gold text-foreground hover:bg-gold/5"
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm"
};

const ICON_SIZE_CLASSES: Record<Size, string> = {
  sm: "h-8 w-8",
  md: "h-9 w-9"
};

const CTA_CLASSES = "inline-flex items-center justify-center gap-2 rounded-2xl px-7 py-3.5 text-sm font-bold tracking-wide min-h-[50px] transition-colors disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50";

/**
 * The one button system for Admin, DJ Dashboard, and Client Portal.
 * primary/secondary/text/icon/destructive cover routine toolbar actions;
 * cta/cta-outline are the large gold CTA for conversion-critical actions
 * (pay, sign, book, wizard progression) — use them deliberately, not as
 * the default "gold button," or every action ends up the same size again.
 */
export function Button({ className, variant = "secondary", size = "md", style, ...props }: ButtonProps) {
  if (variant === "cta" || variant === "cta-outline") {
    return (
      <button
        className={cn(CTA_CLASSES, VARIANT_CLASSES[variant], className)}
        style={
          variant === "cta"
            ? { background: "linear-gradient(155deg, var(--gold-light), var(--gold) 55%)", ...style }
            : style
        }
        {...props}
      />
    );
  }

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-[10px] font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50",
        variant === "icon" ? ICON_SIZE_CLASSES[size] : SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        className
      )}
      style={style}
      {...props}
    />
  );
}

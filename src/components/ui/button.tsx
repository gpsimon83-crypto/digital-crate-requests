import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "text" | "icon" | "destructive";
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
  destructive: "bg-transparent text-status-declined border border-status-declined/30 hover:bg-status-declined/10"
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm"
};

const ICON_SIZE_CLASSES: Record<Size, string> = {
  sm: "h-8 w-8",
  md: "h-9 w-9"
};

/**
 * Compact admin/dashboard button system — primary/secondary/text/icon/
 * destructive at one consistent height scale. Deliberately separate from
 * NeonButton, which stays as the large gold CTA for conversion-critical
 * public/client actions (pay, sign, book) where that weight is earned;
 * using it for routine dashboard toolbar actions was the "oversized
 * button" problem this component fixes.
 */
export function Button({ className, variant = "secondary", size = "md", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-[2px] font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50",
        variant === "icon" ? ICON_SIZE_CLASSES[size] : SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        className
      )}
      {...props}
    />
  );
}

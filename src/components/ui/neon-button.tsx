import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

const COLOR_MAP = {
  cyan: "var(--neon-cyan)",
  purple: "var(--neon-purple)",
  pink: "var(--neon-pink)",
  lime: "var(--neon-lime)",
  orange: "var(--neon-orange)",
  blue: "var(--neon-blue)",
  gold: "var(--neon-gold)",
} as const;

type NeonColor = keyof typeof COLOR_MAP;

interface NeonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  color?: NeonColor;
  variant?: "solid" | "outline";
}

export function NeonButton({
  className,
  color = "cyan",
  variant = "solid",
  style,
  ...props
}: NeonButtonProps) {
  const glow = COLOR_MAP[color];

  const base =
    "btn-glow inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-bold tracking-wide min-h-[50px] transition-colors disabled:opacity-40 disabled:pointer-events-none";

  const variantClasses =
    variant === "solid"
      ? "text-black btn-gold-solid"
      : "bg-transparent border-2 text-foreground hover:bg-black/[0.03]";

  return (
    <button
      className={cn(base, variantClasses, className)}
      style={{
        ...(variant === "solid"
          ? { background: `linear-gradient(155deg, var(--gold-light), ${glow} 55%)`, ["--glow-color" as string]: glow }
          : { borderColor: glow, ["--glow-color" as string]: glow }),
        ...style,
      }}
      {...props}
    />
  );
}

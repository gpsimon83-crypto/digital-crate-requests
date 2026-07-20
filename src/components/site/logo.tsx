import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The `color` prop is kept for backward compatibility with existing call
 * sites, but the current brand mark (public/brand/crate-request-logo.png)
 * is a single fixed-color asset (brass gold + near-black, transparent
 * background) rather than the old per-theme gold/white/black variants, so
 * it's a no-op now.
 */
export function Logo({
  variant = "full",
  size = 32,
  className,
}: {
  variant?: "full" | "icon";
  color?: "gold" | "white" | "black";
  size?: number;
  className?: string;
}) {
  const src = variant === "icon" ? "/brand/crate-request-icon.png" : "/brand/crate-request-logo.png";
  const aspect = variant === "icon" ? 330 / 250 : 881 / 765;

  return (
    <Image
      src={src}
      alt="Crate Request"
      width={Math.round(size * aspect)}
      height={size}
      className={cn("object-contain", className)}
      priority
    />
  );
}

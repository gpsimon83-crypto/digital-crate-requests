import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Two distinct marks live under this one component: "crate-request" is the
 * guest-facing song-request product (QR flow, DJ dashboard) — the original
 * default. "wing" is Digital Crate DJs' actual business logo (the winged
 * mark from cratesdjs.com), for surfaces that represent the business
 * itself rather than the request product, like the marketing homepage.
 *
 * The `color` prop is kept for backward compatibility with existing
 * crate-request call sites, which use a single fixed-color asset, so it's
 * a no-op there. The wing mark does have real black/gold variants.
 */
export function Logo({
  variant = "full",
  brand = "crate-request",
  size = 32,
  className,
}: {
  variant?: "full" | "icon";
  brand?: "crate-request" | "wing";
  color?: "gold" | "white" | "black";
  size?: number;
  className?: string;
}) {
  if (brand === "wing") {
    const src = variant === "icon" ? "/brand/wing-icon-gold.png" : "/brand/wing-logo-black.png";
    const aspect = variant === "icon" ? 800 / 400 : 839 / 600;
    return (
      <Image
        src={src}
        alt="Digital Crate DJs"
        width={Math.round(size * aspect)}
        height={size}
        className={cn("object-contain", className)}
        priority
      />
    );
  }

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

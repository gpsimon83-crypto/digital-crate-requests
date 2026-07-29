import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Three marks live under this one component: "crate-request" is the
 * guest-facing song-request product (QR flow, DJ dashboard) — the original
 * default. "wing" is the winged icon-only mark. "crates-djs" is the actual
 * primary business mark — a gold-gradient cursive signature with a "CD"
 * monogram and "EST. 2013" — the elegant direction the owner settled on
 * for the marketing homepage's nav and hero (replaced the earlier bold
 * stamped "CRATES DJS" wordmark, which read as too street/gritty next to
 * the Cormorant Garamond headline type).
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
  brand?: "crate-request" | "wing" | "crates-djs";
  color?: "gold" | "white" | "black";
  size?: number;
  className?: string;
}) {
  if (brand === "crates-djs") {
    // The full signature mark (cursive script + laurel + "EST. 2013") only
    // reads at large sizes — used as-is for variant="full". At icon sizes
    // (sidebars, login headers) it rendered as an illegible gold smudge,
    // so variant="icon" uses a tight crop of just the "CD" monogram
    // instead, which holds up down to ~24px.
    const src = variant === "icon" ? "/brand/crates-djs-icon.png" : "/brand/crates-djs-signature.png";
    return (
      <Image
        src={src}
        alt="Crates DJs"
        width={size}
        height={size}
        className={cn("object-contain", className)}
        priority
      />
    );
  }

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

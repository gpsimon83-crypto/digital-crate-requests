import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({
  variant = "full",
  color = "gold",
  size = 32,
  className,
}: {
  variant?: "full" | "icon";
  color?: "gold" | "white" | "black";
  size?: number;
  className?: string;
}) {
  const src =
    variant === "icon"
      ? `/brand/wing-icon-${color}.png`
      : `/brand/wing-logo-${color}.png`;
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

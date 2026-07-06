import Image from "next/image";
import { cn } from "@/lib/utils";

function initialsOf(name: string) {
  return name
    .replace(/^DJ\s+/i, "")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function DjAvatar({
  name,
  photoUrl,
  size = 40,
  className,
}: {
  name: string;
  photoUrl?: string | null;
  size?: number;
  className?: string;
}) {
  if (photoUrl) {
    return (
      <span
        className={cn("glow-ring block shrink-0 overflow-hidden rounded-full border border-gold/30", className)}
        style={{ width: size, height: size }}
      >
        <Image src={photoUrl} alt={name} width={size} height={size} className="h-full w-full object-cover" />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--gold-light)] to-[var(--gold-dim)] font-bold text-black",
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initialsOf(name)}
    </span>
  );
}

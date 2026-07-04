import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function GlassCard({
  className,
  neon = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { neon?: boolean }) {
  if (neon) {
    return (
      <div className={cn("neon-border", className)}>
        <div className="p-4" {...props} />
      </div>
    );
  }
  return <div className={cn("glass-card p-4", className)} {...props} />;
}

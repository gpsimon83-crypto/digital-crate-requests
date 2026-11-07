/* eslint-disable @next/next/no-img-element */
import type { CoverFocus } from "@/lib/venue/types";
import { cn } from "@/lib/utils";

/**
 * Venue cover banner. The photo is never stretched: it's cropped with
 * object-fit: cover, positioned by the saved desktop / mobile focus
 * points. The venue name and logo are HTML on top of the photo, so they
 * stay sharp and editable instead of being baked into the image.
 *
 * `force` pins one crop (used for the side-by-side previews in admin).
 */
export function VenueBanner({
  name,
  subtitle,
  logoUrl,
  coverUrl,
  focus,
  force,
  className
}: {
  name: string;
  subtitle?: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  focus: CoverFocus;
  force?: "desktop" | "mobile";
  className?: string;
}) {
  const d = `${focus.desktop.x}% ${focus.desktop.y}%`;
  const m = `${focus.mobile.x}% ${focus.mobile.y}%`;
  const aspect = force === "desktop" ? "aspect-[4/1]" : force === "mobile" ? "aspect-[27/8]" : "aspect-[27/8] md:aspect-[4/1]";
  const pos = force === "desktop" ? "[object-position:var(--vb-d)]" : force === "mobile" ? "[object-position:var(--vb-m)]" : "[object-position:var(--vb-m)] md:[object-position:var(--vb-d)]";

  return (
    <div
      className={cn("relative w-full overflow-hidden rounded-[14px] border border-[#c99428]/30 bg-[#151515]", aspect, className)}
      style={{ ["--vb-d" as string]: d, ["--vb-m" as string]: m }}
    >
      {coverUrl ? (
        <img src={coverUrl} alt="" className={cn("absolute inset-0 h-full w-full object-cover", pos)} />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,#2a2214_0%,#121212_60%,#0b0b0b_100%)]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-transparent" />
      <div className="absolute inset-0 flex items-end gap-3 p-3 sm:p-5">
        {logoUrl && (
          <img
            src={logoUrl}
            alt=""
            className={cn(
              "shrink-0 rounded-[10px] border border-[#c99428]/40 bg-black/60 object-contain p-1",
              force === "mobile" ? "h-10 w-10" : force === "desktop" ? "h-14 w-14" : "h-10 w-10 sm:h-14 sm:w-14"
            )}
          />
        )}
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-[#e5b647]">Venue Partner</p>
          <h1
            className={cn(
              "truncate font-display font-light leading-tight text-[#f6efe2]",
              force === "mobile" ? "text-xl" : force === "desktop" ? "text-3xl" : "text-xl sm:text-3xl"
            )}
          >
            {name}
          </h1>
          {subtitle && <p className="truncate text-[11px] text-[#d8cfbf]/80">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

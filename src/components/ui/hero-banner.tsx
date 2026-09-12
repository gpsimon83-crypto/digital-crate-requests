"use client";

/**
 * Optional hero banner for the top of the portal home / admin dashboard —
 * renders nothing until an admin sets at least a heading or image in
 * Platform Settings, so it never shows placeholder-looking content.
 */
export function HeroBanner({
  imageUrl,
  heading,
  subheading
}: {
  imageUrl: string | null;
  heading: string | null;
  subheading: string | null;
}) {
  if (!imageUrl && !heading) return null;

  return (
    <div
      className="relative flex min-h-[180px] flex-col justify-end overflow-hidden rounded-2xl border border-border p-6 sm:p-8"
      style={
        imageUrl
          ? { backgroundImage: `linear-gradient(0deg, rgba(10,8,4,0.65), rgba(10,8,4,0.15)), url(${imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
          : { background: "linear-gradient(155deg, var(--gold-light), var(--gold) 55%, var(--gold-dim))" }
      }
    >
      {heading && (
        <p className={`font-display text-2xl font-light sm:text-3xl ${imageUrl ? "text-white" : "text-[#1A140A]"}`}>{heading}</p>
      )}
      {subheading && <p className={`mt-1.5 max-w-xl text-sm ${imageUrl ? "text-white/85" : "text-[#1A140A]/80"}`}>{subheading}</p>}
    </div>
  );
}

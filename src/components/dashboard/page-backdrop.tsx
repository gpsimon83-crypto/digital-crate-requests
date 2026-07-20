"use client";

import { useEffect, useState } from "react";

/**
 * Full-screen, fixed, heavily-blurred backdrop behind the entire page —
 * distinct from PhotoBanner's own rotating foreground carousel. Always
 * shows the first photo uploaded to `section`, independent of whatever
 * is rotating in any PhotoBanner on the page.
 */
export function PageBackdrop({ section }: { section: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/dj/library/photos?section=${encodeURIComponent(section)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.photos?.[0]) setUrl(data.photos[0].url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [section]);

  if (!url) return null;

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        className="h-full w-full scale-125 object-cover"
        style={{ filter: "blur(64px) brightness(1.3) saturate(1.3)" }}
      />
      <div className="absolute inset-0 bg-black/55" />
    </div>
  );
}

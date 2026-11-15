"use client";

import { useEffect, useState } from "react";
import { Download, ImageIcon, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

type SentFlyer = { id: string; title: string; night_date: string | null; note: string | null; width: number; height: number; sent_at: string };

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e5b647] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b0b]";
const btn = cn("inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[10px] border border-[#c99428]/40 px-3 text-xs font-medium text-[#f3e7cf] hover:border-[#e5b647] hover:bg-[#c99428]/10", FOCUS);
const day = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

/** Saves the flyer as a JPEG (white behind any transparency), converted in the browser from the PNG. */
async function saveJpeg(f: SentFlyer) {
  const blob = await fetch(`/api/venue/flyers/${f.id}`).then((r) => {
    if (!r.ok) throw new Error();
    return r.blob();
  });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext("2d")!;
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0);
    const jpg = await new Promise<Blob | null>((res) => c.toBlob(res, "image/jpeg", 0.92));
    if (!jpg) throw new Error();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(jpg);
    a.download = `${f.title}${f.night_date ? ` ${f.night_date}` : ""}`.replace(/[^\w -]+/g, "").trim().replace(/\s+/g, "-").slice(0, 80) + ".jpg";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Venue portal: flyers Digital Crate DJs made for this venue, to view and download. */
export function VenueFlyers({ venueId, cardClass, eyebrowClass, mutedClass }: { venueId: string; cardClass: string; eyebrowClass: string; mutedClass: string }) {
  const [list, setList] = useState<SentFlyer[] | null>(null);
  const [open, setOpen] = useState<SentFlyer | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/venue/flyers?venue=${venueId}`)
      .then((r) => (r.ok ? r.json() : { flyers: [] }))
      .then((j) => live && setList(j.flyers ?? []))
      .catch(() => live && setList([]));
    return () => {
      live = false;
    };
  }, [venueId]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);

  async function jpeg(f: SentFlyer) {
    setBusy(f.id);
    setErr(null);
    try {
      await saveJpeg(f);
    } catch {
      setErr("Couldn't make the JPEG. Try the PNG instead.");
    } finally {
      setBusy(null);
    }
  }

  const downloads = (f: SentFlyer) => (
    <div className="flex flex-wrap gap-2">
      <a className={btn} href={`/api/venue/flyers/${f.id}?download=1`} download>
        <Download size={14} /> PNG
      </a>
      <button type="button" className={btn} onClick={() => void jpeg(f)} disabled={busy === f.id}>
        {busy === f.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} JPEG
      </button>
    </div>
  );

  return (
    <section id="flyers" aria-labelledby="flyers-h" className={cn(cardClass, "min-w-0 scroll-mt-20 p-4 sm:p-5")}>
      <div className="mb-3 flex min-h-11 items-center justify-between gap-2">
        <h2 id="flyers-h" className={eyebrowClass}>
          Flyers
        </h2>
      </div>
      {!list ? (
        <p className={cn("text-xs", mutedClass)}>Loading…</p>
      ) : !list.length ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <ImageIcon size={22} className="text-[#c99428]/80" />
          <p className="text-sm text-[#efe7d8]">No flyers yet</p>
          <p className={cn("max-w-[300px] text-xs", mutedClass)}>Flyers Digital Crate DJs makes for your nights will appear here, ready to download and post.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {list.map((f) => (
            <li key={f.id} className="min-w-0">
              <button type="button" className={cn("block w-full overflow-hidden rounded-[10px] border border-white/10 bg-black/40 text-left hover:border-[#e5b647]/60", FOCUS)} onClick={() => setOpen(f)} aria-label={`View ${f.title}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/venue/flyers/${f.id}`} alt="" loading="lazy" className="block w-full object-contain" style={{ aspectRatio: `${f.width} / ${f.height}` }} />
              </button>
              <p className="mt-1.5 truncate text-xs text-[#efe7d8]">{f.title}</p>
              <p className={cn("text-[11px]", mutedClass)}>{f.night_date ? day(f.night_date) : `Sent ${new Date(f.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}</p>
            </li>
          ))}
        </ul>
      )}
      {err && <p role="alert" className="mt-2 text-xs text-[#ee9a93]">{err}</p>}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label={open.title} onClick={() => setOpen(null)}>
          <div className="flex max-h-full w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-[16px] border border-[#c99428]/30 bg-[#121212] p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#f6efe2]">{open.title}</p>
                <p className={cn("text-xs", mutedClass)}>{open.night_date ? day(open.night_date) : ""}</p>
              </div>
              <button type="button" autoFocus className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#cfc6b6] hover:text-white", FOCUS)} aria-label="Close" onClick={() => setOpen(null)}>
                <X size={18} />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/venue/flyers/${open.id}`} alt={open.title} className="max-h-[65vh] w-full rounded-[10px] object-contain" />
            {open.note && <p className="text-xs text-[#e8dfcf]">{open.note}</p>}
            {downloads(open)}
            <p className={cn("text-[11px]", mutedClass)}>PNG keeps full quality; JPEG is smaller for texts and some social apps.</p>
          </div>
        </div>
      )}
    </section>
  );
}

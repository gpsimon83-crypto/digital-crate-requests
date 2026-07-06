"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { Copy, Check, Download } from "lucide-react";

export function EventQrCode({ eventCode }: { eventCode: string }) {
  const [copied, setCopied] = useState(false);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://digital-crate-requests-platform.vercel.app";
  const eventUrl = `${appUrl}/r/${eventCode}`;
  const qrSrc = `/api/qr?url=${encodeURIComponent(eventUrl)}`;

  function handleCopy() {
    navigator.clipboard.writeText(eventUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <GlassCard neon className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrSrc} alt="Event QR code" width={120} height={120} className="rounded-lg" />
        <div>
          <p className="text-sm font-semibold">Guest Access QR Code</p>
          <p className="mt-1 max-w-xs text-xs text-muted">
            Print this or display it at your event. Guests scan it to land directly on this event&apos;s Crate Requests page.
          </p>
          <p className="mt-2 break-all font-mono text-[11px] text-gold">{eventUrl}</p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-xs text-muted hover:text-foreground"
        >
          {copied ? <Check size={14} className="text-status-approved" /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy Link"}
        </button>
        <a
          href={qrSrc}
          download={`crate-requests-${eventCode}.png`}
          className="flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-xs text-muted hover:text-foreground"
        >
          <Download size={14} />
          Download
        </a>
      </div>
    </GlassCard>
  );
}

"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { TurnstileWidget } from "@/components/site/turnstile-widget";

/** Shown after a request is received: check your email, with a safe resend. */
export function CheckEmailPanel({ email, message, firstName }: { email: string; message: string; firstName?: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [showResend, setShowResend] = useState(false);

  async function resend() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/inquiries/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, turnstileToken: token })
      });
      const data = await res.json().catch(() => ({}));
      setNote(data.message || data.error || "Please try again in a few minutes.");
    } catch {
      setNote("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      setBusy(false);
      setResetKey((k) => k + 1);
    }
  }

  return (
    <GlassCard className="text-center" role="status" aria-live="polite">
      <p className="font-semibold">{firstName ? `Thank you, ${firstName}.` : "Thank you."} Please check your email.</p>
      <p className="mt-2 text-sm text-muted">{message}</p>
      <p className="mt-2 text-xs text-muted">
        Sent to <span className="text-foreground">{email}</span>. Not there? Check your spam or promotions folder.
      </p>
      {!showResend ? (
        <button type="button" onClick={() => setShowResend(true)} className="mt-4 text-xs text-gold underline-offset-2 hover:underline">
          Didn&apos;t get it? Send a new link
        </button>
      ) : (
        <div className="mx-auto mt-4 flex max-w-xs flex-col items-center gap-3">
          <TurnstileWidget action="resend_verification" onToken={setToken} resetKey={resetKey} className="w-full" />
          <NeonButton color="gold" type="button" onClick={resend} disabled={busy || !token}>
            {busy ? "Sending…" : "Send a new link"}
          </NeonButton>
          {note && <p className="text-xs text-muted">{note}</p>}
        </div>
      )}
      <p className="mt-4 text-xs text-muted">
        Having trouble? Email <a className="text-gold" href="mailto:bookings@digitalcratedjs.com">bookings@digitalcratedjs.com</a> and we&apos;ll help.
      </p>
    </GlassCard>
  );
}

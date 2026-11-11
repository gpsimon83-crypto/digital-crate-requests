"use client";

import { useState } from "react";
import { TurnstileWidget } from "@/components/site/turnstile-widget";

export function CheckEmailResend() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
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
      setNote("We couldn't reach the server. Please try again.");
    } finally {
      setBusy(false);
      setResetKey((k) => k + 1);
    }
  }

  return (
    <form onSubmit={send} className="mt-4 flex flex-col gap-3 text-left">
      <label className="block">
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted">Your email</span>
        <input
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-[2px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
        />
      </label>
      <TurnstileWidget action="resend_verification" onToken={setToken} resetKey={resetKey} />
      <button type="submit" disabled={busy || !token} className="auth-submit w-full">
        {busy ? "Sending…" : "Send a new link"}
      </button>
      {note && (
        <p className="text-center text-xs text-muted" role="status">
          {note}
        </p>
      )}
    </form>
  );
}

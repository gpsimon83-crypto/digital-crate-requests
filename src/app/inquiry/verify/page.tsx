"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, MailWarning, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/site/logo";
import { CheckEmailResend } from "@/app/inquiry/verify/resend";

type Outcome = "verified" | "received" | "already" | "expired" | "invalid" | "date_passed" | "limited" | "error";

const CONTACT = "bookings@digitalcratedjs.com";

/**
 * Email confirmation page. The token is in the URL fragment (never sent to
 * a server by the browser) and is only spent when the person presses the
 * button — email link scanners that open the page don't use it up.
 */
export default function VerifyInquiryPage() {
  const [token, setToken] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [kind, setKind] = useState<"inquiry" | "consultation">("inquiry");

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    // Reading the hash after hydration is the only way to get it; React state is the right home for it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(params.get("t"));
    setChecked(true);
    // Remove the token from the address bar and history.
    if (window.location.hash) history.replaceState(null, "", window.location.pathname);
  }, []);

  async function confirm() {
    if (!token) return;
    setBusy(true);
    try {
      const res = await fetch("/api/inquiries/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      const data = await res.json().catch(() => ({}));
      setOutcome((data.outcome as Outcome) ?? "error");
      if (data.kind === "consultation") setKind("consultation");
    } catch {
      setOutcome("error");
    } finally {
      setBusy(false);
    }
  }

  const what = kind === "consultation" ? "consultation call" : "booking request";
  let body: React.ReactNode;
  if (!checked) body = null;
  else if (outcome === "verified" || outcome === "received" || outcome === "already") {
    body = (
      <Result icon={<CheckCircle2 size={34} className="text-status-approved" />} title="You're confirmed">
        {outcome === "already" ? "This request was already confirmed — you're all set. " : "Thanks for confirming your email. "}
        {kind === "consultation"
          ? "Your consultation call is on our calendar and we've emailed you the details."
          : "Our team will reach out within 24 hours. Your date isn't reserved until we confirm it with you."}
      </Result>
    );
  } else if (outcome === "expired") {
    body = (
      <Result icon={<Clock size={34} className="text-gold" />} title="This link has expired">
        Confirmation links last 24 hours. Enter your email below and we&apos;ll send you a new one.
        <CheckEmailResend />
      </Result>
    );
  } else if (outcome === "date_passed") {
    body = (
      <Result icon={<Clock size={34} className="text-gold" />} title="That date has already passed">
        The {kind === "consultation" ? "call time" : "event date"} on this request is now in the past, so we couldn&apos;t confirm it. Please{" "}
        <Link href={kind === "consultation" ? "/schedule" : "/#book"} className="text-gold">
          send a new request
        </Link>{" "}
        or email <a href={`mailto:${CONTACT}`} className="text-gold">{CONTACT}</a>.
      </Result>
    );
  } else if (outcome === "limited") {
    body = (
      <Result icon={<MailWarning size={34} className="text-gold" />} title="Please wait a moment">
        There have been a lot of attempts from your connection. Please try again in a few minutes.
      </Result>
    );
  } else if (outcome === "invalid" || (checked && !token)) {
    body = (
      <Result icon={<MailWarning size={34} className="text-status-declined" />} title="We couldn't use this link">
        The link is incomplete or has already been replaced by a newer one. Use the most recent email from us, or request a new link below. Still stuck? Email{" "}
        <a href={`mailto:${CONTACT}`} className="text-gold">{CONTACT}</a>.
        <CheckEmailResend />
      </Result>
    );
  } else if (outcome === "error") {
    body = (
      <Result icon={<MailWarning size={34} className="text-status-declined" />} title="Something went wrong">
        We couldn&apos;t confirm your request just now. Please try again in a few minutes, or email{" "}
        <a href={`mailto:${CONTACT}`} className="text-gold">{CONTACT}</a>.
        <button type="button" onClick={() => setOutcome(null)} className="mt-3 block w-full text-xs text-gold">
          Try again
        </button>
      </Result>
    );
  } else {
    body = (
      <div className="flex flex-col items-center gap-4 text-center">
        <ShieldCheck size={34} className="text-gold" />
        <p className="text-sm text-muted">Press the button to confirm your email and send us your {what}.</p>
        <button type="button" onClick={confirm} disabled={busy} className="auth-submit w-full">
          {busy ? "Confirming…" : `Confirm my ${what}`}
        </button>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card-wrap">
        <div className="auth-card">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <Logo variant="icon" brand="crates-djs" size={48} />
            <h1 className="font-display text-3xl font-light text-foreground">Confirm your request</h1>
          </div>
          {body}
        </div>
      </div>
    </div>
  );
}

function Result({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center" role="status" aria-live="polite">
      {icon}
      <p className="font-semibold text-foreground">{title}</p>
      <div className="text-sm text-muted">{children}</div>
    </div>
  );
}

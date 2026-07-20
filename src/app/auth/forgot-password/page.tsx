"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/site/logo";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    setSubmitting(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="gl-page">
      <div className="gl-grain" />
      <div className="gl-glow" style={{ top: "-10%", left: "50%", transform: "translateX(-50%)" }} />

      <div className="gl-card-wrap">
        <div className="gl-card">
          <div className="mb-7 flex flex-col items-center gap-3 text-center">
            <Logo variant="icon" size={52} />
            <div>
              <h1 className="text-xl font-bold text-foreground">Reset Password</h1>
              <p className="mt-1 text-xs text-muted">
                {sent ? "Check your inbox for a reset link." : "We'll email you a link to set a new password."}
              </p>
            </div>
          </div>

          {sent ? (
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <CheckCircle2 size={32} className="text-status-approved" />
              <p className="text-xs text-muted">
                Sent to <span className="text-foreground">{email}</span>. Click the link there to choose a new password.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Email Address
                </span>
                <div className="gl-input-wrap">
                  <Mail size={16} />
                  <input
                    type="email"
                    required
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="gl-input"
                  />
                </div>
              </label>

              {error && <p className="text-xs text-status-declined">{error}</p>}

              <button type="submit" disabled={submitting} className="gl-submit mt-1">
                {submitting ? "Sending..." : "Send Reset Link"}
                {!submitting && <ArrowRight size={16} />}
              </button>
            </form>
          )}

          <Link
            href="/dj-dashboard/login"
            className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-muted hover:text-gold"
          >
            <ArrowLeft size={12} /> Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/site/logo";

export default function PortalSignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });

    if (signUpError) {
      setError(signUpError.message);
      setSubmitting(false);
      return;
    }

    if (!data.session) {
      setNeedsConfirmation(true);
      setSubmitting(false);
      return;
    }

    router.push("/portal");
    router.refresh();
  }

  if (needsConfirmation) {
    return (
      <div className="auth-page">
        <div className="auth-card-wrap">
          <div className="auth-card text-center">
            <Logo variant="icon" brand="crates-djs" size={48} />
            <h1 className="mt-4 font-display text-3xl font-light text-foreground">Check your email</h1>
            <p className="mt-2 text-sm text-muted">
              We sent a confirmation link to {email}. Confirm it, then{" "}
              <Link href="/portal/login" className="text-gold hover:text-gold-light">
                sign in
              </Link>{" "}
              to reach your event.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card-wrap">
        <div className="auth-card">
          <div className="mb-7 flex flex-col items-center gap-3 text-center">
            <Logo variant="icon" brand="crates-djs" size={48} />
            <div>
              <h1 className="font-display text-3xl font-light text-foreground">Create Your Account</h1>
              <p className="mt-1 text-xs text-muted">Use the same email you booked with — we&rsquo;ll connect it to your event.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted">
                Email Address
              </span>
              <div className="auth-input-wrap">
                <Mail size={16} />
                <input
                  type="email"
                  required
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="auth-input"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted">
                Password
              </span>
              <div className="auth-input-wrap">
                <Lock size={16} />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="auth-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="auth-eye-btn"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            {error && <p className="text-xs text-status-declined">{error}</p>}

            <button type="submit" disabled={submitting} className="auth-submit mt-1">
              {submitting ? "Creating account..." : "Create Account"}
              {!submitting && <ArrowRight size={16} />}
            </button>
          </form>

          <p className="mt-6 text-center text-[11px] text-muted">
            Already have an account?{" "}
            <Link href="/portal/login" className="text-gold hover:text-gold-light">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

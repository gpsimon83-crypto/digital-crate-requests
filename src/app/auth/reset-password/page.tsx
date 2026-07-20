"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { Logo } from "@/components/site/logo";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  );
}

/**
 * Landing point for password-recovery links from resetPasswordForEmail().
 * Supabase delivers a recovery session via the URL hash (#access_token=...,
 * type=recovery) — same implicit-flow shape as the SSO/magic-link callback.
 */
function ResetForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const access_token = hashParams.get("access_token");
    const refresh_token = hashParams.get("refresh_token");

    async function establishSession() {
      if (!access_token || !refresh_token) {
        setSessionError("This reset link is invalid or has expired. Request a new one.");
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) {
        setSessionError(error.message);
        return;
      }
      setReady(true);
    }

    establishSession();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.push("/dj-dashboard/bookings");
      router.refresh();
    }, 1500);
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
              <h1 className="text-xl font-bold text-foreground">Set New Password</h1>
              <p className="mt-1 text-xs text-muted">Choose a new password for your account.</p>
            </div>
          </div>

          {sessionError ? (
            <p className="text-center text-xs text-status-declined">{sessionError}</p>
          ) : done ? (
            <p className="text-center text-xs text-status-approved">Password updated — signing you in...</p>
          ) : !ready ? (
            <p className="text-center text-xs text-muted">Verifying link...</p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted">
                  New Password
                </span>
                <div className="gl-input-wrap">
                  <Lock size={16} />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Enter new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="gl-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="gl-eye-btn"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Confirm Password
                </span>
                <div className="gl-input-wrap">
                  <Lock size={16} />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Re-enter new password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="gl-input"
                  />
                </div>
              </label>

              {error && <p className="text-xs text-status-declined">{error}</p>}

              <button type="submit" disabled={submitting} className="gl-submit mt-1">
                {submitting ? "Updating..." : "Update Password"}
                {!submitting && <ArrowRight size={16} />}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

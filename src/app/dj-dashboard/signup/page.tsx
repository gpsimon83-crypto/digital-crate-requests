"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, User, Ticket, Eye, EyeOff, ArrowRight, ArrowLeft } from "lucide-react";
import { Logo } from "@/components/site/logo";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [enabled, setEnabled] = useState(true);

  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/signup-status")
      .then((r) => r.json())
      .then((d) => setEnabled(d.enabled !== false))
      .catch(() => setEnabled(true))
      .finally(() => setChecking(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, displayName, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");

      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      router.push("/dj-dashboard/bookings");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <div className="gl-page">
      <div className="gl-grain" />
      <div className="gl-glow" style={{ top: "-10%", left: "50%", transform: "translateX(-50%)" }} />

      <div className="gl-card-wrap">
        <div className="gl-card">
          <div className="mb-7 flex flex-col items-center gap-3 text-center">
            <Logo variant="full" color="gold" size={44} />
            <div>
              <h1 className="text-xl font-bold text-white">DJ Sign Up</h1>
              <p className="mt-1 text-xs text-[#9299A3]">
                {checking ? "Checking availability..." : "Enter your invite code to create your account."}
              </p>
            </div>
          </div>

          {!checking && !enabled ? (
            <p className="text-center text-xs text-[#9299A3]">
              Self-registration is currently closed. Ask your Digital Crate DJs admin to set up your account
              instead.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#8a8f98]">
                  Invite Code
                </span>
                <div className="gl-input-wrap">
                  <Ticket size={16} />
                  <input
                    type="text"
                    required
                    placeholder="DCDJ-XXXXXX"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="gl-input uppercase"
                    style={{ textTransform: "uppercase" }}
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#8a8f98]">
                  DJ Name
                </span>
                <div className="gl-input-wrap">
                  <User size={16} />
                  <input
                    type="text"
                    required
                    placeholder="How you're billed on events"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="gl-input"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#8a8f98]">
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

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#8a8f98]">
                  Password
                </span>
                <div className="gl-input-wrap">
                  <Lock size={16} />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    placeholder="At least 8 characters"
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

              {error && <p className="text-xs text-status-declined">{error}</p>}

              <button type="submit" disabled={submitting || checking} className="gl-submit mt-1">
                {submitting ? "Creating account..." : "Create Account"}
                {!submitting && <ArrowRight size={16} />}
              </button>
            </form>
          )}

          <Link
            href="/dj-dashboard/login"
            className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-[#8a8f98] hover:text-[#d6a84b]"
          >
            <ArrowLeft size={12} /> Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}

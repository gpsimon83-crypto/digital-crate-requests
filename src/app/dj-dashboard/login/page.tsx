"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { Logo } from "@/components/site/logo";
import { createClient, setRememberPreference } from "@/lib/supabase/client";

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.66-.22-2.45H12v4.63h6.47c-.28 1.5-1.13 2.77-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.8Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.1C3.25 21.3 7.31 24 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.27a12 12 0 0 0 0 10.78l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.27 6.61l4 3.1C6.22 6.86 8.87 4.75 12 4.75Z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.365 1.43c0 1.14-.463 2.212-1.222 2.998-.844.887-2.192 1.564-3.32 1.474-.148-1.096.408-2.253 1.153-2.99.844-.85 2.31-1.482 3.389-1.482Zm3.995 17.088c-.616 1.42-1.363 2.816-2.44 4.04-.99 1.128-1.973 2.26-3.5 2.286-1.5.026-1.982-.888-3.7-.888-1.716 0-2.252.862-3.674.914-1.474.052-2.6-1.22-3.6-2.34-2.05-2.298-3.62-6.5-1.514-9.34.98-1.322 2.68-2.16 4.508-2.186 1.45-.026 2.82.976 3.7.976.88 0 2.54-1.208 4.28-1.03.73.03 2.78.294 4.096 2.222-.104.066-2.446 1.428-2.42 4.262.028 3.386 2.964 4.514 3 4.53l-.736.554Z" />
    </svg>
  );
}

export default function DjLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "admin_only" ? "That page requires an admin account." : null
  );
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    setRememberPreference(rememberMe);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setSubmitting(false);
      return;
    }

    const next = searchParams.get("next") || "/dj-dashboard";
    router.push(next);
    router.refresh();
  }

  async function handleOAuth(provider: "google" | "apple") {
    setError(null);
    setOauthLoading(provider);
    setRememberPreference(true);
    const supabase = createClient();
    const next = searchParams.get("next") || "/dj-dashboard";
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (oauthError) {
      setError(oauthError.message);
      setOauthLoading(null);
    }
    // On success the browser navigates away to the provider, so no further
    // state update is needed here.
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
              <h1 className="text-xl font-bold text-white">Welcome Back</h1>
              <p className="mt-1 text-xs text-[#9299A3]">Sign in to manage your bookings and events</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8f98]">Password</span>
                <Link href="/auth/forgot-password" className="text-[11px] text-[#d6a84b] hover:text-[#ffd978]">
                  Forgot password?
                </Link>
              </div>
              <div className="gl-input-wrap">
                <Lock size={16} />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Enter your password"
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

            <label className="flex items-center gap-2 text-[11px] text-[#9299A3]">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-white/20 bg-transparent accent-[#d6a84b]"
              />
              Remember me
            </label>

            {error && <p className="text-xs text-status-declined">{error}</p>}

            <button type="submit" disabled={submitting} className="gl-submit mt-1">
              {submitting ? "Signing in..." : "Sign In"}
              {!submitting && <ArrowRight size={16} />}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[10px] uppercase tracking-wide text-[#6b7078]">Or continue with</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => handleOAuth("google")}
              disabled={oauthLoading !== null}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-xs font-medium text-[#e5e7eb] transition-colors hover:bg-white/[0.06] disabled:opacity-50"
            >
              <GoogleIcon /> Google
            </button>
            <button
              type="button"
              onClick={() => handleOAuth("apple")}
              disabled={oauthLoading !== null}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-xs font-medium text-[#e5e7eb] transition-colors hover:bg-white/[0.06] disabled:opacity-50"
            >
              <AppleIcon /> Apple
            </button>
          </div>

          <p className="mt-6 text-center text-[11px] text-[#6b7078]">
            Don&apos;t have an account? <Link href="/dj-dashboard/signup" className="text-[#d6a84b] hover:text-[#ffd978]">Sign up</Link> with your invite code.
          </p>
        </div>
      </div>
    </div>
  );
}

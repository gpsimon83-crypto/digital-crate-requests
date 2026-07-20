"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <CallbackHandler />
    </Suspense>
  );
}

/**
 * Landing point for magic-link tokens (from the SSO bridge or a normal
 * email magic link). admin.generateLink() issues implicit-flow tokens
 * delivered via the URL fragment (#access_token=...), which only the
 * browser can read — hence a client page instead of an API route.
 */
function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next = searchParams.get("next") || "/dj-dashboard";
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const access_token = hashParams.get("access_token");
    const refresh_token = hashParams.get("refresh_token");
    const code = searchParams.get("code");

    async function finish() {
      const supabase = createClient();

      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) {
          setError(error.message);
          return;
        }
      } else if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setError(error.message);
          return;
        }
      } else {
        setError("Missing auth token.");
        return;
      }

      router.replace(next);
      router.refresh();
    }

    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-6 text-center">
        <div>
          <p className="text-sm font-semibold text-status-declined">Sign-in failed</p>
          <p className="mt-1 text-xs text-muted">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <p className="text-xs text-muted">Signing you in…</p>
    </div>
  );
}

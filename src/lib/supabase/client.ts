import { createBrowserClient } from "@supabase/ssr";

const REMEMBER_KEY = "dc_remember_me";

/** Call at sign-in time before creating the client. Persists the choice
 * itself in localStorage (small, non-sensitive flag) so every later
 * createClient() call across the app — even in files that know nothing
 * about "remember me" — picks the same session storage consistently. */
export function setRememberPreference(remember: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
}

function getSessionStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  // Unset (never chosen, e.g. SSO/magic-link flows) defaults to remembered,
  // matching this app's original always-persistent behavior.
  const remembered = window.localStorage.getItem(REMEMBER_KEY) !== "0";
  return remembered ? window.localStorage : window.sessionStorage;
}

export function createClient() {
  const storage = getSessionStorage();
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    storage ? { auth: { storage } } : undefined
  );
}

"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/security/safe-redirect";
import { KeyRound, ShieldCheck, Smartphone } from "lucide-react";

interface Factor {
  id: string;
  friendly_name?: string;
  status: string;
  created_at: string;
}

export default function TwoFactorPage() {
  return (
    <Suspense fallback={null}>
      <TwoFactor />
    </Suspense>
  );
}

/**
 * Staff two-factor (authenticator app, TOTP) using Supabase Auth MFA.
 * Lockout protection: add a second authenticator as a backup, and an owner
 * can reset another staff member's two-factor from the Supabase dashboard
 * (Authentication → Users → user → Remove MFA factor).
 */
function TwoFactor() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"), "/admin");
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [aal, setAal] = useState<{ current: string | null; next: string | null }>({ current: null, next: null });
  const [enrolling, setEnrolling] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [name, setName] = useState("Authenticator app");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: f }, { data: a }] = await Promise.all([supabase.auth.mfa.listFactors(), supabase.auth.mfa.getAuthenticatorAssuranceLevel()]);
    setFactors(((f?.all ?? []) as Factor[]).filter((x) => x.status === "verified" || x.status === "unverified"));
    setAal({ current: a?.currentLevel ?? null, next: a?.nextLevel ?? null });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const verified = (factors ?? []).filter((f) => f.status === "verified");
  const needsVerify = aal.next === "aal2" && aal.current !== "aal2";

  async function verify(factorId: string, afterVerify?: () => void) {
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s/g, "") });
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: "That code didn't work. Check your app and enter the newest 6-digit code." });
      return;
    }
    setCode("");
    afterVerify?.();
    await load();
  }

  async function startEnroll() {
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    // Clear any half-finished setup first so a new QR code can be issued.
    for (const f of factors ?? []) if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `${name.trim() || "Authenticator"} ${new Date().toISOString().slice(0, 10)}` });
    setBusy(false);
    if (error || !data) {
      setMsg({ ok: false, text: needsVerify ? "Verify with your existing authenticator first." : "Couldn't start setup. Two-factor may not be enabled for this project (Supabase → Authentication → MFA)." });
      return;
    }
    setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function remove(id: string) {
    if (verified.length <= 1 && !window.confirm("Remove your only authenticator? You can set it up again afterwards.")) return;
    setBusy(true);
    const { error } = await createClient().auth.mfa.unenroll({ factorId: id });
    setBusy(false);
    setMsg(error ? { ok: false, text: "Verify with your authenticator before removing one." } : { ok: true, text: "Authenticator removed." });
    await load();
  }

  return (
    <>
      <PageHeader title="Two-factor sign-in" subtitle="Protect staff accounts with an authenticator app code in addition to the password." />
      <div className="flex max-w-2xl flex-col gap-6 p-6">
        {msg && <p className={msg.ok ? "text-sm text-status-approved" : "text-sm text-status-declined"} role="status">{msg.text}</p>}
        {factors === null && <p className="text-sm text-muted">Loading…</p>}

        {needsVerify && verified.length > 0 && (
          <section className="flex flex-col gap-3 border border-gold/40 p-4">
            <p className="flex items-center gap-2 font-medium"><ShieldCheck size={16} className="text-gold" /> Enter the code from your authenticator app</p>
            <CodeInput value={code} onChange={setCode} />
            <div className="flex gap-2">
              <Button variant="primary" disabled={busy || code.length < 6} onClick={() => verify(verified[0].id, () => router.replace(next))}>
                Verify
              </Button>
            </div>
            {verified.length > 1 && <p className="text-xs text-muted">Any of your authenticators works — the code is checked against “{verified[0].friendly_name}”. Use the backup device&apos;s code if this one isn&apos;t available.</p>}
          </section>
        )}

        {factors !== null && !needsVerify && (
          <>
            <section className="flex flex-col gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Your authenticators</h2>
              {verified.length === 0 ? (
                <p className="text-sm text-muted">None yet. Set one up below — add a second one on another device as a backup so you can&apos;t get locked out.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border border-y border-border text-sm">
                  {verified.map((f) => (
                    <li key={f.id} className="flex items-center justify-between py-2">
                      <span className="flex items-center gap-2"><Smartphone size={14} className="text-gold" /> {f.friendly_name || "Authenticator"}</span>
                      <Button size="sm" variant="destructive" disabled={busy} onClick={() => remove(f.id)}>Remove</Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {!enrolling ? (
              <section className="flex flex-col gap-3">
                <label className="block text-sm">
                  <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Device name</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="w-full rounded-[2px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none" />
                </label>
                <Button variant="primary" className="w-fit" disabled={busy} onClick={startEnroll}>
                  <KeyRound size={14} /> {verified.length ? "Add a backup authenticator" : "Set up two-factor"}
                </Button>
              </section>
            ) : (
              <section className="flex flex-col gap-3 border border-border p-4">
                <p className="text-sm">Scan this with Google Authenticator, 1Password, Authy or a similar app, then enter the 6-digit code.</p>
                {/* Supabase returns the QR code as an SVG data URI. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={enrolling.qr} alt="Two-factor setup QR code" className="h-44 w-44 bg-white p-2" />
                <p className="text-xs text-muted">Can&apos;t scan? Enter this key: <code className="select-all break-all text-foreground">{enrolling.secret}</code></p>
                <CodeInput value={code} onChange={setCode} />
                <div className="flex gap-2">
                  <Button variant="primary" disabled={busy || code.length < 6} onClick={() => verify(enrolling.id, () => { setEnrolling(null); setMsg({ ok: true, text: "Two-factor is on. Add a backup device too." }); })}>
                    Turn on
                  </Button>
                  <Button variant="secondary" onClick={() => setEnrolling(null)}>Cancel</Button>
                </div>
              </section>
            )}
            {aal.current === "aal2" && next !== "/admin" && (
              <Button variant="secondary" className="w-fit" onClick={() => router.replace(next)}>Continue</Button>
            )}
          </>
        )}
      </div>
    </>
  );
}

function CodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9 ]*"
      maxLength={7}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^\d ]/g, ""))}
      aria-label="6-digit code"
      className="w-40 rounded-[2px] border border-black/10 bg-panel px-3 py-2 text-center font-mono text-lg tracking-widest focus:border-gold focus:outline-none"
    />
  );
}

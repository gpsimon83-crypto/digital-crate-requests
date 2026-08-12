import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret, decryptSecret } from "@/lib/email-crypto";

export interface EmailAccountPublic {
  emailAddress: string;
  smtpHost: string;
  smtpPort: number;
  imapHost: string;
  imapPort: number;
  lastCheckedAt: string | null;
}

export interface EmailAccountInternal extends EmailAccountPublic {
  djId: string;
  password: string;
}

function toPublic(row: {
  email_address: string;
  smtp_host: string;
  smtp_port: number;
  imap_host: string;
  imap_port: number;
  last_checked_at: string | null;
}): EmailAccountPublic {
  return {
    emailAddress: row.email_address,
    smtpHost: row.smtp_host,
    smtpPort: row.smtp_port,
    imapHost: row.imap_host,
    imapPort: row.imap_port,
    lastCheckedAt: row.last_checked_at
  };
}

export async function getEmailAccountForDj(djId: string): Promise<EmailAccountPublic | null> {
  const db = createAdminClient();
  const { data, error } = await db.from("email_accounts").select("*").eq("dj_id", djId).maybeSingle();
  if (error) throw error;
  return data ? toPublic(data) : null;
}

/** Includes the decrypted password — only for internal send/receive use, never returned from an API route. */
export async function getEmailAccountWithSecretForDj(djId: string): Promise<EmailAccountInternal | null> {
  const db = createAdminClient();
  const { data, error } = await db.from("email_accounts").select("*").eq("dj_id", djId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...toPublic(data), djId: data.dj_id, password: decryptSecret(data.encrypted_password) };
}

export async function listAllEmailAccountsWithSecret(): Promise<EmailAccountInternal[]> {
  const db = createAdminClient();
  const { data, error } = await db.from("email_accounts").select("*");
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...toPublic(row), djId: row.dj_id, password: decryptSecret(row.encrypted_password) }));
}

export async function upsertEmailAccount(input: {
  djId: string;
  emailAddress: string;
  smtpHost: string;
  smtpPort: number;
  imapHost: string;
  imapPort: number;
  password: string;
}) {
  const db = createAdminClient();
  const { error } = await db.from("email_accounts").upsert(
    {
      dj_id: input.djId,
      email_address: input.emailAddress,
      smtp_host: input.smtpHost,
      smtp_port: input.smtpPort,
      imap_host: input.imapHost,
      imap_port: input.imapPort,
      encrypted_password: encryptSecret(input.password),
      updated_at: new Date().toISOString()
    },
    { onConflict: "dj_id" }
  );
  if (error) throw error;
}

export async function deleteEmailAccount(djId: string) {
  const db = createAdminClient();
  const { error } = await db.from("email_accounts").delete().eq("dj_id", djId);
  if (error) throw error;
}

export async function markAccountChecked(djId: string) {
  const db = createAdminClient();
  const { error } = await db.from("email_accounts").update({ last_checked_at: new Date().toISOString() }).eq("dj_id", djId);
  if (error) throw error;
}

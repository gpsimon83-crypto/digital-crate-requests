import { COMPANY_NAME } from "@/lib/merge-fields";

export const COMPANY_WEBSITE = "cratesdjs.com";

export interface SignatureDj {
  display_name: string;
  signature_phone?: string | null;
  signature_email?: string | null;
}

// Appended by the server to every client email sent from the project
// thread — the DJ fills in their own phone/email from their profile page,
// phone and email are both optional (company name + website are always
// shown, since those are the only two facts on file for every DJ).
export function buildEmailSignature(dj: SignatureDj): string {
  const lines = [`— ${dj.display_name}`, COMPANY_NAME];
  if (dj.signature_phone?.trim()) lines.push(dj.signature_phone.trim());
  if (dj.signature_email?.trim()) lines.push(dj.signature_email.trim());
  lines.push(COMPANY_WEBSITE);
  return lines.join("\n");
}

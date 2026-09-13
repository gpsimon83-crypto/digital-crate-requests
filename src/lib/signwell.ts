import crypto from "crypto";

const API_BASE = "https://www.signwell.com/api/v1";

/**
 * Embedded directly in the contract HTML body sent to SignWell — its
 * "text tags" syntax auto-places a required signature + date field at
 * this exact spot in the rendered document (signer "1" — every contract
 * here has exactly one recipient, the client). No manual x/y coordinates
 * needed. See https://developers.signwell.com/reference/adding-text-tags
 */
export const SIGNWELL_SIGNATURE_TAGS = "{{signature|1|y}} &nbsp;&nbsp; Date: {{date|1|y}}";

export interface SignWellDocument {
  id: string;
  status?: string;
  completed_pdf_url?: string | null;
}

/** Soft-unavailable (null), not a thrown error, when SIGNWELL_API_KEY isn't set — same contract as every other optional integration in this app. */
export async function createSignWellDocument(input: {
  name: string;
  subject: string;
  message: string;
  htmlBody: string;
  signerName: string;
  signerEmail: string;
}): Promise<SignWellDocument | null> {
  const apiKey = process.env.SIGNWELL_API_KEY;
  if (!apiKey) return null;

  const fileBase64 = Buffer.from(`<!doctype html><html><body>${input.htmlBody}</body></html>`, "utf-8").toString("base64");

  const res = await fetch(`${API_BASE}/documents`, {
    method: "POST",
    headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      test_mode: process.env.SIGNWELL_TEST_MODE === "true",
      name: input.name,
      subject: input.subject,
      message: input.message,
      files: [{ name: "contract.html", file_base64: fileBase64 }],
      recipients: [{ id: "1", name: input.signerName, email: input.signerEmail }],
      draft: false
    })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`SignWell document creation failed (${res.status}): ${body}`);
  }
  return (await res.json()) as SignWellDocument;
}

export async function getSignWellDocument(documentId: string): Promise<SignWellDocument | null> {
  const apiKey = process.env.SIGNWELL_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(`${API_BASE}/documents/${documentId}`, {
    headers: { "X-Api-Key": apiKey }
  });
  if (!res.ok) return null;
  return (await res.json()) as SignWellDocument;
}

/** HMAC-SHA256("{type}@{time}") keyed by the webhook id — see event-hash-verification docs. */
export function verifySignWellWebhookHash(hash: string, type: string, time: string | number): boolean {
  const webhookId = process.env.SIGNWELL_WEBHOOK_ID;
  if (!webhookId) return false;
  const expected = crypto.createHmac("sha256", webhookId).update(`${type}@${time}`).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hash));
  } catch {
    return false;
  }
}

import { countLinks } from "@/lib/security/inquiry-validation";

/**
 * Spam signals for a public submission. Every signal is evidence for a
 * human to look at, not proof: nothing here blocks a person on its own
 * except the hidden honeypot field. Free email providers, names, language
 * and location are never used.
 */

// A short, conservative list of throwaway-inbox domains.
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "sharklasers.com", "10minutemail.com", "10minutemail.net",
  "temp-mail.org", "tempmail.com", "tempmail.net", "throwawaymail.com", "yopmail.com", "yopmail.net", "trashmail.com",
  "getnada.com", "nada.email", "dispostable.com", "maildrop.cc", "mintemail.com", "fakeinbox.com", "mohmal.com",
  "emailondeck.com", "spamgourmet.com", "mailnesia.com", "tempr.email", "discard.email", "burnermail.io", "moakt.com"
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@").pop() ?? "";
  return DISPOSABLE_DOMAINS.has(domain);
}

export interface RiskInput {
  honeypotFilled: boolean;
  elapsedMs?: number;
  email: string;
  name: string;
  message?: string;
  venueName?: string;
  /** Requests from the same (normalized) email in the last 24 hours, excluding this one. */
  recentSameEmail: number;
  /** Other email addresses that sent the same message text in the last 24 hours. */
  sameMessageOtherEmails: number;
  /** Different email addresses from the same network in the last 24 hours. */
  otherEmailsFromSource: number;
  emailBlocked: boolean;
  sourceBlocked: boolean;
}

export interface RiskResult {
  score: number;
  reasons: string[];
  /** Automated (honeypot) or blocked: saved as spam, no email sent. */
  spam: boolean;
  /** Held for an admin even after the email is verified. */
  needsReview: boolean;
}

export const REVIEW_THRESHOLD = 3;

export function assessRisk(input: RiskInput): RiskResult {
  const reasons: string[] = [];
  let score = 0;
  const add = (points: number, reason: string) => {
    score += points;
    reasons.push(reason);
  };

  if (input.honeypotFilled) {
    return { score: 10, reasons: ["Filled in a hidden field that only automated tools see"], spam: true, needsReview: false };
  }
  if (input.emailBlocked) {
    return { score: 10, reasons: ["Email address is on a temporary block"], spam: true, needsReview: false };
  }
  if (input.sourceBlocked) {
    return { score: 10, reasons: ["Sent from a network that is on a temporary block"], spam: true, needsReview: false };
  }

  const stripEmails = (s?: string) => (s ?? "").replace(/[^\s@]+@[^\s@]+/g, " ");
  const links = countLinks(stripEmails(input.message), stripEmails(input.venueName));
  if (links >= 3) add(2, `Message contains ${links} links`);
  else if (links > 0) add(1, links === 1 ? "Message contains a link" : `Message contains ${links} links`);
  if (countLinks(input.name) > 0) add(2, "Name field contains a web address");

  if (input.elapsedMs !== undefined && input.elapsedMs < 3000) add(1, "Form was completed in under 3 seconds");
  if (isDisposableEmail(input.email)) add(2, "Uses a disposable (throwaway) email service");
  if (input.sameMessageOtherEmails >= 1) {
    add(input.sameMessageOtherEmails >= 2 ? 3 : 2, `Same message text was sent from ${input.sameMessageOtherEmails} other email address${input.sameMessageOtherEmails === 1 ? "" : "es"} in the last day`);
  }
  if (input.otherEmailsFromSource >= 3) add(2, `${input.otherEmailsFromSource} other email addresses were used from the same network in the last day`);
  if (input.recentSameEmail >= 3) add(1, `${input.recentSameEmail} earlier requests from this email in the last day`);

  return { score, reasons, spam: false, needsReview: score >= REVIEW_THRESHOLD };
}

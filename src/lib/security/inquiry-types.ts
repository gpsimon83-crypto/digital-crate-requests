export type InquiryKind = "inquiry" | "consultation";
export type InquirySource = "website" | "wordpress" | "scheduler";
export type InquiryStatus = "pending_verification" | "verified" | "needs_review" | "spam" | "archived";

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  pending_verification: "Pending verification",
  verified: "Verified",
  needs_review: "Needs review",
  spam: "Spam",
  archived: "Archived"
};

export interface SubmissionRow {
  id: string;
  created_at: string;
  updated_at: string;
  kind: InquiryKind;
  source: InquirySource;
  status: InquiryStatus;
  idempotency_key: string | null;
  name: string;
  email: string;
  email_normalized: string;
  phone: string | null;
  event_date: string | null;
  event_type: string | null;
  preferred_dj_id: string | null;
  venue_name: string | null;
  expected_guests: number | null;
  budget_range: string | null;
  message: string | null;
  slot_start: string | null;
  slot_end: string | null;
  message_hash: string | null;
  source_hash: string | null;
  completion_ms: number | null;
  risk_score: number;
  risk_reasons: string[];
  verification_token_hash: string | null;
  verification_expires_at: string | null;
  verification_sent_count: number;
  last_verification_sent_at: string | null;
  verified_at: string | null;
  activation_claimed_at: string | null;
  activated_at: string | null;
  event_id: string | null;
  reviewed_by: string | null;
  reviewed_by_label: string | null;
  reviewed_at: string | null;
  review_note: string | null;
}

export type NewSubmission = Omit<
  SubmissionRow,
  "id" | "created_at" | "updated_at" | "verified_at" | "activation_claimed_at" | "activated_at" | "event_id" | "reviewed_by" | "reviewed_by_label" | "reviewed_at" | "review_note"
>;

export interface Actor {
  userId: string | null;
  label: string;
}

/** Storage used by the inquiry flow. Production: Supabase. Tests: in memory. */
export interface InquiryRepo {
  findByIdempotencyKey(key: string): Promise<SubmissionRow | null>;
  findOpenDuplicate(q: { emailNormalized: string; kind: InquiryKind; eventDate?: string; eventType?: string; slotStart?: string; sinceIso: string }): Promise<SubmissionRow | null>;
  countByEmail(emailNormalized: string, sinceIso: string): Promise<number>;
  countOtherEmailsWithMessage(messageHash: string, excludeEmail: string, sinceIso: string): Promise<number>;
  countOtherEmailsFromSource(sourceHash: string, excludeEmail: string, sinceIso: string): Promise<number>;
  isBlocked(kind: "email" | "source", valueHash: string, nowIso: string): Promise<boolean>;
  insert(row: NewSubmission): Promise<SubmissionRow>;
  update(id: string, patch: Partial<SubmissionRow>): Promise<void>;
  get(id: string): Promise<SubmissionRow | null>;
  findByTokenHash(tokenHash: string): Promise<SubmissionRow | null>;
  /** Atomic single use: marks verified only if unverified, unexpired and still open. */
  consumeToken(tokenHash: string, nowIso: string): Promise<SubmissionRow | null>;
  /** Atomic: true for exactly one caller per submission. */
  claimActivation(id: string, nowIso: string): Promise<boolean>;
  releaseActivationClaim(id: string): Promise<void>;
  latestUnverifiedForEmail(emailNormalized: string, sinceIso: string): Promise<SubmissionRow | null>;
  claimHold(slotStart: string, slotEnd: string, submissionId: string, expiresIso: string): Promise<boolean>;
  releaseHold(submissionId: string): Promise<void>;
  logEvent(action: string, details: Record<string, unknown>, submissionId?: string | null, actor?: Actor): Promise<void>;
}

export type MailResult = "sent" | "not_configured" | "failed";

export interface InquiryMailer {
  sendVerification(to: string, link: string, expiresHours: number, kind: InquiryKind): Promise<MailResult>;
}

export interface InquiryActivator {
  /** Creates the real lead (and runs normal notifications). Returns the new event id. */
  activate(sub: SubmissionRow): Promise<string>;
}

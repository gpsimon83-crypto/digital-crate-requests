import { z } from "zod";
import { EVENT_TYPES } from "@/lib/event-types";
import { checkPublicEventDate, isValidDateString, isPastEventDate, PAST_DATE_MESSAGE } from "@/lib/security/business-date";

export const BUDGET_RANGES = ["Under $1,000", "$1,000–$2,000", "$2,000–$3,500", "$3,500–$5,000", "$5,000+"] as const;

// Control characters (except tab/newline) never belong in form text.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "") || v === null ? undefined : v;
const text = (max: number) =>
  z.preprocess(
    blankToUndefined,
    z
      .string()
      .trim()
      .max(max, `Please keep this under ${max} characters.`)
      .refine((s) => !CONTROL.test(s), "Please remove unusual characters.")
      .optional()
  );

const nameField = z
  .string({ error: "Please enter your name." })
  .trim()
  .min(2, "Please enter your name.")
  .max(100, "Please keep your name under 100 characters.")
  .refine((s) => !CONTROL.test(s), "Please remove unusual characters.");

const emailField = z.string({ error: "Please enter your email address." }).trim().max(254, "That email address is too long.").pipe(z.email("Please enter a valid email address."));

const phoneField = z.preprocess(
  blankToUndefined,
  z
    .string()
    .trim()
    .max(30, "Please check the phone number.")
    .regex(/^[0-9+().\-\s xX#]*$/, "Please check the phone number.")
    .refine((s) => s.replace(/\D/g, "").length >= 7, "Please check the phone number.")
    .optional()
);

/** Fields every public form may send besides its own data. */
const metaFields = {
  turnstileToken: z.preprocess(blankToUndefined, z.string().max(2048).optional()),
  // Honeypot: real people never see or fill this. Any value = automated.
  website: z.preprocess(blankToUndefined, z.string().max(500).optional()),
  // Milliseconds since the form was shown (supporting signal only).
  elapsedMs: z.preprocess(blankToUndefined, z.coerce.number().int().min(0).max(7 * 24 * 3600 * 1000).optional()),
  // Random id the browser makes per form fill, so retries don't duplicate.
  submissionId: z.preprocess(blankToUndefined, z.string().regex(/^[A-Za-z0-9_-]{8,64}$/).optional())
};

export function inquirySchema(now: Date = new Date()) {
  return z.strictObject({
    name: nameField,
    email: emailField,
    phone: phoneField,
    eventDate: z.string({ error: "Please choose your event date." }).superRefine((v, ctx) => {
      const err = checkPublicEventDate(v, now);
      if (err) ctx.addIssue({ code: "custom", message: err });
    }),
    eventType: z.enum(EVENT_TYPES, { error: "Please choose an event type." }),
    preferredDjId: z.preprocess(blankToUndefined, z.uuid("Please choose a DJ from the list.").optional()),
    venueName: text(150),
    expectedGuests: z.preprocess(
      blankToUndefined,
      z.coerce.number({ error: "Please enter a number of guests." }).int("Please enter a whole number of guests.").min(1, "Please enter at least 1 guest.").max(5000, "Please enter 5,000 guests or fewer.").optional()
    ),
    budgetRange: z.preprocess(blankToUndefined, z.enum(BUDGET_RANGES, { error: "Please choose a budget range from the list." }).optional()),
    message: text(3000),
    ...metaFields
  });
}

export type InquiryInput = z.infer<ReturnType<typeof inquirySchema>>;

export function consultationSchema(now: Date = new Date()) {
  return z.strictObject({
    name: nameField,
    email: emailField,
    phone: phoneField,
    date: z.string({ error: "Please choose a date." }).superRefine((v, ctx) => {
      if (!isValidDateString(v)) ctx.addIssue({ code: "custom", message: "Please choose a valid date." });
      else if (isPastEventDate(v, now)) ctx.addIssue({ code: "custom", message: PAST_DATE_MESSAGE });
    }),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Please choose a time."),
    message: text(2000),
    ...metaFields
  });
}

export type ConsultationInput = z.infer<ReturnType<typeof consultationSchema>>;

export interface ValidationFailure {
  message: string;
  fieldErrors: Record<string, string>;
  unexpectedFields: string[];
}

/** Turns a zod error into the first readable message plus per-field messages. */
export function describeIssues(issues: z.core.$ZodIssue[]): ValidationFailure {
  const fieldErrors: Record<string, string> = {};
  const unexpectedFields: string[] = [];
  for (const i of issues) {
    if (i.code === "unrecognized_keys") {
      unexpectedFields.push(...(i as { keys: string[] }).keys);
      continue;
    }
    const key = String(i.path[0] ?? "form");
    if (!fieldErrors[key]) fieldErrors[key] = i.message;
  }
  // The date message is the most specific one people need to see first.
  const order = ["eventDate", "date", "name", "email", "eventType", "phone", "time"];
  const first = order.map((k) => fieldErrors[k]).find(Boolean) ?? Object.values(fieldErrors)[0];
  return {
    message: first ?? (unexpectedFields.length ? "Something about this form looks wrong. Please refresh the page and try again." : "Please check the form and try again."),
    fieldErrors,
    unexpectedFields
  };
}

/** Counts links in free text (a review signal, not a rule). */
export function countLinks(...values: (string | undefined | null)[]): number {
  const re = /\b(?:https?:\/\/|www\.)[^\s<>"']+|\b[a-z0-9-]+\.(?:com|net|org|info|biz|xyz|top|ru|io|co|link|site|online|shop|click)\b/gi;
  return values.reduce((n, v) => n + ((v ?? "").match(re)?.length ?? 0), 0);
}

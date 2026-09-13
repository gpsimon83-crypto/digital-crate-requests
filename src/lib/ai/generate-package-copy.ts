import Anthropic from "@anthropic-ai/sdk";

export const COPY_TONES = ["professional", "warm", "energetic", "luxury", "casual"] as const;
export type CopyTone = (typeof COPY_TONES)[number];

export const COPY_TONE_LABELS: Record<CopyTone, string> = {
  professional: "Professional",
  warm: "Warm & Friendly",
  energetic: "Energetic & Fun",
  luxury: "Luxury & Upscale",
  casual: "Casual"
};

const TONE_GUIDANCE: Record<CopyTone, string> = {
  professional: "Clear, confident, businesslike. No slang, no exclamation points.",
  warm: "Personal and welcoming, like a trusted friend helping plan the event. Warm but not gushing.",
  energetic: "Upbeat and high-energy — this is a party, sell the excitement. Can use one exclamation point.",
  luxury: "Elevated, understated, confident — implies quality without over-explaining or using superlatives.",
  casual: "Relaxed, conversational, plain language. Contractions are fine."
};

export interface GeneratePackageCopyInput {
  field: "intro" | "confirmation";
  tone: CopyTone;
  templateName: string;
  eventType: string | null;
  tier: string | null;
  serviceNames: string[];
}

/**
 * Soft-unavailable, not a thrown error, when ANTHROPIC_API_KEY isn't set —
 * matches the pattern used by sendSystemEmail/sendInquiryAlertSms: a
 * missing integration is an honest unavailable state, never a crash.
 */
export async function generatePackageCopy(input: GeneratePackageCopyInput): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });

  const fieldInstruction =
    input.field === "intro"
      ? "Write ONE short paragraph (2-3 sentences) that appears at the top of this package for a client customizing it — it should make them excited to build their event and briefly frame what this package covers."
      : "Write ONE short paragraph (2-3 sentences) that a client sees right after saving or requesting this package — confirm it was received, reassure them it doesn't lock in their date yet, and tell them what happens next.";

  const context = [
    `Package name: ${input.templateName}`,
    input.eventType ? `Event type: ${input.eventType}` : null,
    input.tier ? `Tier: ${input.tier}` : null,
    input.serviceNames.length > 0 ? `Included/available services: ${input.serviceNames.join(", ")}` : null
  ]
    .filter(Boolean)
    .join("\n");

  const message = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 300,
    system:
      "You write short marketing/product copy for a DJ booking company's client-facing package builder. " +
      "Output ONLY the paragraph itself — no heading, no quotes, no preamble, no options to choose from.",
    messages: [
      {
        role: "user",
        content: `${fieldInstruction}\n\nTone: ${COPY_TONE_LABELS[input.tone]} — ${TONE_GUIDANCE[input.tone]}\n\n${context}`
      }
    ]
  });

  const textBlock = message.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  return textBlock?.text.trim() ?? null;
}

export interface GenerateHeroCopyInput {
  field: "heading" | "subheading";
  surface: "portal" | "admin";
}

/** Same soft-unavailable contract as generatePackageCopy — null means "not configured yet," never a thrown error. */
export async function generateHeroCopy(input: GenerateHeroCopyInput): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });

  const audience =
    input.surface === "portal"
      ? "the hero banner at the top of a wedding/event client's private portal home page, for Digital Crate DJs (a Wisconsin DJ collective)"
      : "the hero banner at the top of the internal admin dashboard, seen by DJs and staff of Digital Crate DJs";

  const fieldInstruction =
    input.field === "heading"
      ? "Write ONE short heading (3-7 words, title case, no punctuation at the end) for this banner."
      : "Write ONE short supporting subheading (one sentence, under 14 words) for this banner, to appear beneath the heading.";

  const message = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 100,
    system: "You write short banner copy for a DJ booking company's software. Output ONLY the line itself — no quotes, no preamble, no options.",
    messages: [{ role: "user", content: `${fieldInstruction}\n\nThis is ${audience}.` }]
  });

  const textBlock = message.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  return textBlock?.text.trim().replace(/^["']|["']$/g, "") ?? null;
}

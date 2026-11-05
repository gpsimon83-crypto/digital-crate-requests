// Communications Center — the email design model.
//
// A design is an ordered list of content blocks plus a theme. It is stored
// as JSON (comm_email_designs.blocks) and turned into email-safe HTML by
// render.ts. No server-only imports here: the Email Studio uses these
// types and defaults in the browser for its live preview.

export type EmailTheme = "dark" | "light";
export type Align = "left" | "center";

export type EmailBlock =
  | { id: string; type: "logo" }
  | { id: string; type: "heading"; text: string; size: "lg" | "md"; align: Align }
  | { id: string; type: "text"; text: string; align: Align }
  | { id: string; type: "image"; url: string; alt: string; link: string; width: "full" | "medium" | "small" }
  | { id: string; type: "button"; label: string; url: string; align: Align; style: "solid" | "outline" }
  | { id: string; type: "divider" }
  | { id: string; type: "spacer"; height: number }
  | { id: string; type: "social"; instagram: string; facebook: string; tiktok: string; youtube: string; website: string }
  | { id: string; type: "footer"; text: string };

export type EmailBlockType = EmailBlock["type"];

export type EmailAudience = "client" | "dj";

export const AUDIENCE_LABELS: Record<EmailAudience, string> = { client: "Clients", dj: "DJ team" };

export interface EmailDesign {
  name: string;
  audience: EmailAudience;
  subject: string;
  preheader: string;
  theme: EmailTheme;
  blocks: EmailBlock[];
}

export const BLOCK_LABELS: Record<EmailBlockType, string> = {
  logo: "Logo",
  heading: "Heading",
  text: "Text",
  image: "Image",
  button: "Button",
  divider: "Divider",
  spacer: "Spacer",
  social: "Social links",
  footer: "Footer"
};

export function newBlockId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function defaultBlock(type: EmailBlockType): EmailBlock {
  const id = newBlockId();
  switch (type) {
    case "logo":
      return { id, type };
    case "heading":
      return { id, type, text: "Your headline here", size: "lg", align: "center" };
    case "text":
      return { id, type, text: "Hi {{first_name}},\n\nWrite your message here. Add a link like [this one](https://digitalcratedjs.com).", align: "left" };
    case "image":
      return { id, type, url: "", alt: "", link: "", width: "full" };
    case "button":
      return { id, type, label: "View your portal", url: "{{portal_link}}", align: "center", style: "solid" };
    case "divider":
      return { id, type };
    case "spacer":
      return { id, type, height: 24 };
    case "social":
      return { id, type, instagram: "", facebook: "", tiktok: "", youtube: "", website: "https://digitalcratedjs.com" };
    case "footer":
      return { id, type, text: "Digital Crate DJs · Wisconsin & Beyond\nQuestions? Just reply to this email." };
  }
}

/** Merge fields available in subjects, text, button links and image links. */
export const MERGE_FIELDS: { token: string; label: string; sample: string }[] = [
  { token: "first_name", label: "First name", sample: "Jordan" },
  { token: "last_name", label: "Last name", sample: "Miller" },
  { token: "full_name", label: "Full name", sample: "Jordan Miller" },
  { token: "company_name", label: "Company name", sample: "Digital Crate DJs" },
  { token: "event_type", label: "Event type", sample: "Wedding" },
  { token: "event_date", label: "Event date", sample: "Saturday, June 12, 2027" },
  { token: "event_time", label: "Event start time", sample: "5:00 PM" },
  { token: "venue_name", label: "Venue", sample: "The Edgewater" },
  { token: "dj_name", label: "Assigned DJ", sample: "DJ Peace" },
  { token: "portal_link", label: "Client portal link", sample: "https://cratesdjs.com/portal" },
  { token: "review_link", label: "Review link (from Settings)", sample: "https://g.page/r/digital-crate-djs/review" },
  { token: "members_link", label: "DJ members area link", sample: "https://digitalcratedjs.com/members/" }
];

export type MergeValues = Partial<Record<string, string>>;

export const SAMPLE_MERGE_VALUES: MergeValues = Object.fromEntries(MERGE_FIELDS.map((f) => [f.token, f.sample]));

/** Every {{token}} the design uses (subject + all block fields). */
export function tokensUsed(design: Pick<EmailDesign, "subject" | "preheader" | "blocks">): string[] {
  const found = new Set<string>();
  const scan = (s: string) => {
    for (const m of s.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)) found.add(m[1]);
  };
  scan(design.subject);
  scan(design.preheader);
  for (const b of design.blocks) {
    for (const v of Object.values(b)) if (typeof v === "string") scan(v);
  }
  return [...found];
}

/** Tokens in the design that are unknown or have no value for this recipient. */
export function missingTokens(design: Pick<EmailDesign, "subject" | "preheader" | "blocks">, values: MergeValues): string[] {
  return tokensUsed(design).filter((t) => !values[t] || !String(values[t]).trim());
}

export function isKnownToken(token: string): boolean {
  return MERGE_FIELDS.some((f) => f.token === token);
}

/** Basic shape check for designs coming from the API (never trust stored JSON blindly). */
export function sanitizeDesign(input: unknown): EmailDesign {
  const d = (input ?? {}) as Partial<EmailDesign>;
  const str = (v: unknown, max = 5000) => (typeof v === "string" ? v.slice(0, max) : "");
  const blocks: EmailBlock[] = [];
  for (const raw of Array.isArray(d.blocks) ? d.blocks.slice(0, 80) : []) {
    const b = raw as Record<string, unknown>;
    const type = b?.type as EmailBlockType;
    if (!type || !(type in BLOCK_LABELS)) continue;
    const base = defaultBlock(type) as unknown as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...base, id: str(b.id, 40) || base.id };
    for (const [k, v] of Object.entries(base)) {
      if (k === "id" || k === "type") continue;
      if (typeof v === "number") merged[k] = Math.max(0, Math.min(120, Number(b[k]) || v));
      else if (typeof v === "string") merged[k] = k in b ? str(b[k]) : v;
    }
    if (type === "heading") merged.size = b.size === "md" ? "md" : "lg";
    if (type === "heading" || type === "text" || type === "button") merged.align = b.align === "center" ? "center" : "left";
    if (type === "button") merged.style = b.style === "outline" ? "outline" : "solid";
    if (type === "image") merged.width = b.width === "medium" || b.width === "small" ? b.width : "full";
    blocks.push(merged as unknown as EmailBlock);
  }
  return {
    name: str(d.name, 200) || "Untitled email",
    audience: d.audience === "dj" ? "dj" : "client",
    subject: str(d.subject, 300),
    preheader: str(d.preheader, 300),
    theme: d.theme === "light" ? "light" : "dark",
    blocks
  };
}

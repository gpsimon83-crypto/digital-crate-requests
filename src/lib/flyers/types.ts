import type { PhotoEffects } from "./effects";
import type { ImageMask } from "./mask";

/**
 * Flyer Creator scene format. A flyer is a list of independent layers
 * (never flattened while editing); exports are rendered from this data.
 */

export const FORMATS = {
  square: { width: 1080, height: 1080, label: "Square post", size: "1080 × 1080" },
  portrait: { width: 1080, height: 1350, label: "Portrait post", size: "1080 × 1350" },
  story: { width: 1080, height: 1920, label: "Story", size: "1080 × 1920" }
} as const;
export type FormatKey = keyof typeof FORMATS;
export const FORMAT_KEYS = Object.keys(FORMATS) as FormatKey[];

/** What a layer is for. Drives the layer's default name and how templates fill it. */
export const ROLES = {
  background: "Background image",
  portrait: "DJ portrait",
  logo: "Venue logo",
  title: "Event title",
  dj_name: "DJ name",
  date: "Date",
  time: "Time",
  venue: "Venue",
  address: "Address",
  details: "Supporting text",
  specials: "Drink specials",
  dj_logo: "DJ name logo",
  overlay: "Decorative overlay",
  shape: "Shape",
  text: "Text",
  image: "Image"
} as const;
export type Role = keyof typeof ROLES;

/** Placeholders a template's text can use; filled from the DJ's profile and (optionally) a booking. */
export const PLACEHOLDERS = {
  dj_name: "DJ name",
  event_title: "Event title",
  event_date: "Event date",
  event_weekday: "Day of the week",
  event_month: "Month (short)",
  event_day: "Day of the month",
  event_weekday_short: "Weekday (WED)",
  event_month_short: "Month (NOV)",
  event_day_number: "Day number (25)",
  event_month_day: "Month and day (NOV 25)",
  event_time_range: "Start–end time",
  event_year: "Year",
  dj_lineup: "DJ lineup (every DJ)",
  venue_street: "Venue street",
  venue_city: "Venue city, state, ZIP",
  start_time: "Start time",
  end_time: "End time",
  venue_name: "Venue name",
  venue_address: "Venue address"
} as const;
export type PlaceholderKey = keyof typeof PLACEHOLDERS;
/** Values by placeholder key: the keys above plus dj2_name, dj3_name…, drink_specials, event_details. */
export type PlaceholderValues = Partial<Record<PlaceholderKey, string | null>> & Record<string, string | null | undefined>;

/**
 * Structured placeholders (what templates should use). Each maps to a value
 * key above; {{dj2.displayName}} etc. address the 2nd, 3rd… DJ slot.
 * Older templates' {{dj_name}}-style tokens keep working.
 */
export const FIELD_TOKENS = {
  "dj.displayName": { key: "dj_name", label: "DJ name" },
  "event.title": { key: "event_title", label: "Event title" },
  "event.date": { key: "event_date", label: "Event date" },
  "event.weekday": { key: "event_weekday", label: "Day of the week" },
  "event.month": { key: "event_month", label: "Month (short)" },
  "event.day": { key: "event_day", label: "Day of the month" },
  "event.weekdayShort": { key: "event_weekday_short", label: "Weekday (WED)" },
  "event.monthShort": { key: "event_month_short", label: "Month (NOV)" },
  "event.dayNumber": { key: "event_day_number", label: "Day number (25)" },
  "event.monthDay": { key: "event_month_day", label: "Month and day (NOV 25)" },
  "event.timeRange": { key: "event_time_range", label: "Start–end time (9 PM–1 AM)" },
  "event.year": { key: "event_year", label: "Year (2026)" },
  "dj.lineup": { key: "dj_lineup", label: "DJ lineup (DJ ONE • DJ TWO)" },
  "venue.street": { key: "venue_street", label: "Venue street" },
  "venue.cityLine": { key: "venue_city", label: "Venue city, state, ZIP" },
  "event.startTime": { key: "start_time", label: "Start time" },
  "event.endTime": { key: "end_time", label: "End time" },
  "event.drinkSpecials": { key: "drink_specials", label: "Drink specials" },
  "event.details": { key: "event_details", label: "Event details (occasion)" },
  "venue.name": { key: "venue_name", label: "Venue name" },
  "venue.address": { key: "venue_address", label: "Venue address" }
} as const;

/** Linked-content settings shared by every layer. */
export type LinkOpts = {
  /** Required for export: flagged before export when its linked content is empty. */
  required?: boolean;
  /** Only show this layer when this value has content (e.g. "drink_specials" for a specials heading). */
  showWhen?: string | null;
};

/** Blend modes, as canvas names them ("normal" = source-over). */
export const BLEND_MODES = {
  normal: "Normal",
  multiply: "Multiply",
  screen: "Screen",
  overlay: "Overlay",
  "soft-light": "Soft light",
  "hard-light": "Hard light",
  darken: "Darken",
  lighten: "Lighten",
  "color-dodge": "Color dodge",
  "color-burn": "Color burn",
  difference: "Difference",
  exclusion: "Exclusion",
  hue: "Hue",
  saturation: "Saturation",
  color: "Color",
  luminosity: "Luminosity"
} as const;
export type BlendMode = keyof typeof BLEND_MODES;

export type Shadow = { enabled: boolean; color: string; blur: number; offsetX: number; offsetY: number; opacity: number };
export type Stroke = { enabled: boolean; color: string; width: number };

/** What a DJ may do with a template layer. Staff can always do everything. */
export type Perms = { move: boolean; edit: boolean; style: boolean; remove: boolean };

export type ImageSource =
  | { type: "asset"; assetId: string }
  | { type: "static"; src: string }
  /** The DJ in slot N (1 = lead): their preferred approved cutout, else their profile photo. */
  | { type: "dj_photo"; djId?: string | null; slot?: number }
  /** The DJ in slot N: their preferred approved name logo, else their name as styled text. */
  | { type: "dj_logo"; djId?: string | null; slot?: number }
  | { type: "venue_logo"; venueId?: string | null }
  | { type: "none" };

type Base = {
  id: string;
  name: string;
  role: Role;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  /** How the layer mixes with what's under it (Photoshop-style blend modes). */
  blend: BlendMode;
  visible: boolean;
  /** Locked in the editor: can't be moved or resized by accident. */
  locked: boolean;
  groupId: string | null;
  perms: Perms;
  link?: LinkOpts;
  /**
   * Effects (versioned settings; the layer's own content is untouched):
   * preset, strength, changed parameters, texture seed and bottom fade.
   * Any layer can have them. Missing on older flyers = no effects.
   */
  effects?: PhotoEffects | null;
};

export type ImageNode = Base & {
  kind: "image";
  source: ImageSource;
  /** cover = fill the frame (cropping); contain = fit inside the frame (nothing cropped). */
  fit: "cover" | "contain";
  /** Non-destructive crop inside the frame: zoom ≥ 1, x/y = pan from -1 (left/top) to 1 (right/bottom). */
  crop: { zoom: number; x: number; y: number };
  flipX: boolean;
  flipY: boolean;
  frame: Stroke & { radius: number };
  /** Soft edges: the picture fades to transparent over `amount` px, as a soft rectangle or an oval. */
  feather: {
    amount: number;
    shape: "edges" | "oval";
    /** Soft rectangle only: fade width per side in px (missing = every side uses `amount`). */
    sides?: { top: number; right: number; bottom: number; left: number } | null;
    /** smooth = eased S-curve fade; linear = even fade. */
    curve?: "smooth" | "linear";
  };
  /**
   * Recolor: "solid" paints the whole picture one color (keeps its shape and
   * transparency, e.g. a black logo in gold); "tint" colors it but keeps
   * light and shade. knockoutWhite makes a white background see-through.
   */
  recolor: { mode: "none" | "solid" | "tint"; color: string; knockoutWhite: boolean };
  /**
   * Layer mask (non-destructive): hide/restore brush strokes, a linear or
   * radial fade and edge feather, in the picture's own coordinates. Missing
   * on older flyers = the picture shows as it is.
   */
  mask?: ImageMask | null;
  shadow: Shadow;
  /**
   * Overridden for this flyer: the picture was replaced by hand, so event
   * changes don't swap it. `linked` keeps the template's linked source for
   * "Reset to event data".
   */
  override?: boolean;
  linked?: ImageSource | null;
  /** DJ name logo with no logo uploaded: how the DJ's name is drawn instead. */
  fallback?: { font: string; weight: number; fill: string; uppercase: boolean } | null;
};

export type TextNode = Base & {
  kind: "text";
  text: string;
  font: string;
  weight: number;
  italic: boolean;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  align: "left" | "center" | "right";
  uppercase: boolean;
  /** Keep each line on one line: shrink the letters when the words get longer than the box. */
  shrink: boolean;
  /** Wrap within the box and shrink until it fits the box height (not below minFontSize). */
  fitBox?: boolean;
  minFontSize?: number;
  fill: string;
  stroke: Stroke;
  shadow: Shadow;
  /**
   * Linked text: `source` is the template wording with placeholders
   * ({{event.startTime}} – {{event.endTime}}); `text` is what it currently
   * says. `override` = edited by hand for this flyer, so event changes no
   * longer update it (until "Reset to event data").
   */
  source?: string | null;
  override?: boolean;
  /** Hide the layer when its text comes out empty (e.g. no drink specials). */
  hideIfEmpty?: boolean;
  /** Vertical position of the text inside its box (fit-to-box text). */
  valign?: "top" | "middle" | "bottom";
  /** Space kept clear inside the box edges, in px. */
  padding?: number;
  /** Rotation pivot: the box centre (date badges, new text) or its top-left corner (older layers). */
  pivot?: "center" | "topLeft";
  /** Letter spacing as a share of the font size (0.12 = 0.12em); follows auto-fit. Overrides letterSpacing. */
  trackingEm?: number | null;
  /** Horizontal stretch of the letters (1 = as designed; 1.6 = 60% wider), like an extended font. */
  stretch?: number;
  /**
   * Curved text: how far the middle of the baseline rises above its ends, in
   * px (negative curves down). Null/0 = straight. See lib/flyers/arc.ts.
   */
  arc?: number | null;
  /** Optional box behind the text. */
  panel?: { enabled: boolean; color: string; opacity: number; padding: number; radius: number } | null;
};

/** A drawn shape: box / rectangle (rounded corners optional) or oval / circle. */
export type ShapeNode = Base & {
  kind: "shape";
  shape: "rect" | "ellipse";
  /** Filled with a color, or outline only. */
  fillEnabled: boolean;
  fill: string;
  stroke: Stroke;
  /** Rounded corners (rectangles only). */
  radius: number;
  /** Resizing keeps the proportions (squares and circles). */
  keepRatio: boolean;
  shadow: Shadow;
};

export type FlyerNode = ImageNode | TextNode | ShapeNode;

export type Scene = {
  version: 1;
  format: FormatKey;
  width: number;
  height: number;
  background: string;
  /** Safe margin in px, shown as a guide and used for snapping. */
  safeMargin: number;
  nodes: FlyerNode[];
};

export type TemplateContent = { formats: Partial<Record<FormatKey, Scene>> };

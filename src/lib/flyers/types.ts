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
  overlay: "Decorative overlay",
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
  start_time: "Start time",
  end_time: "End time",
  venue_name: "Venue name",
  venue_address: "Venue address"
} as const;
export type PlaceholderKey = keyof typeof PLACEHOLDERS;
export type PlaceholderValues = Partial<Record<PlaceholderKey, string | null>>;

export type Shadow = { enabled: boolean; color: string; blur: number; offsetX: number; offsetY: number; opacity: number };
export type Stroke = { enabled: boolean; color: string; width: number };

/** What a DJ may do with a template layer. Staff can always do everything. */
export type Perms = { move: boolean; edit: boolean; style: boolean; remove: boolean };

export type ImageSource =
  | { type: "asset"; assetId: string }
  | { type: "static"; src: string }
  | { type: "dj_photo"; djId?: string | null }
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
  visible: boolean;
  /** Locked in the editor: can't be moved or resized by accident. */
  locked: boolean;
  groupId: string | null;
  perms: Perms;
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
  shadow: Shadow;
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
  fill: string;
  stroke: Stroke;
  shadow: Shadow;
};

export type FlyerNode = ImageNode | TextNode;

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

// Shared shapes for the Venue Partner Portal (safe to import in client code).

export interface FocusPoint {
  x: number; // 0-100, % from left
  y: number; // 0-100, % from top
}

export interface CoverFocus {
  desktop: FocusPoint;
  mobile: FocusPoint;
}

export interface RecurringNight {
  day: number; // 0 = Sunday ... 6 = Saturday
  label: string;
  start: string; // "21:00"
  end: string; // "01:00"
}

export interface SchedulingPrefs {
  music_notes?: string;
  setup_notes?: string;
  request_lead_days?: number;
  other?: string;
}

export interface VenueRecord {
  id: string;
  name: string;
  slug: string | null;
  location: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  is_active: boolean;
  portal_enabled: boolean;
  logo_url: string | null;
  cover_url: string | null;
  cover_focus: CoverFocus;
  dcdjs_contact_name: string | null;
  dcdjs_contact_email: string | null;
  dcdjs_contact_phone: string | null;
  recurring_nights: RecurringNight[];
  scheduling_prefs: SchedulingPrefs;
  calendar_names: string[];
  updated_at: string | null;
}

export interface VenueManager {
  id: string;
  venue_id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  title: string | null;
  phone: string | null;
  is_active: boolean;
  invited_at: string;
  last_seen_at: string | null;
}

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const DEFAULT_FOCUS: CoverFocus = { desktop: { x: 50, y: 50 }, mobile: { x: 50, y: 50 } };

const clampPct = (n: unknown) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : 50;
};

export function normalizeFocus(f: unknown): CoverFocus {
  const o = (f ?? {}) as Partial<Record<"desktop" | "mobile", Partial<FocusPoint>>>;
  return {
    desktop: { x: clampPct(o.desktop?.x), y: clampPct(o.desktop?.y) },
    mobile: { x: clampPct(o.mobile?.x), y: clampPct(o.mobile?.y) }
  };
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function normalizeNights(v: unknown): RecurringNight[] {
  if (!Array.isArray(v)) return [];
  return v
    .slice(0, 14)
    .map((n) => n as Partial<RecurringNight>)
    .filter((n) => Number.isInteger(n.day) && (n.day as number) >= 0 && (n.day as number) <= 6)
    .map((n) => ({
      day: n.day as number,
      label: String(n.label ?? "").slice(0, 60),
      start: TIME_RE.test(String(n.start)) ? String(n.start) : "21:00",
      end: TIME_RE.test(String(n.end)) ? String(n.end) : "01:00"
    }));
}

export function fmtClock(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2, "0")} ${ap}` : `${h12} ${ap}`;
}

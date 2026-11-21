/**
 * Looks for the project detail page. Each theme is a set of colour tokens
 * (globals.css, [data-project-theme="…"]) applied to the whole page, so
 * every card, tab and panel on it follows. A project opens in the look for
 * its event type; staff can switch with the Theme menu (remembered per
 * project in this browser).
 */
export type ProjectThemeId = "charcoal" | "nightclub" | "school" | "gala" | "birthday" | "classic";

export const PROJECT_THEMES: { id: ProjectThemeId; name: string; hint: string; swatch: [string, string]; dark: boolean }[] = [
  { id: "charcoal", name: "Charcoal & Brass", hint: "Weddings", swatch: ["#1E1A15", "#C9934A"], dark: true },
  { id: "nightclub", name: "Slate & Electric Lime", hint: "Bars & clubs", swatch: ["#16191D", "#D4F23C"], dark: true },
  { id: "school", name: "School Dance", hint: "Schools", swatch: ["#2E2580", "#F7C6A6"], dark: false },
  { id: "gala", name: "Ink & Brass Gala", hint: "Corporate", swatch: ["#1B1D22", "#8A5A1C"], dark: false },
  { id: "birthday", name: "Plum & Champagne", hint: "Parties", swatch: ["#5E1A3D", "#EBD3BD"], dark: false },
  { id: "classic", name: "Classic Cream", hint: "Original look", swatch: ["#FAF7F0", "#C99428"], dark: false }
];

const BY_CATEGORY: Record<string, ProjectThemeId> = {
  wedding: "charcoal",
  bar_nightclub: "nightclub",
  residency: "nightclub",
  school_dance: "school",
  corporate: "gala",
  holiday: "gala",
  private_party: "birthday"
};

export const defaultProjectTheme = (category: string | null | undefined): ProjectThemeId => BY_CATEGORY[category ?? ""] ?? "charcoal";
export const isProjectTheme = (v: unknown): v is ProjectThemeId => PROJECT_THEMES.some((t) => t.id === v);

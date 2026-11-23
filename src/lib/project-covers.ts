/**
 * Built-in project banner photos (public/project/covers). The office picks
 * one as the default for every client project page, and any project can
 * use a different one. A project's own uploaded photo always wins.
 */
export type ProjectCover = { id: string; src: string; label: string; group: "Celebration" | "Event" | "Venue" };

const GROUPS: { prefix: string; group: ProjectCover["group"]; labels: string[] }[] = [
  { prefix: "cover", group: "Celebration", labels: ["Golden ballroom", "Red stage", "Champagne & cake", "Purple dance floor", "Rooftop lights"] },
  { prefix: "event", group: "Event", labels: ["Birthday cake", "Champagne tower", "DJ booth", "Dinner tables", "Decks & disco ball"] },
  { prefix: "venue", group: "Venue", labels: ["Waterfront hall", "Brick loft", "Chandelier ballroom", "Velvet lounge", "Modern glass hall"] }
];

export const PROJECT_COVERS: ProjectCover[] = GROUPS.flatMap((g) =>
  g.labels.map((label, i) => {
    const id = `${g.prefix}-${String(i + 1).padStart(2, "0")}`;
    return { id, src: `/project/covers/${id}.jpg`, label, group: g.group };
  })
);

/** The built-in cover with this src, or null (so only our own files can be saved by path). */
export function builtInCover(src: unknown): ProjectCover | null {
  return typeof src === "string" ? (PROJECT_COVERS.find((c) => c.src === src) ?? null) : null;
}

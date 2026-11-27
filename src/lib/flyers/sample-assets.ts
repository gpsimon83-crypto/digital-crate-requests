/**
 * The Flyer Creator's built-in sample assets (app-owned, in public/flyers/sample).
 * Portraits are cutouts (transparent backgrounds); backgrounds have no text.
 * They're separate files so a portrait and a background stay separate layers:
 * masks, parallax and double exposure can use each on its own.
 */
import type { Role } from "./types";

export type SampleAsset = { src: string; name: string; role: Role };

export const SAMPLE_PORTRAITS: SampleAsset[] = [
  { src: "/flyers/sample/portraits/dj-01.png", name: "DJ portrait 1 (cutout)", role: "portrait" },
  { src: "/flyers/sample/portraits/dj-02.png", name: "DJ portrait 2 (cutout)", role: "portrait" },
  { src: "/flyers/sample/portraits/dj-03.png", name: "DJ portrait 3 (cutout)", role: "portrait" },
  { src: "/flyers/sample/portraits/dj-04.png", name: "DJ portrait 4 (cutout)", role: "portrait" }
];

export const SAMPLE_BACKGROUNDS: SampleAsset[] = [
  { src: "/flyers/sample/backgrounds/charcoal-studio.png", name: "Charcoal studio", role: "background" },
  { src: "/flyers/sample/backgrounds/violet-nightclub.png", name: "Violet nightclub", role: "background" },
  { src: "/flyers/sample/backgrounds/gold-ballroom.png", name: "Gold ballroom", role: "background" },
  { src: "/flyers/sample/backgrounds/tropical-patio.png", name: "Tropical patio", role: "background" }
];

/** The before-and-after effect thumbnails: this portrait over this background, as two layers. */
export const THUMB_SAMPLE = { portrait: SAMPLE_PORTRAITS[0].src, background: SAMPLE_BACKGROUNDS[0].src, size: 627 };

/**
 * Echo thumbnails (Effects → Echo in the Flyer Creator, and Animate's Echo tab): the same
 * sample, smaller in a wide 627 × 300 view, so there's room around the portrait for the echoes.
 * Units are sample pixels (the background is the 627 px square, 24 px up, as on the other cards).
 */
export const ECHO_SAMPLE = { width: 627, height: 300, backgroundY: -24, portrait: { x: 178, y: 132, w: 270, h: 270 } };

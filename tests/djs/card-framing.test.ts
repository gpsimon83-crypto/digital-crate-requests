import { describe, expect, it } from "vitest";
import { cardFraming, DEFAULT_CARD_FRAMING, mergeSavedFraming } from "@/lib/hero-settings";

/** Visible part of the photo (fractions of its height) in a 4:3 card with object-fit: cover at focal point y%. */
function visibleRows(photoW: number, photoH: number, yPct: number) {
  const shown = Math.min(1, (photoW * 3) / 4 / photoH); // fraction of the height that fits
  const top = (1 - shown) * (yPct / 100);
  return [top, top + shown] as const;
}

// Faces found in the team photos (public/djs, OpenCV face detection): top and bottom of the face box.
const FACES: Record<string, [number, number, number, number]> = {
  // name: [width, height, faceTop, faceBottom]
  "dj-bubblz": [600, 600, 0.2, 0.41],
  "dj-gmo": [1494, 1053, 0.12, 0.35],
  "dj-hydef": [600, 600, 0.18, 0.64],
  "dj-makara": [600, 600, 0.28, 0.56],
  "dj-peace": [600, 600, 0.24, 0.56],
  "dj-penny": [600, 600, 0.05, 0.32],
  "dj-penny-v2": [600, 600, 0.15, 0.43],
  "dj-que": [600, 600, 0.26, 0.43],
  "dj-rushie": [600, 600, 0.35, 0.43]
};

describe("roster card framing", () => {
  it("defaults to head-and-shoulders, not the banner framing", () => {
    expect(cardFraming(null)).toEqual(DEFAULT_CARD_FRAMING);
    // A DJ with only banner settings saved (x 75 / y 50) still gets the card default.
    expect(cardFraming({ xPosition: 75, yPosition: 50, zoom: 100, overlayDarkness: 40 })).toEqual(DEFAULT_CARD_FRAMING);
    expect(cardFraming({ card: { x: 40, y: 22, zoom: 120 } })).toEqual({ x: 40, y: 22, zoom: 120 });
    expect(cardFraming({ card: { x: -5, y: 400, zoom: 999 } })).toEqual({ x: 0, y: 100, zoom: 180 });
  });

  it("keeps every face in the team photos fully inside the card by default", () => {
    for (const [name, [w, h, top, bottom]] of Object.entries(FACES)) {
      const [vTop, vBottom] = visibleRows(w, h, DEFAULT_CARD_FRAMING.y);
      expect(top, `${name} head cut off`).toBeGreaterThanOrEqual(vTop);
      expect(bottom, `${name} chin cut off`).toBeLessThanOrEqual(vBottom);
    }
  });

  it("the old centred crop would have cut a head off (why the default changed)", () => {
    const [vTop] = visibleRows(600, 600, 50);
    expect(FACES["dj-penny"][2]).toBeLessThan(vTop);
  });

  it("saving one framing keeps the other", () => {
    const saved = { xPosition: 60, yPosition: 40, zoom: 110, overlayDarkness: 30, card: { x: 50, y: 12, zoom: 100 } };
    expect(mergeSavedFraming(saved, { card: { x: 50, y: 20, zoom: 100 } })).toMatchObject({ xPosition: 60, card: { y: 20 } });
    expect(mergeSavedFraming(saved, { xPosition: 70, yPosition: 40, zoom: 100, overlayDarkness: 30 })).toMatchObject({ xPosition: 70, card: { y: 12 } });
    expect(mergeSavedFraming(null, { card: { x: 1, y: 2, zoom: 100 } })).toEqual({ card: { x: 1, y: 2, zoom: 100 } });
  });
});

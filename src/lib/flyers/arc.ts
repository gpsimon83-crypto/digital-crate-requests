/**
 * Curved text: a text layer with `arc` set is drawn along a gentle arch
 * (positive = middle rises, like a sign over a door; negative = a smile).
 * `arc` is how far the middle of the baseline sits above (or below) its
 * ends, in px. The words stay ordinary editable text; only the drawing
 * follows the curve.
 *
 * Geometry is in the layer's own box: the baseline runs from the left
 * padding to the right padding, with its ends `ascent` below the top
 * (plus the rise, so the middle stays inside the box).
 */
export const ARC_ASCENT = 0.9;

export type ArcGeometry = { boxHeight: number; path: string; length: number; endsY: number; ctrlY: number; x0: number; x1: number };

export function arcGeometry(width: number, size: number, arc: number, pad = 0): ArcGeometry {
  const a = Math.abs(arc);
  const endsY = pad + size * ARC_ASCENT + (arc > 0 ? a : 0);
  const ctrlY = endsY - 2 * arc; // a quadratic curve's middle sits halfway to its control point
  const x0 = pad;
  const x1 = Math.max(pad + 1, width - pad);
  const mid = (x0 + x1) / 2;
  // Arc length by sampling the curve (accurate to well under a pixel here).
  let length = 0;
  let px = x0;
  let py = endsY;
  for (let i = 1; i <= 64; i++) {
    const t = i / 64;
    const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * mid + t * t * x1;
    const y = (1 - t) * (1 - t) * endsY + 2 * (1 - t) * t * ctrlY + t * t * endsY;
    length += Math.hypot(x - px, y - py);
    px = x;
    py = y;
  }
  const r = (v: number) => Math.round(v * 100) / 100;
  return { boxHeight: r(size * 1.05 + a + pad * 2), path: `M ${r(x0)} ${r(endsY)} Q ${r(mid)} ${r(ctrlY)} ${r(x1)} ${r(endsY)}`, length, endsY, ctrlY, x0, x1 };
}

/** Where a curved layer's box goes so its baseline ends land at (x0, y) and (x1, y), rising `arc` in the middle. */
export function arcBoxFor(x0: number, x1: number, baselineY: number, size: number, arc: number) {
  return { x: x0, y: baselineY - size * ARC_ASCENT - (arc > 0 ? arc : 0), width: x1 - x0, height: arcGeometry(x1 - x0, size, arc).boxHeight };
}

/** A point on a quadratic curve and its direction (radians). */
function quadAt(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, t: number) {
  const u = 1 - t;
  return {
    x: u * u * x0 + 2 * u * t * cx + t * t * x1,
    y: u * u * y0 + 2 * u * t * cy + t * t * y1,
    angle: Math.atan2(2 * u * (cy - y0) + 2 * t * (y1 - cy), 2 * u * (cx - x0) + 2 * t * (x1 - cx))
  };
}

/**
 * Where each letter goes on the arch: centre point and angle, for letters
 * of the given (unstretched) widths, widened by `stretch` along the curve
 * like SVG textLength (spacingAndGlyphs). Letters past the end are dropped.
 */
export function placeOnArc(g: ArcGeometry, widths: number[], opts: { spacing: number; stretch: number; align: "left" | "center" | "right" }) {
  const st = opts.stretch;
  const advances = widths.map((w, i) => w * st + (i < widths.length - 1 ? opts.spacing * st : 0));
  const total = advances.reduce((a, b) => a + b, 0);
  // Arc length table along the curve.
  const N = 256;
  const mid = (g.x0 + g.x1) / 2;
  const table: { len: number; t: number }[] = [{ len: 0, t: 0 }];
  let prev = quadAt(g.x0, g.endsY, mid, g.ctrlY, g.x1, g.endsY, 0);
  for (let i = 1; i <= N; i++) {
    const p = quadAt(g.x0, g.endsY, mid, g.ctrlY, g.x1, g.endsY, i / N);
    table.push({ len: table[i - 1].len + Math.hypot(p.x - prev.x, p.y - prev.y), t: i / N });
    prev = p;
  }
  const L = table[N].len;
  const at = (len: number) => {
    let lo = 0;
    let hi = N;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (table[m].len < len) lo = m;
      else hi = m;
    }
    const a = table[lo];
    const b = table[hi];
    const t = a.t + ((b.t - a.t) * (len - a.len)) / Math.max(1e-6, b.len - a.len);
    return quadAt(g.x0, g.endsY, mid, g.ctrlY, g.x1, g.endsY, t);
  };
  let offset = opts.align === "center" ? (L - total) / 2 : opts.align === "right" ? L - total : 0;
  const out: { x: number; y: number; angle: number }[] = [];
  for (let i = 0; i < widths.length; i++) {
    const centre = offset + (widths[i] * st) / 2;
    if (centre < -0.5 || centre > L + 0.5) break;
    out.push(at(Math.min(L, Math.max(0, centre))));
    offset += advances[i];
  }
  return { glyphs: out, total, length: L };
}

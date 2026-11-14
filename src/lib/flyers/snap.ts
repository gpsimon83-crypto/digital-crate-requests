/** Alignment guides and snapping while dragging a layer. Pure math so it can be tested. */

export type Box = { x: number; y: number; width: number; height: number };
export type Guide = { orient: "v" | "h"; pos: number };

/** Axis-aligned bounds of a rotated rectangle (rotation in degrees around its top-left corner, Konva's default). */
export function boundsOf(n: Box & { rotation?: number }): Box {
  const r = ((n.rotation ?? 0) * Math.PI) / 180;
  if (!r) return { x: n.x, y: n.y, width: n.width, height: n.height };
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const pts = [
    [0, 0],
    [n.width, 0],
    [0, n.height],
    [n.width, n.height]
  ].map(([px, py]) => [n.x + px * cos - py * sin, n.y + px * sin + py * cos]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

/**
 * Snap a moving box to the canvas edges and centre, the safe margins, and the
 * edges/centres of the other layers. Returns the shift to apply and the guides to draw.
 */
export function snapBox(box: Box, others: Box[], canvas: { width: number; height: number; safeMargin: number }, threshold: number) {
  const vTargets = [0, canvas.width / 2, canvas.width, canvas.safeMargin, canvas.width - canvas.safeMargin];
  const hTargets = [0, canvas.height / 2, canvas.height, canvas.safeMargin, canvas.height - canvas.safeMargin];
  for (const o of others) {
    vTargets.push(o.x, o.x + o.width / 2, o.x + o.width);
    hTargets.push(o.y, o.y + o.height / 2, o.y + o.height);
  }
  const best = (edges: number[], targets: number[]) => {
    let hit: { diff: number; pos: number } | null = null;
    for (const e of edges)
      for (const t of targets) {
        const diff = t - e;
        if (Math.abs(diff) <= threshold && (!hit || Math.abs(diff) < Math.abs(hit.diff))) hit = { diff, pos: t };
      }
    return hit;
  };
  const v = best([box.x, box.x + box.width / 2, box.x + box.width], vTargets);
  const h = best([box.y, box.y + box.height / 2, box.y + box.height], hTargets);
  const guides: Guide[] = [];
  if (v) guides.push({ orient: "v", pos: v.pos });
  if (h) guides.push({ orient: "h", pos: h.pos });
  return { dx: v?.diff ?? 0, dy: h?.diff ?? 0, guides };
}

/** User-perceived characters (emoji, accents, flags stay whole). */
export function graphemes(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return [...seg.segment(text)].map((s) => s.segment);
  }
  return [...text];
}

/** Grapheme index just after each word, in reading order. */
export function wordEnds(text: string): number[] {
  const g = graphemes(text);
  const ends: number[] = [];
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter(undefined, { granularity: "word" });
    let gi = 0;
    let pos = 0;
    // Map code-unit offsets to grapheme counts.
    const at: number[] = [];
    for (const s of g) {
      at.push(pos);
      pos += s.length;
    }
    at.push(pos);
    for (const w of seg.segment(text)) {
      if (!w.isWordLike) continue;
      const end = w.index + w.segment.length;
      while (gi < at.length - 1 && at[gi] < end) gi++;
      ends.push(gi);
    }
    return ends;
  }
  let i = 0;
  for (const part of text.split(/(\s+)/)) {
    i += graphemes(part).length;
    if (part.trim()) ends.push(i);
  }
  return ends;
}

/** How many graphemes show at a reveal amount (whole letters or whole words, never a jump past the end). */
export function revealCount(text: string, mode: "letter" | "word", amount: number): number {
  const total = graphemes(text).length;
  const a = Math.min(1, Math.max(0, amount));
  if (a >= 1) return total;
  if (mode === "letter") return Math.floor(a * total + 1e-9);
  const ends = wordEnds(text);
  const k = Math.floor(a * ends.length + 1e-9);
  return k === 0 ? 0 : ends[k - 1];
}

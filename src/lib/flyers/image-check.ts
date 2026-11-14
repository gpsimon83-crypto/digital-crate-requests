/**
 * Checks an uploaded image by its actual bytes (not the file name or the
 * browser's claimed type) and reads its pixel size.
 */

export const UPLOAD_LIMITS = {
  dj: { bytes: 10 * 1024 * 1024, label: "10 MB" },
  template: { bytes: 15 * 1024 * 1024, label: "15 MB" }
} as const;
export const MAX_DIMENSION = 8000;
export const MAX_DJ_UPLOADS = 80;

export type ImageInfo = { mime: "image/png" | "image/jpeg" | "image/webp"; ext: "png" | "jpg" | "webp"; width: number; height: number; hasAlpha: boolean };

export function sniffImage(buf: Uint8Array): ImageInfo | null {
  const u16be = (o: number) => (buf[o] << 8) | buf[o + 1];
  const u32be = (o: number) => ((buf[o] << 24) >>> 0) + (buf[o + 1] << 16) + (buf[o + 2] << 8) + buf[o + 3];
  const u24le = (o: number) => buf[o] | (buf[o + 1] << 8) | (buf[o + 2] << 16);

  // PNG: signature, then IHDR width/height and colour type.
  if (buf.length > 33 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 && buf[12] === 0x49 && buf[13] === 0x48) {
    const colorType = buf[25];
    let hasAlpha = colorType === 4 || colorType === 6;
    if (!hasAlpha) {
      // A tRNS chunk also gives transparency.
      for (let i = 33; i < Math.min(buf.length - 8, 1 << 20); ) {
        const len = u32be(i);
        const type = String.fromCharCode(buf[i + 4], buf[i + 5], buf[i + 6], buf[i + 7]);
        if (type === "tRNS") { hasAlpha = true; break; }
        if (type === "IDAT" || type === "IEND") break;
        i += 12 + len;
      }
    }
    return { mime: "image/png", ext: "png", width: u32be(16), height: u32be(20), hasAlpha };
  }
  // JPEG: walk the markers to a start-of-frame.
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      const len = u16be(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { mime: "image/jpeg", ext: "jpg", height: u16be(i + 5), width: u16be(i + 7), hasAlpha: false };
      }
      if (len < 2) return null;
      i += 2 + len;
    }
    return null;
  }
  // WebP: RIFF....WEBP with VP8 / VP8L / VP8X.
  if (buf.length > 30 && String.fromCharCode(...buf.slice(0, 4)) === "RIFF" && String.fromCharCode(...buf.slice(8, 12)) === "WEBP") {
    const chunk = String.fromCharCode(...buf.slice(12, 16));
    if (chunk === "VP8X") return { mime: "image/webp", ext: "webp", width: u24le(24) + 1, height: u24le(27) + 1, hasAlpha: (buf[20] & 0x10) !== 0 };
    if (chunk === "VP8L") {
      const b = buf.slice(21, 25);
      const width = 1 + (((b[1] & 0x3f) << 8) | b[0]);
      const height = 1 + (((b[3] & 0xf) << 10) | (b[2] << 2) | ((b[1] & 0xc0) >> 6));
      return { mime: "image/webp", ext: "webp", width, height, hasAlpha: (b[3] & 0x10) !== 0 };
    }
    if (chunk === "VP8 ") return { mime: "image/webp", ext: "webp", width: (buf[26] | (buf[27] << 8)) & 0x3fff, height: (buf[28] | (buf[29] << 8)) & 0x3fff, hasAlpha: false };
  }
  return null;
}

export function checkUpload(buf: Uint8Array, scope: "dj" | "template"): { ok: true; info: ImageInfo } | { ok: false; error: string } {
  const limit = UPLOAD_LIMITS[scope];
  if (!buf.length) return { ok: false, error: "That file is empty." };
  if (buf.length > limit.bytes) return { ok: false, error: `Images can be up to ${limit.label}.` };
  const info = sniffImage(buf);
  if (!info) return { ok: false, error: "Upload a PNG, JPEG or WebP image." };
  if (!info.width || !info.height || info.width > MAX_DIMENSION || info.height > MAX_DIMENSION) return { ok: false, error: `Images can be up to ${MAX_DIMENSION} × ${MAX_DIMENSION} pixels.` };
  if (info.width < 64 || info.height < 64) return { ok: false, error: "That image is too small to print on a flyer." };
  return { ok: true, info };
}

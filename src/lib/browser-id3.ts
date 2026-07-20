/**
 * Minimal client-side ID3v2 tag reader. Only extracts the frames Crate
 * Builder actually needs (genre, year, BPM, key, title, artist) rather
 * than pulling in a full tagging library — ID3v2 frames sit at the very
 * start of the file, so we only ever read the first ~256KB via
 * File.slice(), never the whole audio file. Verified against real files
 * on the CORE DCDJ drive (TCON/TDRC/TBPM/TKEY frames present on files
 * from several DJ record pools).
 */

export interface AlbumArt {
  mime: string;
  data: Uint8Array;
}

export interface Id3Tags {
  genre: string | null;
  year: number | null;
  bpm: number | null;
  key: string | null;
  title: string | null;
  artist: string | null;
  albumArt: AlbumArt | null;
}

const EMPTY: Id3Tags = { genre: null, year: null, bpm: null, key: null, title: null, artist: null, albumArt: null };

/** Parses an APIC (v2.3/2.4) or PIC (v2.2) embedded-picture frame body.
 * Verified against real files on this drive — several DJ pool tracks
 * carry real cover art this way (confirmed via mutagen inspection). */
function parseApicFrame(bytes: Uint8Array, isV2: boolean): AlbumArt | null {
  if (bytes.length < 2) return null;
  const encoding = bytes[0];
  let offset = 1;
  let mime: string;

  if (isV2) {
    // PIC: 3-char image format, e.g. "JPG" / "PNG", not null-terminated.
    if (offset + 3 > bytes.length) return null;
    const fmt = new TextDecoder("ascii").decode(bytes.subarray(offset, offset + 3)).toUpperCase();
    offset += 3;
    mime = fmt === "PNG" ? "image/png" : "image/jpeg";
  } else {
    // APIC: MIME type as a null-terminated Latin-1 string.
    let end = offset;
    while (end < bytes.length && bytes[end] !== 0) end++;
    mime = new TextDecoder("latin1").decode(bytes.subarray(offset, end)) || "image/jpeg";
    offset = end + 1;
  }

  offset += 1; // picture type byte (cover front, etc.) — not needed here

  // Description string, null-terminated; terminator is 2 bytes for
  // UTF-16 encodings (1/2), 1 byte for Latin-1/UTF-8 (0/3).
  if (encoding === 1 || encoding === 2) {
    while (offset + 1 < bytes.length && !(bytes[offset] === 0 && bytes[offset + 1] === 0)) offset += 2;
    offset += 2;
  } else {
    while (offset < bytes.length && bytes[offset] !== 0) offset++;
    offset += 1;
  }

  if (offset >= bytes.length) return null;
  return { mime, data: bytes.subarray(offset) };
}

function synchsafeToInt(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] << 21) | (bytes[offset + 1] << 14) | (bytes[offset + 2] << 7) | bytes[offset + 3]
  );
}

function decodeFrameText(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  const encodingByte = bytes[0];
  const body = bytes.subarray(1);
  let text: string;
  if (encodingByte === 1 || encodingByte === 2) {
    // UTF-16 (with or without BOM) / UTF-16BE
    const hasBom = body.length >= 2 && ((body[0] === 0xff && body[1] === 0xfe) || (body[0] === 0xfe && body[1] === 0xff));
    const little = !(body.length >= 2 && body[0] === 0xfe && body[1] === 0xff);
    const start = hasBom ? 2 : 0;
    const view = new DataView(body.buffer, body.byteOffset + start, body.length - start - ((body.length - start) % 2));
    let out = "";
    for (let i = 0; i + 1 < view.byteLength; i += 2) out += String.fromCharCode(view.getUint16(i, little));
    text = out;
  } else {
    // Latin-1 / UTF-8 (encoding byte 0 or 3)
    text = new TextDecoder(encodingByte === 3 ? "utf-8" : "latin1").decode(body);
  }
  return text.replace(/\0+$/, "").trim();
}

/** `includeArt` reads embedded cover art (APIC/PIC frames) — off by
 * default because the bulk metadata agent calls this for every track
 * (10k+ times) and art data is much larger than the text frames it
 * actually needs; only pass true for one-off per-crate cover lookups. */
export async function readId3Tags(file: File, includeArt = false): Promise<Id3Tags> {
  try {
    const headerBuf = await file.slice(0, 10).arrayBuffer();
    const header = new Uint8Array(headerBuf);
    if (header[0] !== 0x49 || header[1] !== 0x44 || header[2] !== 0x33) {
      return EMPTY; // no "ID3" magic — no ID3v2 tag present
    }
    const majorVersion = header[3];
    const tagSize = synchsafeToInt(header, 6);
    const readSize = Math.min(tagSize, includeArt ? 4 * 1024 * 1024 : 512 * 1024);
    const bodyBuf = await file.slice(10, 10 + readSize).arrayBuffer();
    const data = new Uint8Array(bodyBuf);

    const result: Id3Tags = { ...EMPTY };
    let offset = 0;
    const frameIdLen = 4;
    const frameHeaderLen = majorVersion === 2 ? 6 : 10;

    while (offset + frameHeaderLen <= data.length) {
      let frameId: string;
      let frameSize: number;
      if (majorVersion === 2) {
        frameId = new TextDecoder("ascii").decode(data.slice(offset, offset + 3));
        frameSize = (data[offset + 3] << 16) | (data[offset + 4] << 8) | data[offset + 5];
        offset += 6;
      } else {
        frameId = new TextDecoder("ascii").decode(data.slice(offset, offset + frameIdLen));
        if (!/^[A-Z0-9]{4}$/.test(frameId)) break; // hit padding/garbage
        frameSize = majorVersion >= 4
          ? synchsafeToInt(data, offset + 4)
          : new DataView(data.buffer, data.byteOffset + offset + 4, 4).getUint32(0, false);
        offset += 10;
      }
      if (frameSize <= 0 || offset + frameSize > data.length) break;
      const frameBody = data.subarray(offset, offset + frameSize);

      switch (frameId) {
        case "TCON":
        case "TCO": // v2.2
          result.genre = decodeFrameText(frameBody) || result.genre;
          break;
        case "TDRC":
        case "TYER":
        case "TYE": // v2.2
        case "TDAT": {
          const text = decodeFrameText(frameBody);
          const match = text.match(/(\d{4})/);
          if (match) result.year = parseInt(match[1], 10);
          break;
        }
        case "TBPM":
        case "TBP": {
          const text = decodeFrameText(frameBody);
          const n = parseFloat(text);
          if (!Number.isNaN(n)) result.bpm = n;
          break;
        }
        case "TKEY":
        case "TKE":
          result.key = decodeFrameText(frameBody) || result.key;
          break;
        case "TIT2":
        case "TT2":
          result.title = decodeFrameText(frameBody) || result.title;
          break;
        case "APIC":
        case "PIC": // v2.2
          if (includeArt && !result.albumArt) {
            result.albumArt = parseApicFrame(frameBody, frameId === "PIC");
          }
          break;
        case "TPE1":
        case "TP1":
          result.artist = decodeFrameText(frameBody) || result.artist;
          break;
      }

      offset += frameSize;
    }

    return result;
  } catch {
    return EMPTY;
  }
}

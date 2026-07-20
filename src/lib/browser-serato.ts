/**
 * Client-side (browser) port of scripts/serato_toolkit.py's core logic.
 *
 * Why this exists as a separate implementation instead of calling the
 * server: the File System Access API deliberately does not expose real
 * OS file paths to JavaScript (security boundary), so a server process
 * can never resolve "/Volumes/whatever" for a visitor's own computer.
 * Everything here works entirely from FileSystemDirectoryHandle/
 * FileSystemFileHandle objects the browser hands back after the user
 * grants folder access — this is the only architecture that lets
 * requests.digitalcratedjs.com read a DJ's own drive on their own
 * machine, whichever computer that is.
 *
 * The binary .crate TLV format read/write here mirrors the Python
 * version byte-for-byte (see scripts/serato_toolkit.py header — that
 * parser was validated against a real Serato crate file).
 */

export const AUDIO_EXT = new Set([".mp3", ".wav", ".aif", ".aiff", ".flac", ".m4a", ".wma"]);
const DEFAULT_EXCLUDE_DIRS = new Set(["_DUPLICATES_REVIEW", "Logic Master Collection"]);

export interface AudioFileEntry {
  handle: FileSystemFileHandle;
  path: string[]; // path segments from MUSIC root, e.g. ["QUE DROP", "song.mp3"]
  name: string;
  size: number;
  norm: string;
  top: string;
}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

export function normalize(name: string): string {
  const dot = name.lastIndexOf(".");
  let stem = (dot === -1 ? name : name.slice(0, dot)).toLowerCase();
  stem = stem.replace(/^\d+[\s\-_.]*/, "");
  stem = stem.replace(/\(clean\)|\(dirty\)|\(explicit\)|\(radio edit\)|\(album version\)/g, "");
  stem = stem.replace(/[^a-z0-9]+/g, " ");
  return stem.replace(/\s+/g, " ").trim();
}

/** Recursively walks a directory handle collecting audio files. */
export async function walkAudioFiles(
  musicDirHandle: FileSystemDirectoryHandle,
  onProgress?: (count: number) => void
): Promise<AudioFileEntry[]> {
  const files: AudioFileEntry[] = [];

  async function walk(dir: FileSystemDirectoryHandle, path: string[], top: string | null) {
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind === "directory") {
        if (DEFAULT_EXCLUDE_DIRS.has(name)) continue;
        await walk(handle as FileSystemDirectoryHandle, [...path, name], top ?? name);
      } else {
        const ext = extOf(name);
        if (!AUDIO_EXT.has(ext)) continue;
        const file = await (handle as FileSystemFileHandle).getFile();
        files.push({
          handle: handle as FileSystemFileHandle,
          path: [...path, name],
          name,
          size: file.size,
          norm: normalize(name),
          top: top ?? name,
        });
        onProgress?.(files.length);
      }
    }
  }

  await walk(musicDirHandle, [], null);
  return files;
}

export interface ScanResult {
  totalFiles: number;
  totalSizeBytes: number;
  exactDuplicateGroups: number;
  exactDuplicateWastedBytes: number;
  likelyDuplicateGroups: number;
  folders: { name: string; count: number; sizeBytes: number }[];
  dupeGroupsMap: Map<string, AudioFileEntry[]>;
}

export function analyzeScan(files: AudioFileEntry[]): ScanResult {
  const totalSizeBytes = files.reduce((s, f) => s + f.size, 0);

  const exactGroups = new Map<string, AudioFileEntry[]>();
  for (const f of files) {
    if (!f.norm) continue;
    const key = `${f.norm}::${f.size}`;
    if (!exactGroups.has(key)) exactGroups.set(key, []);
    exactGroups.get(key)!.push(f);
  }
  const exactDupes = new Map([...exactGroups].filter(([, v]) => v.length > 1));
  const exactWasted = [...exactDupes.values()].reduce(
    (sum, group) => sum + group.slice(1).reduce((s, f) => s + f.size, 0),
    0
  );

  const nameGroups = new Map<string, AudioFileEntry[]>();
  for (const f of files) {
    if (!f.norm) continue;
    if (!nameGroups.has(f.norm)) nameGroups.set(f.norm, []);
    nameGroups.get(f.norm)!.push(f);
  }
  const nameDupeCount = [...nameGroups.values()].filter((v) => v.length > 1).length;

  const byTop = new Map<string, { count: number; size: number }>();
  for (const f of files) {
    const cur = byTop.get(f.top) ?? { count: 0, size: 0 };
    cur.count += 1;
    cur.size += f.size;
    byTop.set(f.top, cur);
  }
  const folders = [...byTop.entries()]
    .map(([name, stats]) => ({ name, count: stats.count, sizeBytes: stats.size }))
    .sort((a, b) => b.sizeBytes - a.sizeBytes);

  return {
    totalFiles: files.length,
    totalSizeBytes,
    exactDuplicateGroups: exactDupes.size,
    exactDuplicateWastedBytes: exactWasted,
    likelyDuplicateGroups: nameDupeCount - exactDupes.size,
    folders,
    dupeGroupsMap: exactDupes,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Dedupe: move (copy + delete) extra copies into _DUPLICATES_REVIEW
// ─────────────────────────────────────────────────────────────────────────

export interface DedupePlanItem {
  keep: AudioFileEntry;
  move: AudioFileEntry;
}

export function planDedupe(dupeGroupsMap: Map<string, AudioFileEntry[]>): DedupePlanItem[] {
  const plan: DedupePlanItem[] = [];
  for (const group of dupeGroupsMap.values()) {
    const sorted = [...group].sort((a, b) => a.path.join("/").length - b.path.join("/").length);
    const keep = sorted[0];
    for (const dup of sorted.slice(1)) {
      plan.push({ keep, move: dup });
    }
  }
  return plan;
}

async function getOrCreateSubdir(root: FileSystemDirectoryHandle, segments: string[]): Promise<FileSystemDirectoryHandle> {
  let dir = root;
  for (const seg of segments) {
    dir = await dir.getDirectoryHandle(seg, { create: true });
  }
  return dir;
}

async function removeFromDir(root: FileSystemDirectoryHandle, pathSegments: string[]) {
  const parentSegs = pathSegments.slice(0, -1);
  const fileName = pathSegments[pathSegments.length - 1];
  let dir = root;
  for (const seg of parentSegs) {
    dir = await dir.getDirectoryHandle(seg);
  }
  await dir.removeEntry(fileName);
}

/** Executes a dedupe plan: copies each "move" file into
 * musicDir/_DUPLICATES_REVIEW/<original relative path>, then deletes
 * the original. The File System Access API has no native "move", so
 * this is copy-then-delete. */
export async function executeDedupe(
  musicDirHandle: FileSystemDirectoryHandle,
  plan: DedupePlanItem[],
  onProgress?: (done: number, total: number) => void
): Promise<{ moved: number; errors: string[] }> {
  const quarantineRoot = await musicDirHandle.getDirectoryHandle("_DUPLICATES_REVIEW", { create: true });
  let moved = 0;
  const errors: string[] = [];

  for (const item of plan) {
    try {
      const file = await item.move.handle.getFile();
      const destDir = await getOrCreateSubdir(quarantineRoot, item.move.path.slice(0, -1));
      const destHandle = await destDir.getFileHandle(item.move.path[item.move.path.length - 1], { create: true });
      const writable = await destHandle.createWritable();
      await writable.write(file);
      await writable.close();
      await removeFromDir(musicDirHandle, item.move.path);
      moved++;
    } catch (e) {
      errors.push(`${item.move.path.join("/")}: ${e instanceof Error ? e.message : String(e)}`);
    }
    onProgress?.(moved + errors.length, plan.length);
  }

  return { moved, errors };
}

// ─────────────────────────────────────────────────────────────────────────
// Filename cleanup: strip leading track-number prefixes like "01. " / "01) "
// / "01 - " so pool-tagged files read as clean "Artist - Song" names.
// ─────────────────────────────────────────────────────────────────────────

export interface RenamePlanItem {
  file: AudioFileEntry;
  oldName: string;
  newName: string;
}

// Deliberately conservative: only strips a leading number followed by a
// period, closing paren, underscore, or a space-dash-space — NOT a bare
// space or a tight dash — so real artist names like "50 Cent" or
// "3-6 Mafia" are never mistaken for a track-number prefix. Tried first,
// against real files, so a compound "disc_track" prefix like "00_01 " is
// fully stripped rather than leaving a residual "01 " behind.
const COMPOUND_NUMBER_PREFIX = /^\d{1,3}[._]\d{1,3}\s+/;
const TRACK_NUMBER_PREFIX = /^\d{1,3}(?:[.)_]|\s+-\s+)\s*/;

function stripTrackNumberPrefix(stem: string): string | null {
  if (COMPOUND_NUMBER_PREFIX.test(stem)) return stem.replace(COMPOUND_NUMBER_PREFIX, "").trim();
  if (TRACK_NUMBER_PREFIX.test(stem)) return stem.replace(TRACK_NUMBER_PREFIX, "").trim();
  return null;
}

export function planFilenameCleanup(files: AudioFileEntry[]): RenamePlanItem[] {
  const plan: RenamePlanItem[] = [];
  for (const f of files) {
    const dot = f.name.lastIndexOf(".");
    const ext = dot === -1 ? "" : f.name.slice(dot);
    const stem = dot === -1 ? f.name : f.name.slice(0, dot);

    const cleanedStem = stripTrackNumberPrefix(stem);
    if (!cleanedStem) continue;
    const newName = `${cleanedStem}${ext}`;
    if (newName === f.name) continue;

    plan.push({ file: f, oldName: f.name, newName });
  }
  return plan;
}

/** Renames each file in the plan (copy to the clean name, delete the
 * original — File System Access API has no native rename). Skips any
 * item whose clean name would collide with an existing file, rather
 * than silently overwriting it. */
export async function executeFilenameCleanup(
  musicDirHandle: FileSystemDirectoryHandle,
  plan: RenamePlanItem[],
  onProgress?: (done: number, total: number) => void
): Promise<{ renamed: number; errors: string[] }> {
  let renamed = 0;
  const errors: string[] = [];

  for (const item of plan) {
    try {
      const parentSegs = item.file.path.slice(0, -1);
      let dir = musicDirHandle;
      for (const seg of parentSegs) dir = await dir.getDirectoryHandle(seg);

      let collision = false;
      try {
        await dir.getFileHandle(item.newName);
        collision = true;
      } catch {
        // doesn't exist yet — good
      }
      if (collision) {
        errors.push(`${item.oldName}: "${item.newName}" already exists, skipped`);
        continue;
      }

      const file = await item.file.handle.getFile();
      const destHandle = await dir.getFileHandle(item.newName, { create: true });
      const writable = await destHandle.createWritable();
      await writable.write(file);
      await writable.close();
      await dir.removeEntry(item.oldName);
      renamed++;
    } catch (e) {
      errors.push(`${item.oldName}: ${e instanceof Error ? e.message : String(e)}`);
    }
    onProgress?.(renamed + errors.length, plan.length);
  }

  return { renamed, errors };
}

// ─────────────────────────────────────────────────────────────────────────
// Serato .crate binary TLV format
// ─────────────────────────────────────────────────────────────────────────

function tlv(tag: string, value: Uint8Array): Uint8Array {
  const tagBytes = new TextEncoder().encode(tag);
  const lenBytes = new Uint8Array(4);
  new DataView(lenBytes.buffer).setUint32(0, value.length, false);
  const out = new Uint8Array(8 + value.length);
  out.set(tagBytes, 0);
  out.set(lenBytes, 4);
  out.set(value, 8);
  return out;
}

function utf16be(s: string): Uint8Array {
  const out = new Uint8Array(s.length * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < s.length; i++) view.setUint16(i * 2, s.charCodeAt(i), false);
  return out;
}

function decodeUtf16be(bytes: Uint8Array): string {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let out = "";
  for (let i = 0; i + 1 < bytes.length; i += 2) out += String.fromCharCode(view.getUint16(i, false));
  return out;
}

function parseContainer(data: Uint8Array): { tag: string; value: Uint8Array }[] {
  const entries: { tag: string; value: Uint8Array }[] = [];
  let offset = 0;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  while (offset + 8 <= data.length) {
    const tag = new TextDecoder("ascii").decode(data.slice(offset, offset + 4));
    const length = view.getUint32(offset + 4, false);
    const value = data.slice(offset + 8, offset + 8 + length);
    entries.push({ tag, value });
    offset += 8 + length;
  }
  return entries;
}

export function readCrateTrackPaths(data: Uint8Array): string[] {
  const paths: string[] = [];
  for (const { tag, value } of parseContainer(data)) {
    if (tag === "otrk") {
      for (const inner of parseContainer(value)) {
        if (inner.tag === "ptrk") paths.push(decodeUtf16be(inner.value));
      }
    }
  }
  return paths;
}

export function buildCrateBytes(trackPaths: string[]): Uint8Array {
  const columns: [string, string][] = [
    ["song", "0"], ["artist", "0"], ["bpm", "0"], ["key", "0"],
    ["album", "0"], ["length", "0"], ["comment", "0"],
  ];
  const chunks: Uint8Array[] = [tlv("vrsn", utf16be("1.0/Serato ScratchLive Crate"))];
  for (const [name, width] of columns) {
    const inner = concatBytes([tlv("tvcn", utf16be(name)), tlv("tvcw", utf16be(width))]);
    chunks.push(tlv("ovct", inner));
  }
  for (const path of trackPaths) {
    chunks.push(tlv("otrk", tlv("ptrk", utf16be(path))));
  }
  return concatBytes(chunks);
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

export interface CrateRow {
  name: string;
  trackCount: number;
  paths: string[];
  error: string | null;
}

/** Recursively lists .crate files under a Subcrates directory handle. */
export async function listCrates(subcratesHandle: FileSystemDirectoryHandle): Promise<CrateRow[]> {
  const results: CrateRow[] = [];

  async function walk(dir: FileSystemDirectoryHandle, prefix: string[]) {
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind === "directory") {
        await walk(handle as FileSystemDirectoryHandle, [...prefix, name]);
      } else if (name.toLowerCase().endsWith(".crate")) {
        const relName = [...prefix, name].join("/");
        try {
          const file = await (handle as FileSystemFileHandle).getFile();
          const buf = new Uint8Array(await file.arrayBuffer());
          const paths = readCrateTrackPaths(buf);
          results.push({ name: relName, trackCount: paths.length, paths, error: null });
        } catch (e) {
          results.push({ name: relName, trackCount: 0, paths: [], error: e instanceof Error ? e.message : String(e) });
        }
      }
    }
  }

  await walk(subcratesHandle, []);
  return results;
}

/** Groups files by top-level MUSIC subfolder and writes one new .crate
 * per group under Subcrates, skipping any crate name that already
 * exists. Paths stored are relative to the VOLUME ROOT with no drive-name
 * segment — verified directly against a real Serato-written crate, whose
 * track paths look like "MUSIC/QUE DROP/Song.mp3", not
 * "<drive name>/MUSIC/...". Pass literally "MUSIC" here (or whatever the
 * music folder's own name is), never the drive's name. */
export async function buildCratesFromFolders(
  musicFolderName: string,
  files: AudioFileEntry[],
  subcratesHandle: FileSystemDirectoryHandle
): Promise<{ created: string[]; skipped: string[] }> {
  const groups = new Map<string, string[]>();
  for (const f of files) {
    const relPath = [musicFolderName, ...f.path].join("/");
    if (!groups.has(f.top)) groups.set(f.top, []);
    groups.get(f.top)!.push(relPath);
  }

  const created: string[] = [];
  const skipped: string[] = [];
  for (const [name, paths] of groups) {
    const safeName = name.replace(/[\\/:*?"<>|]/g, "_");
    const fileName = `${safeName}.crate`;
    let exists = false;
    try {
      await subcratesHandle.getFileHandle(fileName);
      exists = true;
    } catch {
      exists = false;
    }
    if (exists) {
      skipped.push(fileName);
      continue;
    }
    const fileHandle = await subcratesHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(new Blob([new Uint8Array(buildCrateBytes(paths))]));
    await writable.close();
    created.push(fileName);
  }

  return { created, skipped };
}

export function formatGB(bytes: number): string {
  return (bytes / 1024 ** 3).toFixed(1);
}

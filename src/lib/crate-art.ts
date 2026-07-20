import { readId3Tags } from "@/lib/browser-id3";
import type { CrateRow } from "@/lib/browser-serato";

export type ArtSource = "upload" | "embedded" | "spotify" | "none";

export interface CrateArt {
  source: ArtSource;
  url: string | null;
}

function crateSection(crateName: string): string {
  const safe = crateName.replace(/[^a-zA-Z0-9-]+/g, "-").toLowerCase();
  return `crate-cover-${safe}`;
}

export async function getFileHandleForPath(root: FileSystemDirectoryHandle, fullPath: string): Promise<FileSystemFileHandle | null> {
  const segments = fullPath.split("/").filter(Boolean);
  if (segments.length === 0) return null;
  try {
    let dir = root;
    // First segment is the music folder name (e.g. "MUSIC"); walk all but
    // the last segment (the filename) as directories.
    for (const seg of segments.slice(0, -1)) {
      dir = await dir.getDirectoryHandle(seg);
    }
    return await dir.getFileHandle(segments[segments.length - 1]);
  } catch {
    return null;
  }
}

/** Resolves a cover image for a crate: a previously-uploaded manual
 * override first, then embedded ID3 art from its first track, then a
 * Spotify search match, then nothing (caller shows a placeholder). */
export async function resolveCrateArt(crate: CrateRow, rootHandle: FileSystemDirectoryHandle): Promise<CrateArt> {
  const section = crateSection(crate.name);

  try {
    const res = await fetch(`/api/dj/library/photos?section=${encodeURIComponent(section)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.photos?.[0]?.url) return { source: "upload", url: data.photos[0].url };
    }
  } catch {
    // fall through to other sources
  }

  if (crate.paths.length > 0) {
    const handle = await getFileHandleForPath(rootHandle, crate.paths[0]);
    if (handle) {
      try {
        const file = await handle.getFile();
        const tags = await readId3Tags(file, true);
        if (tags.albumArt) {
          const blob = new Blob([new Uint8Array(tags.albumArt.data)], { type: tags.albumArt.mime });
          return { source: "embedded", url: URL.createObjectURL(blob) };
        }
      } catch {
        // fall through to Spotify
      }
    }
  }

  if (crate.paths.length > 0) {
    const firstName = crate.paths[0].split("/").pop() ?? "";
    const label = firstName.replace(/\.[a-zA-Z0-9]+$/, "");
    if (label.length > 2) {
      try {
        const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(label)}`);
        if (res.ok) {
          const data = await res.json();
          const art = data.tracks?.[0]?.albumArt;
          if (art) return { source: "spotify", url: art };
        }
      } catch {
        // fall through to none
      }
    }
  }

  return { source: "none", url: null };
}

export function crateCoverSection(crateName: string): string {
  return crateSection(crateName);
}

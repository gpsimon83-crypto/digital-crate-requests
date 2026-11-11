/**
 * Files in the private-by-design "event-files" bucket (contracts, email
 * attachments, uploads) are handed out through /api/files/…, which checks
 * who is asking and then redirects to a signed link that expires in two
 * minutes. Links to anything else (e.g. a provider-hosted signed PDF) are
 * left as they are.
 */
export const PROTECTED_BUCKET = "event-files";

export function storagePathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/event-files\/([^?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function protectFileUrl(kind: "event-file" | "contract", id: string, url: string | null): string | null {
  if (!url) return url;
  return storagePathFromUrl(url) ? `/api/files/${kind}/${id}` : url;
}

export function withProtectedUrls<T extends { id: string; file_url: string | null }>(kind: "event-file" | "contract", rows: T[]): T[] {
  return rows.map((r) => ({ ...r, file_url: protectFileUrl(kind, r.id, r.file_url) }));
}

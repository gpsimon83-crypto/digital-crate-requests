import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireEventAccess } from "@/lib/require-event-access";
import { getClientForAuthUser, getClientEvent } from "@/lib/data/portal";
import { PROTECTED_BUCKET, storagePathFromUrl } from "@/lib/security/protected-files";

const NO_STORE = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };

/**
 * Authorized download for project files and contracts. Checks on every
 * request that the caller is staff, the event's assigned DJ, or the client
 * who owns the event, then redirects to a signed link valid for 2 minutes.
 * Knowing a file's id is never enough on its own.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  if ((kind !== "event-file" && kind !== "contract") || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }

  const db = createAdminClient();
  const { data: row } = await db
    .from(kind === "contract" ? "contracts" : "event_files")
    .select("id, event_id, file_url")
    .eq("id", id)
    .maybeSingle();
  if (!row?.file_url) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });

  // Staff or assigned DJ…
  const access = await requireEventAccess(row.event_id);
  let allowed = access.authorized;
  // …or the client who owns this event.
  if (!allowed) {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401, headers: NO_STORE });
    const client = await getClientForAuthUser(user.id);
    allowed = !!client && !!(await getClientEvent(client.id, row.event_id));
  }
  if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });

  const path = storagePathFromUrl(row.file_url);
  if (!path) {
    if (!/^https:\/\//.test(row.file_url)) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
    return NextResponse.redirect(row.file_url, { status: 302, headers: NO_STORE });
  }
  const { data: signed, error } = await db.storage.from(PROTECTED_BUCKET).createSignedUrl(path, 120);
  if (error || !signed?.signedUrl) return NextResponse.json({ error: "File unavailable" }, { status: 404, headers: NO_STORE });
  return NextResponse.redirect(signed.signedUrl, { status: 302, headers: NO_STORE });
}

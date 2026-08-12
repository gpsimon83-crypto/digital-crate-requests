import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLibraryItem, updateEmailTemplate, deleteLibraryItem } from "@/lib/data/library";
import { errorMessage } from "@/lib/error-message";

const BUCKET = "library-files";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json();
  const { title, description, subject, body: emailBody } = body as {
    title?: string;
    description?: string;
    subject?: string;
    body?: string;
  };

  try {
    const item = await updateEmailTemplate(id, { title, description, subject, body: emailBody });
    return NextResponse.json({ item });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;

  try {
    const item = await getLibraryItem(id);
    if (item?.file_url) {
      const db = createAdminClient();
      const path = item.file_url.split(`/${BUCKET}/`)[1];
      if (path) await db.storage.from(BUCKET).remove([decodeURIComponent(path)]);
    }
    await deleteLibraryItem(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

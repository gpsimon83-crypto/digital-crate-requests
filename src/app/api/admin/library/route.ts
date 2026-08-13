import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { requireAuth } from "@/lib/require-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { listLibraryItems, createEmailTemplate, createFileItem, type LibraryCategory } from "@/lib/data/library";
import { errorMessage } from "@/lib/error-message";

const BUCKET = "library-files";
const CATEGORIES = ["email_template", "contract", "brochure"] as const;
const FILE_CATEGORIES = ["contract", "brochure"] as const;

// Any signed-in DJ or admin can read the Library (they need email templates
// to compose from) — only admin/staff can create, edit, or delete entries.
export async function GET(req: NextRequest) {
  const denied = await requireAuth();
  if (denied) return denied;

  const category = req.nextUrl.searchParams.get("category") as LibraryCategory | null;
  if (category && !CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  try {
    const items = await listLibraryItems(category ?? undefined);
    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const contentType = req.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const category = String(form.get("category") ?? "");
      const title = String(form.get("title") ?? "").trim();
      const description = String(form.get("description") ?? "").trim();
      const file = form.get("file");

      if (!(FILE_CATEGORIES as readonly string[]).includes(category)) {
        return NextResponse.json({ error: "Invalid category for a file upload" }, { status: 400 });
      }
      if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
      if (!(file instanceof File) || file.size === 0) {
        return NextResponse.json({ error: "A file is required" }, { status: 400 });
      }

      const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
      const path = `${category}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const db = createAdminClient();
      const { error: uploadError } = await db.storage.from(BUCKET).upload(path, buffer, { contentType: file.type || "application/octet-stream" });
      if (uploadError) throw uploadError;

      const { data: pub } = db.storage.from(BUCKET).getPublicUrl(path);

      const item = await createFileItem({
        category: category as Exclude<LibraryCategory, "email_template">,
        title,
        description: description || undefined,
        fileUrl: pub.publicUrl,
        fileName: file.name
      });

      return NextResponse.json({ item });
    }

    const body = await req.json();
    const { title, description, subject, body: emailBody } = body as {
      title?: string;
      description?: string;
      subject?: string;
      body?: string;
    };

    if (!title?.trim() || !subject?.trim() || !emailBody?.trim()) {
      return NextResponse.json({ error: "Title, subject, and body are required" }, { status: 400 });
    }

    const item = await createEmailTemplate({ title: title.trim(), description: description?.trim(), subject: subject.trim(), body: emailBody.trim() });
    return NextResponse.json({ item });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/require-event-access";
import { listEventFiles, createEventFile, type EventFileCategory } from "@/lib/data/event-files";
import { createFileContract } from "@/lib/data/contracts";
import { getLibraryItem } from "@/lib/data/library";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";

const BUCKET = "event-files";
const CATEGORIES: EventFileCategory[] = ["contract", "email_attachment", "other"];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireEventAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const files = await listEventFiles(id);
    return NextResponse.json({ files });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireEventAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

  const contentType = req.headers.get("content-type") ?? "";

  // Copying a file in from the Library — no bytes to upload, just point a
  // new event_files row at the same already-hosted file.
  if (contentType.includes("application/json")) {
    try {
      const { libraryItemId } = (await req.json()) as { libraryItemId?: string };
      if (!libraryItemId) return NextResponse.json({ error: "libraryItemId is required" }, { status: 400 });

      const item = await getLibraryItem(libraryItemId);
      if (!item || !item.file_url) return NextResponse.json({ error: "That Library item doesn't have a file to add" }, { status: 400 });

      const category: EventFileCategory = item.category === "contract" ? "contract" : "other";
      const eventFile = await createEventFile(id, {
        category,
        fileUrl: item.file_url,
        fileName: item.file_name || item.title,
        source: "library",
        uploadedBy: access.user.id
      });

      if (category === "contract") {
        await createFileContract(id, { fileUrl: item.file_url, fileName: item.file_name || item.title });
      }

      return NextResponse.json({ file: eventFile });
    } catch (err) {
      return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
    }
  }

  try {
    const form = await req.formData();
    const category = String(form.get("category") ?? "other");
    const file = form.get("file");

    if (!CATEGORIES.includes(category as EventFileCategory)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "A file is required" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
    const path = `${id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const db = createAdminClient();
    const { error: uploadError } = await db.storage.from(BUCKET).upload(path, buffer, { contentType: file.type || "application/octet-stream" });
    if (uploadError) throw uploadError;

    const { data: pub } = db.storage.from(BUCKET).getPublicUrl(path);

    const eventFile = await createEventFile(id, {
      category: category as EventFileCategory,
      fileUrl: pub.publicUrl,
      fileName: file.name,
      source: "upload",
      uploadedBy: access.user.id
    });

    // Uploading a contract here is the same as sending one — it shows up
    // immediately as the client's signable contract in their portal.
    if (category === "contract") {
      await createFileContract(id, { fileUrl: pub.publicUrl, fileName: file.name });
    }

    return NextResponse.json({ file: eventFile });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/require-event-access";
import { listEventFiles, createEventFile, type EventFileCategory } from "@/lib/data/event-files";
import { sendEventContract } from "@/lib/data/events";
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
    // immediately as the client's signable contract in their portal, same
    // as if it had been set through the (separate, older) contract flow.
    if (category === "contract") {
      await sendEventContract(id, pub.publicUrl);
    }

    return NextResponse.json({ file: eventFile });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

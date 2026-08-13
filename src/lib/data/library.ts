import { createAdminClient } from "@/lib/supabase/admin";

// "questionnaire" was a legacy static-file category, superseded by the
// real, database-driven Questionnaire Builder (questionnaire_templates
// etc.) — no longer offered as a Library category. The DB's category
// CHECK constraint still technically allows the value (no rows ever used
// it, so no migration needed), but nothing in the app writes it anymore.
export type LibraryCategory = "email_template" | "contract" | "brochure";

export interface LibraryItem {
  id: string;
  category: LibraryCategory;
  title: string;
  description: string | null;
  subject: string | null;
  body: string | null;
  file_url: string | null;
  file_name: string | null;
  created_at: string;
  updated_at: string;
}

export async function listLibraryItems(category?: LibraryCategory) {
  const db = createAdminClient();
  let query = db.from("library_items").select("*").order("created_at", { ascending: false });
  if (category) query = query.eq("category", category);
  const { data, error } = await query;
  if (error) throw error;
  return data as LibraryItem[];
}

export async function createEmailTemplate(input: { title: string; description?: string; subject: string; body: string }) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("library_items")
    .insert({
      category: "email_template",
      title: input.title,
      description: input.description ?? null,
      subject: input.subject,
      body: input.body
    })
    .select()
    .single();
  if (error) throw error;
  return data as LibraryItem;
}

export async function createFileItem(input: {
  category: Exclude<LibraryCategory, "email_template">;
  title: string;
  description?: string;
  fileUrl: string;
  fileName: string;
}) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("library_items")
    .insert({
      category: input.category,
      title: input.title,
      description: input.description ?? null,
      file_url: input.fileUrl,
      file_name: input.fileName
    })
    .select()
    .single();
  if (error) throw error;
  return data as LibraryItem;
}

export async function updateEmailTemplate(id: string, input: { title?: string; description?: string; subject?: string; body?: string }) {
  const db = createAdminClient();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.subject !== undefined) updates.subject = input.subject;
  if (input.body !== undefined) updates.body = input.body;

  const { data, error } = await db.from("library_items").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data as LibraryItem;
}

export async function getLibraryItem(id: string) {
  const db = createAdminClient();
  const { data, error } = await db.from("library_items").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as LibraryItem | null;
}

export async function deleteLibraryItem(id: string) {
  const db = createAdminClient();
  const { error } = await db.from("library_items").delete().eq("id", id);
  if (error) throw error;
}

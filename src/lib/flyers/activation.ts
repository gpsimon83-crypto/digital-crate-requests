import type { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;
export type ActivationScope = "company" | "venue" | "event";
export type Activation = { id: string; scope: ActivationScope; venue_id: string | null; event_id: string | null; template_id: string; activated_at: string };

/** All activations (empty before migration 0052). */
export async function listActivations(db: Db): Promise<Activation[]> {
  const { data, error } = await db.from("flyer_template_activations").select("id, scope, venue_id, event_id, template_id, activated_at");
  if (error) return [];
  return (data ?? []) as Activation[];
}

/**
 * Which template a new flyer for this event/venue starts from:
 * event override → venue default → company default → newest published template.
 * Only published templates count.
 */
export async function resolveTemplate(db: Db, opts: { eventId?: string | null; venueId?: string | null; /** For a DJ: the templates shared with them (an activation the office set still counts). */ allowed?: (id: string) => boolean }): Promise<{ templateId: string | null; via: ActivationScope | "latest" | null }> {
  const acts = await listActivations(db);
  const { data: pub } = await db.from("flyer_templates").select("id, updated_at").eq("status", "published").order("updated_at", { ascending: false });
  const published = new Set(((pub ?? []) as { id: string }[]).map((t) => t.id));
  const pick = (a?: Activation) => (a && published.has(a.template_id) ? a.template_id : null);
  const byEvent = opts.eventId ? pick(acts.find((a) => a.scope === "event" && a.event_id === opts.eventId)) : null;
  if (byEvent) return { templateId: byEvent, via: "event" };
  const byVenue = opts.venueId ? pick(acts.find((a) => a.scope === "venue" && a.venue_id === opts.venueId)) : null;
  if (byVenue) return { templateId: byVenue, via: "venue" };
  const company = pick(acts.find((a) => a.scope === "company"));
  if (company) return { templateId: company, via: "company" };
  const latest = ((pub ?? []) as { id: string }[]).find((t) => !opts.allowed || opts.allowed(t.id))?.id ?? null;
  return { templateId: latest, via: latest ? "latest" : null };
}

/** Set (or clear, with templateId null) one activation. Replaces whatever was active for that scope/target. */
export async function setActivation(db: Db, a: { scope: ActivationScope; venueId?: string | null; eventId?: string | null; templateId: string | null; userId: string }) {
  let del = db.from("flyer_template_activations").delete().eq("scope", a.scope);
  if (a.scope === "venue") del = del.eq("venue_id", a.venueId!);
  if (a.scope === "event") del = del.eq("event_id", a.eventId!);
  const { error: dErr } = await del;
  if (dErr) throw dErr;
  if (!a.templateId) return;
  const { error } = await db.from("flyer_template_activations").insert({
    scope: a.scope,
    venue_id: a.scope === "venue" ? a.venueId : null,
    event_id: a.scope === "event" ? a.eventId : null,
    template_id: a.templateId,
    activated_by: a.userId
  });
  if (error) throw error;
}

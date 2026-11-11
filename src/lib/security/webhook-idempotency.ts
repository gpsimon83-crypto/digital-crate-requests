import { createAdminClient } from "@/lib/supabase/admin";

export interface WebhookLedger {
  /** "new" = this caller processes it; "done" = already processed; "busy" = another delivery is mid-way. */
  claim(provider: string, eventId: string): Promise<"new" | "done" | "busy">;
  complete(provider: string, eventId: string): Promise<void>;
  /** Processing failed: forget the claim so the provider's retry is processed. */
  release(provider: string, eventId: string): Promise<void>;
}

export const supabaseWebhookLedger: WebhookLedger = {
  async claim(provider, eventId) {
    const db = createAdminClient();
    const { error } = await db.from("processed_webhook_events").insert({ provider, event_id: eventId, status: "processing" });
    if (!error) return "new";
    if (error.code !== "23505") throw error;
    const { data } = await db.from("processed_webhook_events").select("status, processed_at").eq("provider", provider).eq("event_id", eventId).maybeSingle();
    if (data?.status === "done") return "done";
    // A claim stuck "processing" for 10+ minutes is from a crashed run; take it over.
    if (data && Date.now() - new Date(data.processed_at).getTime() > 10 * 60 * 1000) {
      const { data: taken } = await db
        .from("processed_webhook_events")
        .update({ processed_at: new Date().toISOString() })
        .eq("provider", provider)
        .eq("event_id", eventId)
        .eq("status", "processing")
        .eq("processed_at", data.processed_at)
        .select("event_id");
      if ((taken ?? []).length === 1) return "new";
    }
    return "busy";
  },
  async complete(provider, eventId) {
    await createAdminClient().from("processed_webhook_events").update({ status: "done", processed_at: new Date().toISOString() }).eq("provider", provider).eq("event_id", eventId);
  },
  async release(provider, eventId) {
    await createAdminClient().from("processed_webhook_events").delete().eq("provider", provider).eq("event_id", eventId).eq("status", "processing");
  }
};

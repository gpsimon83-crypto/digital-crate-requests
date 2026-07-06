import { createAdminClient } from "@/lib/supabase/admin";

export async function getEventByCode(eventCode: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("events")
    .select("*, djs(*), venues(*)")
    .eq("event_code", eventCode)
    .single();
  if (error) return null;
  return data;
}

export async function listSongRequests(eventId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("song_requests")
    .select("*")
    .eq("event_id", eventId)
    .order("vote_count", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createSongRequest(input: {
  eventId: string;
  customerId?: string;
  songTitle: string;
  artist?: string;
  isPaid?: boolean;
  amountCents?: number;
  paymentIntentId?: string;
}) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("song_requests")
    .insert({
      event_id: input.eventId,
      customer_id: input.customerId ?? null,
      song_title: input.songTitle,
      artist: input.artist ?? null,
      is_paid: input.isPaid ?? false,
      amount_cents: input.amountCents ?? 0,
      payment_intent_id: input.paymentIntentId ?? null,
      payment_status: input.isPaid ? "authorized" : "none",
    })
    .select()
    .single();
  if (error) throw error;

  await logFeedEvent(input.eventId, "request", {
    songTitle: input.songTitle,
    artist: input.artist,
  });

  if (input.customerId) await awardPoints(input.customerId, 10);

  return data;
}

export async function upvoteRequest(requestId: string, customerId?: string) {
  const db = createAdminClient();

  if (customerId) {
    const { error: voteError } = await db.from("votes").insert({
      request_id: requestId,
      customer_id: customerId,
    });
    if (voteError && voteError.code !== "23505") throw voteError; // ignore duplicate vote
    if (voteError) {
      // Already voted — return the request unchanged instead of inflating vote_count again.
      const { data: existing, error: fetchError } = await db.from("song_requests").select("*").eq("id", requestId).single();
      if (fetchError) throw fetchError;
      return existing;
    }
    await awardPoints(customerId, 5);
  }

  const { data, error } = await db.rpc("increment_vote_count", { req_id: requestId }).select().single();
  if (error) {
    // Fallback if the RPC hasn't been created yet: read-modify-write.
    const { data: current } = await db.from("song_requests").select("vote_count").eq("id", requestId).single();
    const { data: updated, error: updateError } = await db
      .from("song_requests")
      .update({ vote_count: (current?.vote_count ?? 0) + 1 })
      .eq("id", requestId)
      .select()
      .single();
    if (updateError) throw updateError;
    return updated;
  }
  return data;
}

export async function boostRequest(requestId: string, amountCents: number, paymentIntentId: string, customerId?: string) {
  const db = createAdminClient();
  const { error: boostError } = await db.from("boosts").insert({
    request_id: requestId,
    customer_id: customerId ?? null,
    amount_cents: amountCents,
    payment_intent_id: paymentIntentId,
  });
  if (boostError) throw boostError;

  const { data: current } = await db.from("song_requests").select("boost_total_cents, event_id, song_title").eq("id", requestId).single();
  const { data: updated, error } = await db
    .from("song_requests")
    .update({ boost_total_cents: (current?.boost_total_cents ?? 0) + amountCents })
    .eq("id", requestId)
    .select()
    .single();
  if (error) throw error;

  if (current?.event_id) {
    await logFeedEvent(current.event_id, "boost", { songTitle: current.song_title, amountCents });
  }

  return updated;
}

export async function markRequestPlayed(requestId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("song_requests")
    .update({ status: "played", payment_status: "captured" })
    .eq("id", requestId)
    .select()
    .single();
  if (error) throw error;

  if (data?.event_id) {
    await logFeedEvent(data.event_id, "played", { songTitle: data.song_title });
  }
  return data;
}

export async function declineRequest(requestId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("song_requests")
    .update({ status: "declined", payment_status: "canceled" })
    .eq("id", requestId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function approveRequest(requestId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("song_requests")
    .update({ status: "approved" })
    .eq("id", requestId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createTip(input: { eventId: string; djId?: string; customerId?: string; amountCents: number; message?: string; paymentIntentId: string }) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("tips")
    .insert({
      event_id: input.eventId,
      dj_id: input.djId ?? null,
      customer_id: input.customerId ?? null,
      amount_cents: input.amountCents,
      message: input.message ?? null,
      payment_intent_id: input.paymentIntentId,
    })
    .select()
    .single();
  if (error) throw error;

  await logFeedEvent(input.eventId, "tip", { amountCents: input.amountCents });
  if (input.customerId) await awardPoints(input.customerId, 25);
  return data;
}

export async function awardPoints(customerId: string, points: number) {
  const db = createAdminClient();
  const { data: current } = await db.from("customers").select("reward_points").eq("id", customerId).single();
  await db
    .from("customers")
    .update({ reward_points: (current?.reward_points ?? 0) + points })
    .eq("id", customerId);
}

export async function logFeedEvent(eventId: string, type: string, payload: Record<string, unknown>) {
  const db = createAdminClient();
  await db.from("feed_events").insert({ event_id: eventId, type, payload });
}

export async function listFeedEvents(eventId: string, limit = 30) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("feed_events")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

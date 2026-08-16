import { createAdminClient } from "@/lib/supabase/admin";
import { getLibraryItem } from "@/lib/data/library";
import { fillMergeFields, type MergeContext } from "@/lib/merge-fields";

export interface ContractRow {
  id: string;
  event_id: string;
  template_id: string | null;
  status: "draft" | "sent" | "signed" | "void";
  title: string;
  body: string | null;
  file_url: string | null;
  file_name: string | null;
  sent_at: string | null;
  signed_at: string | null;
  signed_by_name: string | null;
  signed_ip: string | null;
  signed_user_agent: string | null;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface EventJoinRow {
  id: string;
  event_code: string;
  title: string | null;
  event_type: string | null;
  starts_at: string | null;
  ends_at: string | null;
  quoted_amount: number | null;
  final_amount: number | null;
  djs: { display_name: string } | null;
  venues: { name: string } | null;
  clients: { first_name: string | null; last_name: string | null; company_name: string | null } | null;
}

async function buildContractMergeContext(eventId: string, origin: string): Promise<MergeContext> {
  const db = createAdminClient();
  const { data: event } = await db
    .from("events")
    .select(
      "id, event_code, title, event_type, starts_at, ends_at, quoted_amount, final_amount, djs(display_name), venues(name), clients(first_name, last_name, company_name)"
    )
    .eq("id", eventId)
    .single();
  if (!event) return {};
  const e = event as unknown as EventJoinRow;

  const { data: payments } = await db.from("payments").select("amount_cents, kind").eq("event_id", eventId).eq("status", "succeeded");
  const totalDueCents = Math.round((e.final_amount ?? e.quoted_amount ?? 0) * 100);
  const depositCents = (payments ?? []).filter((p) => p.kind === "deposit").reduce((s, p) => s + p.amount_cents, 0);
  const paidCents = (payments ?? []).reduce((s, p) => s + p.amount_cents, 0);
  const balanceCents = Math.max(0, totalDueCents - paidCents);

  const client = e.clients;
  const clientName = client ? client.company_name || [client.first_name, client.last_name].filter(Boolean).join(" ") : undefined;

  return {
    clientFirstName: client?.first_name ?? clientName,
    clientFullName: clientName,
    eventType: e.event_type ?? undefined,
    eventDate: e.starts_at
      ? new Date(e.starts_at).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
      : undefined,
    eventTime: e.starts_at ? new Date(e.starts_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : undefined,
    eventEndTime: e.ends_at ? new Date(e.ends_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : undefined,
    venueName: e.venues?.name ?? undefined,
    djName: e.djs?.display_name ?? undefined,
    totalAmount: totalDueCents ? `$${(totalDueCents / 100).toFixed(2)}` : undefined,
    depositAmount: depositCents ? `$${(depositCents / 100).toFixed(2)}` : undefined,
    balanceDue: `$${(balanceCents / 100).toFixed(2)}`,
    portalLink: `${origin}/portal/events/${eventId}`,
    eventCode: e.event_code
  };
}

/** Keeps events.contract_status (denormalized for cheap list-page reads) in sync with the latest non-void contract. */
async function syncEventContractStatus(eventId: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("contracts")
    .select("status")
    .eq("event_id", eventId)
    .neq("status", "void")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  await db
    .from("events")
    .update({ contract_status: data?.status ?? "none" })
    .eq("id", eventId);
}

/** Only one contract can be in flight per event at a time — starting a new one supersedes whatever wasn't finished. */
async function supersedePendingContracts(eventId: string) {
  const db = createAdminClient();
  await db
    .from("contracts")
    .update({ status: "void", voided_at: new Date().toISOString(), void_reason: "Superseded by a new contract" })
    .eq("event_id", eventId)
    .in("status", ["draft", "sent"]);
}

export async function listContractsForEvent(eventId: string) {
  const db = createAdminClient();
  const { data, error } = await db.from("contracts").select("*").eq("event_id", eventId).order("created_at", { ascending: false });
  if (error) throw error;
  return data as ContractRow[];
}

export interface ClientContract extends ContractRow {
  events: { title: string | null; event_code: string } | null;
}

/** Every contract across every event this client has ever booked, newest first — the Client Workspace rollup. */
export async function listContractsForClient(clientId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("contracts")
    .select("*, events!inner(title, event_code, client_id)")
    .eq("events.client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as ClientContract[];
}

export async function createDraftFromTemplate(eventId: string, templateId: string, origin: string) {
  const template = await getLibraryItem(templateId);
  if (!template || template.category !== "contract_template" || !template.body) {
    throw new Error("Contract template not found");
  }

  const ctx = await buildContractMergeContext(eventId, origin);
  const body = fillMergeFields(template.body, ctx);

  await supersedePendingContracts(eventId);
  const db = createAdminClient();
  const { data, error } = await db
    .from("contracts")
    .insert({ event_id: eventId, template_id: templateId, status: "draft", title: template.title, body })
    .select()
    .single();
  if (error) throw error;
  await syncEventContractStatus(eventId);
  return data as ContractRow;
}

/** Uploading a file has always meant "send it" in this app (no separate draft step for an already-final document). */
export async function createFileContract(eventId: string, input: { fileUrl: string; fileName: string }) {
  await supersedePendingContracts(eventId);
  const db = createAdminClient();
  const { data, error } = await db
    .from("contracts")
    .insert({
      event_id: eventId,
      status: "sent",
      title: input.fileName,
      file_url: input.fileUrl,
      file_name: input.fileName,
      sent_at: new Date().toISOString()
    })
    .select()
    .single();
  if (error) throw error;
  await syncEventContractStatus(eventId);
  return data as ContractRow;
}

export async function updateDraftBody(id: string, body: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("contracts")
    .update({ body, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "draft")
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Only a draft contract's text can be edited");
  return data as ContractRow;
}

export async function sendContract(id: string) {
  const db = createAdminClient();
  const { data: existing } = await db.from("contracts").select("event_id, status").eq("id", id).maybeSingle();
  if (!existing || existing.status !== "draft") throw new Error("Only a draft contract can be sent");

  const { data, error } = await db
    .from("contracts")
    .update({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  await syncEventContractStatus(existing.event_id);
  return data as ContractRow;
}

export async function voidContract(id: string, reason?: string) {
  const db = createAdminClient();
  const { data: existing } = await db.from("contracts").select("event_id, status").eq("id", id).maybeSingle();
  if (!existing || existing.status === "signed" || existing.status === "void") {
    throw new Error("This contract can't be voided");
  }

  const { data, error } = await db
    .from("contracts")
    .update({ status: "void", voided_at: new Date().toISOString(), void_reason: reason ?? null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  await syncEventContractStatus(existing.event_id);
  return data as ContractRow;
}

/**
 * Client-portal signing — no real e-signature service configured (no
 * HelloSign account), so the audit trail is typed name + capture IP/user
 * agent/timestamp rather than a drawn signature. Only the current sent,
 * unsigned contract for this event (owned by this client) can be signed.
 */
export async function signContractForClient(
  clientId: string,
  eventId: string,
  input: { fullName: string; ip: string | null; userAgent: string | null }
) {
  const db = createAdminClient();
  const { data: event } = await db.from("events").select("id").eq("id", eventId).eq("client_id", clientId).maybeSingle();
  if (!event) return null;

  const { data, error } = await db
    .from("contracts")
    .update({
      status: "signed",
      signed_at: new Date().toISOString(),
      signed_by_name: input.fullName,
      signed_ip: input.ip,
      signed_user_agent: input.userAgent,
      updated_at: new Date().toISOString()
    })
    .eq("event_id", eventId)
    .eq("status", "sent")
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  await syncEventContractStatus(eventId);
  return data as ContractRow;
}

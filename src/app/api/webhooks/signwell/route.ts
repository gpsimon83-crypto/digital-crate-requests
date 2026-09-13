import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySignWellWebhookHash, getSignWellDocument } from "@/lib/signwell";
import { syncEventContractStatus } from "@/lib/data/contracts";
import { errorMessage } from "@/lib/error-message";

interface SignWellWebhookBody {
  event: {
    type: string;
    time: number;
    hash: string;
  };
  data: {
    object: {
      id: string;
    };
  };
}

/**
 * SignWell posts every document event here. We only act on
 * document_completed — the moment the client (our only recipient) has
 * actually signed. Everything else is ignored, not stored, since staff
 * already see contract status in the admin UI.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as SignWellWebhookBody;
  const event = body?.event;
  const documentId = body?.data?.object?.id;

  if (!event?.hash || !documentId) {
    return NextResponse.json({ error: "Malformed webhook payload" }, { status: 400 });
  }
  if (!verifySignWellWebhookHash(event.hash, event.type, event.time)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const db = createAdminClient();
    const { data: contract } = await db.from("contracts").select("id, event_id").eq("esign_document_id", documentId).maybeSingle();
    if (!contract) return NextResponse.json({ ok: true, note: "No matching contract" });

    if (event.type === "document_completed") {
      const doc = await getSignWellDocument(documentId);
      await db
        .from("contracts")
        .update({
          status: "signed",
          signed_at: new Date().toISOString(),
          signed_by_name: "Signed via SignWell",
          file_url: doc?.completed_pdf_url ?? null,
          esign_status: "completed",
          updated_at: new Date().toISOString()
        })
        .eq("id", contract.id);

      await syncEventContractStatus(contract.event_id);
    } else {
      await db.from("contracts").update({ esign_status: event.type }).eq("id", contract.id);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { createClient } from "@/lib/supabase/server";
import { getClientForAuthUser } from "@/lib/data/portal";
import { signContractForClient } from "@/lib/data/contracts";
import { logActivity } from "@/lib/activity";
import { runAutomations } from "@/lib/automations-engine";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { fullName } = body as { fullName?: string };

  if (!fullName || fullName.trim().length < 2) {
    return NextResponse.json({ error: "Your full legal name is required to sign" }, { status: 400 });
  }

  try {
    const client = await getClientForAuthUser(user.id);
    if (!client) return NextResponse.json({ error: "No client record linked to this account" }, { status: 403 });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const userAgent = req.headers.get("user-agent");
    const contract = await signContractForClient(client.id, id, { fullName: fullName.trim(), ip, userAgent });
    if (!contract) {
      return NextResponse.json({ error: "This contract can't be signed — it may not have been sent yet, or is already signed." }, { status: 409 });
    }

    await logActivity({
      actorUserId: user.id,
      actorLabel: fullName.trim(),
      action: "contract.signed",
      entityType: "event",
      entityId: id,
      eventId: id
    });
    await runAutomations("contract_signed", id, req.nextUrl.origin);

    return NextResponse.json({ contract });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

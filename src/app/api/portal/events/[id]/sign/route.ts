import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { createClient } from "@/lib/supabase/server";
import { getClientForAuthUser, signClientEventContract } from "@/lib/data/portal";
import { logActivity } from "@/lib/activity";

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

    const event = await signClientEventContract(client.id, id, fullName.trim());
    if (!event) {
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

    return NextResponse.json({ event });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

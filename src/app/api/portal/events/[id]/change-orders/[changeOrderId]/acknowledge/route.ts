import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { createClient } from "@/lib/supabase/server";
import { getClientForAuthUser } from "@/lib/data/portal";
import { acknowledgeChangeOrderAsClient } from "@/lib/data/contract-change-orders";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; changeOrderId: string }> }) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id, changeOrderId } = await params;
  const { fullName } = (await req.json().catch(() => ({}))) as { fullName?: string };
  if (!fullName?.trim()) return NextResponse.json({ error: "Your name is required to acknowledge this change" }, { status: 400 });

  try {
    const client = await getClientForAuthUser(user.id);
    if (!client) return NextResponse.json({ error: "No client record linked to this account" }, { status: 403 });

    const changeOrder = await acknowledgeChangeOrderAsClient(changeOrderId, id, client.id, fullName.trim());
    if (!changeOrder) return NextResponse.json({ error: "Change not found" }, { status: 404 });
    return NextResponse.json({ changeOrder });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

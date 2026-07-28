import { NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { createClient } from "@/lib/supabase/server";
import { linkClientToAuthUser, getClientForAuthUser, listClientEvents } from "@/lib/data/portal";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    if (!user.email) throw new Error("Account has no email on file");
    await linkClientToAuthUser(user.id, user.email);

    const client = await getClientForAuthUser(user.id);
    if (!client) {
      return NextResponse.json({ user: { email: user.email }, client: null, events: [] });
    }

    const events = await listClientEvents(client.id);
    return NextResponse.json({ user: { email: user.email }, client, events });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

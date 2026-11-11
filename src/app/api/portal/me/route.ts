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
    // Only an address the person has proven they own can claim a client
    // record (protects clients even if email confirmation is ever switched
    // off in Supabase Auth settings).
    if (user.email_confirmed_at) await linkClientToAuthUser(user.id, user.email);

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

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Guards API routes that any signed-in DJ or admin may read (not the public). */
export async function requireAuth(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  return null;
}

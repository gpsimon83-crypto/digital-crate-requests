import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runSeratoToolkit } from "@/lib/serato-toolkit";
import { errorMessage } from "@/lib/error-message";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const musicDir = req.nextUrl.searchParams.get("musicDir");
  if (!musicDir) {
    return NextResponse.json({ error: "musicDir is required" }, { status: 400 });
  }

  try {
    const result = await runSeratoToolkit(["scan", "--music-dir", musicDir]);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

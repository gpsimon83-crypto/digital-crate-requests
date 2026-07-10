import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runSeratoToolkit } from "@/lib/serato-toolkit";
import { errorMessage } from "@/lib/error-message";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { musicDir, live } = await req.json();
  if (!musicDir) {
    return NextResponse.json({ error: "musicDir is required" }, { status: 400 });
  }

  const args = ["dedupe", "--music-dir", musicDir];
  if (live) args.push("--live");

  try {
    const result = await runSeratoToolkit(args);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

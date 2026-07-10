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

  const { seratoDir, musicDir, scheme, live } = await req.json();
  if (!seratoDir || !musicDir) {
    return NextResponse.json({ error: "seratoDir and musicDir are required" }, { status: 400 });
  }

  const args = [
    "crates", "build",
    "--serato-dir", seratoDir,
    "--music-dir", musicDir,
    "--scheme", scheme === "genre" ? "genre" : "folder",
  ];
  if (live) args.push("--live");

  try {
    const result = await runSeratoToolkit(args);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

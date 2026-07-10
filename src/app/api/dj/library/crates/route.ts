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

  const seratoDir = req.nextUrl.searchParams.get("seratoDir");
  if (!seratoDir) {
    return NextResponse.json({ error: "seratoDir is required" }, { status: 400 });
  }

  try {
    const result = await runSeratoToolkit(["crates", "list", "--serato-dir", seratoDir]);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

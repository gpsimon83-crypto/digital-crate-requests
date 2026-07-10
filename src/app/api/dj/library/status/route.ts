import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/error-message";
import fs from "fs/promises";
import path from "path";

/**
 * Honest "is Serato connected" check: we don't have a live Serato session
 * file to validate a binary parser against (see scripts/serato_toolkit.py
 * header — its crate parser was validated against a real file; History
 * session files use a related but unconfirmed format), so rather than
 * fabricate a "now playing" track we report only what we can verify from
 * disk: whether the _Serato_ folder exists and when it was last touched.
 */
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
    await fs.access(seratoDir);
  } catch {
    return NextResponse.json({ found: false, lastActivity: null, historyFound: false });
  }

  let lastActivity: string | null = null;
  try {
    const dbStat = await fs.stat(path.join(seratoDir, "database V2"));
    lastActivity = dbStat.mtime.toISOString();
  } catch {
    // no database V2 file — leave lastActivity null
  }

  let historyFound = false;
  let latestSessionAt: string | null = null;
  try {
    const historyDir = path.join(seratoDir, "History", "Sessions");
    const files = await fs.readdir(historyDir);
    if (files.length > 0) {
      historyFound = true;
      const stats = await Promise.all(
        files.map((f) => fs.stat(path.join(historyDir, f)).catch(() => null))
      );
      const latest = stats
        .filter((s): s is NonNullable<typeof s> => !!s)
        .sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
      if (latest) latestSessionAt = latest.mtime.toISOString();
    }
  } catch {
    // no History/Sessions folder — Serato may never have been run from this drive
  }

  try {
    return NextResponse.json({ found: true, lastActivity, historyFound, latestSessionAt });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

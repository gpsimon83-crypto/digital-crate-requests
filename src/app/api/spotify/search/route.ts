import { NextRequest, NextResponse } from "next/server";
import { searchTracks } from "@/lib/spotify";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q || q.trim().length < 2) {
    return NextResponse.json({ tracks: [] });
  }

  try {
    const tracks = await searchTracks(q);
    return NextResponse.json({ tracks });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}

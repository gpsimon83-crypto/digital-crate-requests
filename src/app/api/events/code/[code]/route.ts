import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { getEventByCode } from "@/lib/data/requests";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  try {
    const event = await getEventByCode(code);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    return NextResponse.json({ event });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

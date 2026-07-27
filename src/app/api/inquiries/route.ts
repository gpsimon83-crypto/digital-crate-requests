import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { createInquiry } from "@/lib/data/inquiries";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, eventDate, eventType } = body;

  if (!name || !email || !eventDate || !eventType) {
    return NextResponse.json({ error: "name, email, eventDate, and eventType are required" }, { status: 400 });
  }

  try {
    const event = await createInquiry(body);
    return NextResponse.json({ event });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

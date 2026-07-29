import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { getAvailability, updateAvailability, getSlotMinutes, updateSlotMinutes } from "@/lib/data/scheduler";
import { requireAuth } from "@/lib/require-auth";
import { requireAdmin } from "@/lib/require-admin";

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  try {
    const [availability, slotMinutes] = await Promise.all([getAvailability(), getSlotMinutes()]);
    return NextResponse.json({ availability, slotMinutes });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json();

  try {
    if (Array.isArray(body.availability)) {
      await updateAvailability(body.availability);
    }
    if (typeof body.slotMinutes === "number" && body.slotMinutes > 0) {
      await updateSlotMinutes(body.slotMinutes);
    }
    const [availability, slotMinutes] = await Promise.all([getAvailability(), getSlotMinutes()]);
    return NextResponse.json({ availability, slotMinutes });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

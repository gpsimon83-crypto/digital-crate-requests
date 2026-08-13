import { NextRequest, NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/require-event-access";
import { getResponse, getTemplateByIdForAdmin } from "@/lib/data/questionnaires";
import { errorMessage } from "@/lib/error-message";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireEventAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const response = await getResponse(id);
    if (!response) return NextResponse.json({ response: null, sections: [], questions: [] });

    const resolved = await getTemplateByIdForAdmin(response.template_id);
    return NextResponse.json({
      response,
      sections: resolved?.sections ?? [],
      questions: resolved?.questions ?? []
    });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

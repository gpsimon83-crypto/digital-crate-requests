import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-permission";
import { getReportsSummary, REPORT_RANGES, type ReportRange } from "@/lib/data/reports";
import { errorMessage } from "@/lib/error-message";

export async function GET(req: NextRequest) {
  const denied = await requirePermission("reports.view");
  if (denied) return denied;

  const rangeParam = req.nextUrl.searchParams.get("range") as ReportRange | null;
  const range: ReportRange = rangeParam && REPORT_RANGES.includes(rangeParam) ? rangeParam : "last_12_months";

  try {
    const summary = await getReportsSummary(range);
    return NextResponse.json({ range, summary });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

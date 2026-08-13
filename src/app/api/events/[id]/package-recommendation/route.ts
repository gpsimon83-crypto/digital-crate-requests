import { NextRequest, NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/require-event-access";
import { listPackages, type PackageRow } from "@/lib/data/packages";
import { getResponse } from "@/lib/data/questionnaires";
import { errorMessage } from "@/lib/error-message";
import type { Answers } from "@/lib/questionnaire-engine";

// Cheapest package whose name/description/features mention the keyword —
// "cheapest that qualifies" so a client who only needs cocktail coverage
// isn't pointed at a pricier package that happens to also include it.
function findByKeyword(packages: PackageRow[], keyword: string): PackageRow | null {
  const matches = packages.filter(
    (p) => p.name.toLowerCase().includes(keyword) || p.description.toLowerCase().includes(keyword) || p.features.some((f) => f.toLowerCase().includes(keyword))
  );
  if (matches.length === 0) return null;
  return [...matches].sort((a, b) => a.price - b.price)[0];
}

function answerIsYes(answers: Answers, key: string): boolean {
  const a = answers[key];
  return !!a && !("unsure" in a) && !Array.isArray(a.value) && a.value === "yes";
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireEventAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const packages = await listPackages();
    const response = await getResponse(id);

    let suggestedPackageId: string | null = null;
    let reason: string | null = null;

    if (response && packages.length > 0) {
      const answers = response.answers;
      if (answerIsYes(answers, "ceremony_audio")) {
        const pkg = findByKeyword(packages, "ceremony");
        if (pkg) {
          suggestedPackageId = pkg.id;
          reason = "They want ceremony audio/music covered, so this is the cheapest package that includes ceremony coverage.";
        }
      } else if (answerIsYes(answers, "cocktail_hour")) {
        const pkg = findByKeyword(packages, "cocktail");
        if (pkg) {
          suggestedPackageId = pkg.id;
          reason = "They want cocktail hour covered, so this is the cheapest package that includes it.";
        }
      }
    }

    return NextResponse.json({ packages, suggestedPackageId, reason });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

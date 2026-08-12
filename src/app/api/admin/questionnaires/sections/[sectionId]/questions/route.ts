import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createQuestion } from "@/lib/data/questionnaires";
import { errorMessage } from "@/lib/error-message";
import type { QuestionType, QuestionOption } from "@/lib/questionnaire-engine";

const VALID_TYPES: QuestionType[] = ["single_select", "multi_select", "short_text", "long_text", "person_list", "song", "time"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ sectionId: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { sectionId } = await params;
  const body = await req.json();
  const {
    key,
    position,
    prompt,
    subtext,
    questionType,
    options,
    allowUnsure,
    required,
    dependsOnQuestionKey,
    dependsOnValues
  } = body as {
    key?: string;
    position?: number;
    prompt?: string;
    subtext?: string | null;
    questionType?: string;
    options?: QuestionOption[];
    allowUnsure?: boolean;
    required?: boolean;
    dependsOnQuestionKey?: string | null;
    dependsOnValues?: string[] | null;
  };

  if (!key?.trim() || !prompt?.trim() || position === undefined || !questionType) {
    return NextResponse.json({ error: "key, prompt, position, and questionType are required" }, { status: 400 });
  }
  if (!VALID_TYPES.includes(questionType as QuestionType)) {
    return NextResponse.json({ error: "Invalid questionType" }, { status: 400 });
  }

  try {
    const question = await createQuestion(sectionId, {
      key: key.trim(),
      position,
      prompt: prompt.trim(),
      subtext,
      questionType: questionType as QuestionType,
      options,
      allowUnsure,
      required,
      dependsOnQuestionKey,
      dependsOnValues
    });
    return NextResponse.json({ question });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

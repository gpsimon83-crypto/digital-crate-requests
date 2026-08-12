import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { updateQuestion, deleteQuestion } from "@/lib/data/questionnaires";
import { errorMessage } from "@/lib/error-message";
import type { QuestionType, QuestionOption } from "@/lib/questionnaire-engine";

const VALID_TYPES: QuestionType[] = ["single_select", "multi_select", "short_text", "long_text", "person_list", "song", "time"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ questionId: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { questionId } = await params;
  const body = await req.json();
  const {
    prompt,
    subtext,
    position,
    questionType,
    options,
    allowUnsure,
    required,
    dependsOnQuestionKey,
    dependsOnValues
  } = body as {
    prompt?: string;
    subtext?: string | null;
    position?: number;
    questionType?: string;
    options?: QuestionOption[];
    allowUnsure?: boolean;
    required?: boolean;
    dependsOnQuestionKey?: string | null;
    dependsOnValues?: string[] | null;
  };

  if (questionType !== undefined && !VALID_TYPES.includes(questionType as QuestionType)) {
    return NextResponse.json({ error: "Invalid questionType" }, { status: 400 });
  }

  try {
    const question = await updateQuestion(questionId, {
      prompt,
      subtext,
      position,
      questionType: questionType as QuestionType | undefined,
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

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ questionId: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { questionId } = await params;
  try {
    await deleteQuestion(questionId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

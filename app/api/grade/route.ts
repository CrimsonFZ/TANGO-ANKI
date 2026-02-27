import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyGrade, type Grade } from "@/src/lib/srs";
import { getCurrentUser } from "@/src/lib/auth";

type GradeBody = {
  wordId?: unknown;
  grade?: unknown;
};

const GRADES = new Set<Grade>(["know", "vague", "forgot"]);

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as GradeBody;
  const wordId = Number(body.wordId);
  const grade = body.grade;

  if (!Number.isInteger(wordId) || !GRADES.has(grade as Grade)) {
    return NextResponse.json({ error: "Invalid payload. Expected: { wordId: number, grade: 'know'|'vague'|'forgot' }" }, { status: 400 });
  }

  const word = await prisma.word.findUnique({
    where: { wordId },
    select: { wordId: true },
  });

  if (!word) {
    return NextResponse.json({ error: "Word not found" }, { status: 404 });
  }

  const now = new Date();
  const progress = await prisma.userProgress.upsert({
    where: { userId_wordId: { userId: user.id, wordId } },
    update: {},
    create: { userId: user.id, wordId },
  });

  const result = applyGrade(progress.stage, grade as Grade, now);
  const updated = await prisma.userProgress.update({
    where: { userId_wordId: { userId: user.id, wordId } },
    data: {
      stage: result.stage,
      nextReviewAt: result.nextReviewAt,
      lastReviewedAt: now,
    },
  });

  return NextResponse.json({
    wordId,
    grade,
    progress: updated,
  });
}


import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clampStage, scheduleByStage } from "@/src/lib/srs";
import { getCurrentUser } from "@/src/lib/auth";

type RollbackBody = {
  wordId?: unknown;
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as RollbackBody;
  const wordId = Number(body.wordId);

  if (!Number.isInteger(wordId)) {
    return NextResponse.json({ error: "Invalid payload. Expected: { wordId: number }" }, { status: 400 });
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

  const nextStage = clampStage(progress.stage - 1);
  const nextReviewAt = scheduleByStage(nextStage, now);

  const updated = await prisma.userProgress.update({
    where: { userId_wordId: { userId: user.id, wordId } },
    data: {
      stage: nextStage,
      nextReviewAt,
      lastReviewedAt: now,
    },
  });

  return NextResponse.json({
    wordId,
    progress: updated,
  });
}


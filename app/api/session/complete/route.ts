import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/src/lib/auth";
import { clampStage, getDelayMinutesForStage } from "@/src/lib/srs";

type Body = {
  sessionId?: unknown;
  wordIds?: unknown;
  totalMs?: unknown;
};

type TxClient = Parameters<typeof prisma.$transaction>[0] extends (tx: infer T) => any ? T : never;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as Body;
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  const totalMs = Number(body.totalMs);
  const wordIds = Array.isArray(body.wordIds)
    ? body.wordIds.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0)
    : [];

  if (!sessionId || !Number.isInteger(totalMs) || totalMs < 0) {
    return NextResponse.json({ error: "Invalid payload. Expected: { sessionId, wordIds: number[], totalMs }" }, { status: 400 });
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { id: true, userId: true, mode: true },
  });
  if (!session || session.userId !== user.id) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const uniqueWordIds = Array.from(new Set(wordIds));
  const perWordMs = uniqueWordIds.length > 0 ? Math.floor(totalMs / uniqueWordIds.length) : 0;
  const now = new Date();
  let touchedWords = 0;

  await prisma.$transaction(async (tx: TxClient) => {
    await tx.session.update({
      where: { id: sessionId },
      data: {
        endedAt: now,
        totalMs,
      },
    });

    if (!uniqueWordIds.length) {
      return;
    }

    if (session.mode === "study") {
      for (const wordId of uniqueWordIds) {
        const progress = await tx.userProgress.upsert({
          where: { userId_wordId: { userId: user.id, wordId } },
          update: {},
          create: { userId: user.id, wordId },
        });

        if (!progress.learnedAt) {
          const nextStage = Math.max(clampStage(progress.stage), 1);
          const delayMinutes = Math.max(getDelayMinutesForStage(nextStage), 30);
          const nextReviewAt = new Date(now.getTime() + delayMinutes * 60 * 1000);

          await tx.userProgress.update({
            where: { userId_wordId: { userId: user.id, wordId } },
            data: {
              learnedAt: now,
              stage: nextStage,
              nextReviewAt,
            },
          });
          touchedWords += 1;
        }
      }
    }

    if (perWordMs > 0) {
      await tx.userProgress.updateMany({
        where: {
          userId: user.id,
          wordId: { in: uniqueWordIds },
        },
        data: {
          totalStudyMs: { increment: perWordMs },
        },
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    console.debug("[session-complete]", { sessionId, mode: session.mode, updatedWordCount: touchedWords });
  }

  return NextResponse.json({
    ok: true,
    sessionId,
    totalMs,
    perWordMs,
    updatedWords: uniqueWordIds.length,
  });
}

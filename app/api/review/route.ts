import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseLevel, parseLimit } from "@/src/lib/api";
import { getCurrentUser } from "@/src/lib/auth";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const level = parseLevel(searchParams.get("level"));
  const limit = parseLimit(searchParams.get("limit"), 10);

  if (!level) {
    return NextResponse.json({ error: "Invalid level. Use one of: n1, n2, n3, n5n4" }, { status: 400 });
  }

  const now = new Date();
  const dueProgress = await prisma.userProgress.findMany({
    where: {
      userId: user.id,
      mastered: false,
      nextReviewAt: {
        lte: now,
      },
    },
    orderBy: [{ nextReviewAt: "asc" }, { id: "asc" }],
    take: limit * 3,
  });

  const dueWordIds = Array.from(new Set(dueProgress.map((item) => item.wordId)));
  const wordsById = dueWordIds.length
    ? await prisma.word.findMany({
        where: {
          wordId: { in: dueWordIds },
          bookLevel: level,
        },
      })
    : [];
  const wordMap = new Map(wordsById.map((word) => [word.wordId, word]));

  const words = dueProgress
    .map((item) => {
      const word = wordMap.get(item.wordId);
      if (!word) return null;
      return {
        id: word.id,
        wordId: word.wordId,
        bookLevel: word.bookLevel,
        themeName: word.themeName,
        wordName: word.wordName,
        correctDesc: word.correctDesc,
        wordDesc: word.wordDesc,
        kanaReading: word.kanaReading,
        isKanaOnly: word.isKanaOnly,
        exampleJa: word.exampleJa,
        exampleZh: word.exampleZh,
        createdAt: word.createdAt,
        progress: {
          id: item.id,
          userId: item.userId,
          wordId: item.wordId,
          stage: item.stage,
          learnedAt: item.learnedAt,
          totalStudyMs: item.totalStudyMs,
          nextReviewAt: item.nextReviewAt,
          lastReviewedAt: item.lastReviewedAt,
          wrongTestCount: item.wrongTestCount,
          mastered: item.mastered,
          starred: item.starred,
          updatedAt: item.updatedAt,
        },
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, limit);

  return NextResponse.json({ level, limit, now, words });
}


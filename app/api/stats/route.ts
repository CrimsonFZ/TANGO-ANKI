import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseLevel } from "@/src/lib/api";
import { getCurrentUser } from "@/src/lib/auth";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const level = parseLevel(searchParams.get("level"));

  if (!level) {
    return NextResponse.json({ error: "Invalid level. Use one of: n1, n2, n3, n5n4" }, { status: 400 });
  }

  const now = new Date();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [studyRemaining, reviewDue, learnedTotal, todayLearned, mastered, total] = await Promise.all([
    prisma.word.count({
      where: {
        bookLevel: level,
        OR: [
          { userProgresses: { none: { userId: user.id } } },
          { userProgresses: { some: { userId: user.id, learnedAt: null, mastered: false } } },
        ],
      },
    }),
    prisma.word.count({
      where: {
        bookLevel: level,
        userProgresses: {
          some: {
            userId: user.id,
            mastered: false,
            nextReviewAt: { lte: now },
          },
        },
      },
    }),
    prisma.word.count({
      where: {
        bookLevel: level,
        userProgresses: {
          some: {
            userId: user.id,
            learnedAt: { not: null },
          },
        },
      },
    }),
    prisma.word.count({
      where: {
        bookLevel: level,
        userProgresses: {
          some: {
            userId: user.id,
            learnedAt: { gte: todayStart },
          },
        },
      },
    }),
    prisma.word.count({
      where: {
        bookLevel: level,
        userProgresses: {
          some: {
            userId: user.id,
            mastered: true,
          },
        },
      },
    }),
    prisma.word.count({
      where: {
        bookLevel: level,
      },
    }),
  ]);

  return NextResponse.json({
    level,
    studyRemaining,
    reviewDue,
    learnedTotal,
    todayLearned,
    mastered,
    total,
  });
}


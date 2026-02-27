import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseLevel } from "@/src/lib/api";
import { getCurrentUser } from "@/src/lib/auth";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const bookLevel = parseLevel(searchParams.get("bookLevel"));
  if (!bookLevel) {
    return NextResponse.json({ error: "Invalid bookLevel. Use one of: n1, n2, n3, n5n4" }, { status: 400 });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [learnedTotal, masteredTotal, totalWords, todayLearned, todayReview, studyRemaining, reviewDue, totalStudyAgg, todayStudyAgg] = await Promise.all([
    prisma.userProgress.count({
      where: {
        userId: user.id,
        learnedAt: { not: null },
        word: { bookLevel },
      },
    }),
    prisma.userProgress.count({
      where: {
        userId: user.id,
        mastered: true,
        word: { bookLevel },
      },
    }),
    prisma.word.count({
      where: { bookLevel },
    }),
    prisma.userProgress.count({
      where: {
        userId: user.id,
        learnedAt: { gte: todayStart },
        word: { bookLevel },
      },
    }),
    prisma.studyEvent.count({
      where: {
        userId: user.id,
        type: "review_grade",
        createdAt: { gte: todayStart },
        session: { bookLevel },
      },
    }),
    prisma.word.count({
      where: {
        bookLevel,
        OR: [
          { userProgresses: { none: { userId: user.id } } },
          { userProgresses: { some: { userId: user.id, learnedAt: null, mastered: false } } },
        ],
      },
    }),
    prisma.userProgress.count({
      where: {
        userId: user.id,
        mastered: false,
        nextReviewAt: { lte: new Date() },
        word: { bookLevel },
      },
    }),
    prisma.session.aggregate({
      _sum: { totalMs: true },
      where: {
        userId: user.id,
        bookLevel,
      },
    }),
    prisma.session.aggregate({
      _sum: { totalMs: true },
      where: {
        userId: user.id,
        bookLevel,
        endedAt: { gte: todayStart },
      },
    }),
  ]);

  return NextResponse.json({
    bookLevel,
    learnedTotal,
    masteredTotal,
    totalWords,
    todayLearned,
    todayReview,
    studyRemaining,
    reviewDue,
    totalStudyMs: totalStudyAgg._sum.totalMs ?? 0,
    todayStudyMs: todayStudyAgg._sum.totalMs ?? 0,
  });
}


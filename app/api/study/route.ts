import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseLevel, parseLimit } from "@/src/lib/api";
import { getCurrentUser } from "@/src/lib/auth";

export async function GET(request: Request) {
  try {
    console.log("study prisma?", !!prisma);
    console.log("study prisma.word?", prisma && (prisma as any).word);
    console.log("study prisma.userProgress?", prisma && (prisma as any).userProgress);
    console.log("study keys", prisma ? Object.keys(prisma as any).slice(0, 10) : null);

    if (!(prisma as any).word) {
      return NextResponse.json({ error: "prisma.word undefined" }, { status: 500 });
    }
    if (!(prisma as any).userProgress) {
      return NextResponse.json({ error: "prisma.userProgress undefined" }, { status: 500 });
    }

    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const level = parseLevel(searchParams.get("level"));
    const limit = parseLimit(searchParams.get("limit"), 10);

    if (!level) {
      return NextResponse.json({ error: "Invalid level. Use one of: n1, n2, n3, n5n4" }, { status: 400 });
    }

    const candidates = await prisma.word.findMany({
      where: {
        bookLevel: level,
      },
      orderBy: { wordId: "asc" },
      take: 300,
    });
    const candidateWordIds = candidates.map((word) => word.wordId);

    const existing = candidateWordIds.length
      ? await prisma.userProgress.findMany({
          where: {
            userId: user.id,
            wordId: { in: candidateWordIds },
          },
        })
      : [];
    const progressMap = new Map(existing.map((item) => [item.wordId, item]));

    const words = candidates
      .filter((word) => {
        const progress = progressMap.get(word.wordId);
        if (!progress) return true;
        return !progress.learnedAt && !progress.mastered;
      })
      .slice(0, limit);

    const missingProgressRows = words
      .filter((word) => !progressMap.has(word.wordId))
      .map((word) => ({
        userId: user.id,
        wordId: word.wordId,
      }));
    if (missingProgressRows.length) {
      try {
        await prisma.userProgress.createMany({
          data: missingProgressRows,
        });
      } catch (error) {
        // Ignore concurrent duplicate inserts on unique(userId, wordId)
        if (process.env.NODE_ENV !== "production") {
          console.warn("[api-study] createMany skipped due concurrent conflict", error);
        }
      }
    }

    if (process.env.NODE_ENV !== "production") {
      console.debug("[api-study]", {
        level,
        firstWordIds: words.slice(0, 10).map((w) => w.wordId),
      });
    }

    return NextResponse.json({ level, limit, words });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json(
        {
          error: "Study API failed",
          detail: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}


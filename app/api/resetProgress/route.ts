import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseLevel } from "@/src/lib/api";
import { getCurrentUser } from "@/src/lib/auth";

type Body = {
  level?: unknown;
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as Body;
  const level = parseLevel(typeof body.level === "string" ? body.level : null);

  if (!level) {
    return NextResponse.json({ error: "Invalid payload. Expected: { level: 'n1'|'n2'|'n3'|'n5n4' }" }, { status: 400 });
  }

  const updated = await prisma.userProgress.updateMany({
    where: {
      userId: user.id,
      word: {
        bookLevel: level,
      },
    },
    data: {
      stage: 0,
      nextReviewAt: null,
      lastReviewedAt: null,
      wrongTestCount: 0,
      mastered: false,
      starred: false,
    },
  });

  return NextResponse.json({
    level,
    resetCount: updated.count,
  });
}


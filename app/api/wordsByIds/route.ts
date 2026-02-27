import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/src/lib/auth";

type Body = {
  wordIds?: unknown;
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as Body;
  const rawIds = Array.isArray(body.wordIds) ? body.wordIds : [];
  const wordIds = rawIds
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);

  if (!wordIds.length) {
    return NextResponse.json({ error: "Invalid payload. Expected: { wordIds: number[] }" }, { status: 400 });
  }

  const uniqueIds = Array.from(new Set(wordIds)).slice(0, 200);
  const words = await prisma.word.findMany({
    where: { wordId: { in: uniqueIds } },
    select: {
      wordId: true,
      wordName: true,
      kanaReading: true,
      isKanaOnly: true,
      correctDesc: true,
      wordDesc: true,
    },
  });

  const order = new Map(uniqueIds.map((id, idx) => [id, idx]));
  words.sort((a, b) => (order.get(a.wordId) ?? 0) - (order.get(b.wordId) ?? 0));

  return NextResponse.json({ words });
}


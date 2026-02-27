import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/src/lib/auth";

type Body = {
  wordId?: unknown;
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as Body;
  const wordId = Number(body.wordId);

  if (!Number.isInteger(wordId) || wordId <= 0) {
    return NextResponse.json({ error: "Invalid payload. Expected: { wordId: number }" }, { status: 400 });
  }

  const word = await prisma.word.findUnique({
    where: { wordId },
    select: {
      wordId: true,
      wordName: true,
      exampleJa: true,
      exampleZh: true,
    },
  });

  if (!word) {
    return NextResponse.json({ error: "Word not found" }, { status: 404 });
  }

  if (word.exampleJa && word.exampleZh) {
    return NextResponse.json({
      wordId: word.wordId,
      exampleJa: word.exampleJa,
      exampleZh: word.exampleZh,
      generated: false,
    });
  }

  // TODO(OpenAI): Replace mock generation with an OpenAI call.
  // 1) Prompt model to output one natural Japanese sentence containing word.wordName.
  // 2) Ask for one concise Chinese translation.
  // 3) Validate non-empty output before saving.
  const mockExampleJa = `私は「${word.wordName}」を使って文を作りました。`;
  const mockExampleZh = `我用「${word.wordName}」造了一个句子。`;

  const updated = await prisma.word.update({
    where: { wordId },
    data: {
      exampleJa: word.exampleJa ?? mockExampleJa,
      exampleZh: word.exampleZh ?? mockExampleZh,
    },
    select: {
      wordId: true,
      exampleJa: true,
      exampleZh: true,
    },
  });

  return NextResponse.json({
    wordId: updated.wordId,
    exampleJa: updated.exampleJa,
    exampleZh: updated.exampleZh,
    generated: true,
  });
}


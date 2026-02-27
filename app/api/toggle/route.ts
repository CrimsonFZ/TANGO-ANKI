import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/src/lib/auth";

type ToggleField = "starred" | "mastered";

type ToggleBody = {
  wordId?: unknown;
  field?: unknown;
};

const TOGGLE_FIELDS = new Set<ToggleField>(["starred", "mastered"]);

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as ToggleBody;
  const wordId = Number(body.wordId);
  const field = body.field as ToggleField;

  if (!Number.isInteger(wordId) || !TOGGLE_FIELDS.has(field)) {
    return NextResponse.json({ error: "Invalid payload. Expected: { wordId: number, field: 'starred'|'mastered' }" }, { status: 400 });
  }

  const word = await prisma.word.findUnique({
    where: { wordId },
    select: { wordId: true },
  });

  if (!word) {
    return NextResponse.json({ error: "Word not found" }, { status: 404 });
  }

  const progress = await prisma.userProgress.upsert({
    where: { userId_wordId: { userId: user.id, wordId } },
    update: {},
    create: { userId: user.id, wordId },
  });

  const nextValue = !progress[field];
  const updated = await prisma.userProgress.update({
    where: { userId_wordId: { userId: user.id, wordId } },
    data: {
      [field]: nextValue,
    },
  });

  return NextResponse.json({
    wordId,
    field,
    value: updated[field],
    progress: updated,
  });
}


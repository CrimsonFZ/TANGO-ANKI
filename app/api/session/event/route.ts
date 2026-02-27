import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/src/lib/auth";

type Body = {
  sessionId?: unknown;
  wordId?: unknown;
  type?: unknown;
  grade?: unknown;
  deltaMs?: unknown;
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as Body;
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  const eventType = typeof body.type === "string" ? body.type.trim() : "";
  const grade = typeof body.grade === "string" ? body.grade : null;
  const deltaMs = Number(body.deltaMs);
  const rawWordId = body.wordId;
  const wordId = rawWordId === undefined || rawWordId === null ? null : Number(rawWordId);

  if (!sessionId || !eventType || !Number.isInteger(deltaMs) || deltaMs < 0) {
    return NextResponse.json({ error: "Invalid payload. Expected: { sessionId, wordId?, type, grade?, deltaMs }" }, { status: 400 });
  }
  if (wordId !== null && (!Number.isInteger(wordId) || wordId <= 0)) {
    return NextResponse.json({ error: "Invalid wordId" }, { status: 400 });
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { id: true, userId: true },
  });
  if (!session || session.userId !== user.id) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const event = await prisma.studyEvent.create({
    data: {
      userId: user.id,
      sessionId,
      wordId,
      type: eventType,
      grade,
      deltaMs,
    },
    select: { id: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, eventId: event.id, createdAt: event.createdAt });
}


import { NextResponse } from "next/server";
import { type SessionMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseLevel } from "@/src/lib/api";
import { getCurrentUser } from "@/src/lib/auth";

type Body = {
  mode?: unknown;
  bookLevel?: unknown;
};

const MODES = new Set<SessionMode>(["study", "review"]);

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as Body;
  const mode = typeof body.mode === "string" ? (body.mode as SessionMode) : null;
  const bookLevel = parseLevel(typeof body.bookLevel === "string" ? body.bookLevel : null);

  if (!mode || !MODES.has(mode) || !bookLevel) {
    return NextResponse.json({ error: "Invalid payload. Expected: { mode: 'study'|'review', bookLevel: 'n1'|'n2'|'n3'|'n5n4' }" }, { status: 400 });
  }

  const startedAt = new Date();
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      mode,
      bookLevel,
      startedAt,
    },
    select: { id: true, startedAt: true },
  });

  return NextResponse.json({
    sessionId: session.id,
    serverTime: session.startedAt,
  });
}


import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, setSessionCookie } from "@/src/lib/auth";

type Body = {
  username?: unknown;
  password?: unknown;
};

type TxClient = Parameters<typeof prisma.$transaction>[0] extends (tx: infer T) => any ? T : never;

export async function POST(request: Request) {
  const body = (await request.json()) as Body;
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (username.length < 3 || password.length < 8) {
    return NextResponse.json({ error: "Username must be >= 3 chars and password >= 8 chars" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ error: "Username already exists" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.$transaction(async (tx: TxClient) => {
    const created = await tx.user.create({
      data: { username, passwordHash },
      select: { id: true, username: true, createdAt: true },
    });
    await tx.wallet.create({
      data: { userId: created.id },
    });
    return created;
  });

  await setSessionCookie(user.id);
  return NextResponse.json({ user });
}

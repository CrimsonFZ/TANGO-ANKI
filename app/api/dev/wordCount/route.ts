import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseLevel } from "@/src/lib/api";

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const level = parseLevel(searchParams.get("level"));
  if (!level) {
    return NextResponse.json({ error: "Invalid level. Use one of: n1, n2, n3, n5n4" }, { status: 400 });
  }

  const totalWords = await prisma.word.count({
    where: { bookLevel: level },
  });

  return NextResponse.json({ totalWords });
}


import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  try {
    const prismaAny = prisma as unknown as Record<string, unknown>;
    const modelDelegates = Object.keys(prisma).filter((key) => {
      const delegate = prismaAny[key] as { findMany?: unknown } | undefined;
      return typeof delegate?.findMany === "function";
    });
    return NextResponse.json({ ok: true, models: modelDelegates });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import type { Checkin } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/src/lib/auth";
import { getDateKey } from "@/src/lib/coins";

function parseMonth(month: string): { year: number; mon: number } | null {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const [y, m] = month.split("-").map((x: string) => Number.parseInt(x, 10));
  if (!y || !m || m < 1 || m > 12) return null;
  return { year: y, mon: m };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  if (!month) return NextResponse.json({ error: "Missing month. Expected YYYY-MM" }, { status: 400 });

  const parsed = parseMonth(month);
  if (!parsed) return NextResponse.json({ error: "Invalid month. Expected YYYY-MM" }, { status: 400 });

  const start = new Date(parsed.year, parsed.mon - 1, 1);
  const end = new Date(parsed.year, parsed.mon, 0);
  const startKey = getDateKey(start);
  const endKey = getDateKey(end);

  const checkins = await prisma.checkin.findMany({
    where: {
      userId: user.id,
      dateKey: { gte: startKey, lte: endKey },
    },
  });

  const checkinMap = new Map(checkins.map((item: Checkin) => [item.dateKey, item]));
  const daysInMonth = end.getDate();
  const items = Array.from({ length: daysInMonth }).map((_: unknown, idx: number) => {
    const date = new Date(parsed.year, parsed.mon - 1, idx + 1);
    const dateKey = getDateKey(date);
    const hit = checkinMap.get(dateKey);
    return {
      dateKey,
      checkedIn: Boolean(hit),
      gotCoins: hit?.coins ?? 0,
    };
  });

  return NextResponse.json({ month, items });
}

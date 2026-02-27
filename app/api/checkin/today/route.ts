import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/src/lib/auth";
import { getDateKey, getWeekStartDateKey, weeklyRewardTable } from "@/src/lib/coins";

export const dynamic = "force-dynamic";

function jsonNoStore(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, {
    status: init?.status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonNoStore({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const dateKey = getDateKey(now);
  const weekStartKey = getWeekStartDateKey(dateKey);

  const [existing, weekCheckins] = await Promise.all([
    prisma.checkin.findUnique({
      where: { userId_dateKey: { userId: user.id, dateKey } },
      select: { coins: true },
    }),
    prisma.checkin.findMany({
      where: {
        userId: user.id,
        dateKey: {
          gte: weekStartKey,
          lte: dateKey,
        },
      },
      select: { dateKey: true },
    }),
  ]);

  const completed = new Set(weekCheckins.map((item) => item.dateKey)).size;
  const k = Math.min(7, existing ? completed : completed + 1);
  const plannedCoins = weeklyRewardTable[k as keyof typeof weeklyRewardTable] ?? weeklyRewardTable[7];

  return jsonNoStore({
    dateKey,
    checkedInToday: Boolean(existing),
    todayCoinsPlanned: plannedCoins,
    todayCoins: existing?.coins ?? plannedCoins,
  });
}


import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/src/lib/auth";
import { getDateKey, getWeekStartDateKey, weeklyRewardTable } from "@/src/lib/coins";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();
  const todayKey = getDateKey(today);
  const weekStartKey = getWeekStartDateKey(todayKey);

  const [weekCheckins, recentCheckins, checkedToday] = await Promise.all([
    prisma.checkin.findMany({
      where: {
        userId: user.id,
        dateKey: { gte: weekStartKey, lte: todayKey },
      },
      select: { dateKey: true },
    }),
    prisma.checkin.findMany({
      where: {
        userId: user.id,
        dateKey: { lte: todayKey },
      },
      select: { dateKey: true },
      orderBy: { dateKey: "desc" },
      take: 400,
    }),
    prisma.checkin.findUnique({
      where: { userId_dateKey: { userId: user.id, dateKey: todayKey } },
      select: { id: true },
    }),
  ]);

  const weekSet = new Set(weekCheckins.map((x) => x.dateKey));
  const recentSet = new Set(recentCheckins.map((x) => x.dateKey));

  let streak = 0;
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  while (recentSet.has(getDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const thisWeekChecked = weekSet.size;
  const nextK = Math.min(7, thisWeekChecked + 1);
  const plannedToday = checkedToday ? 0 : (weeklyRewardTable[nextK as keyof typeof weeklyRewardTable] ?? weeklyRewardTable[7]);

  return NextResponse.json({
    currentStreakDays: streak,
    thisWeekChecked,
    nextPlannedCoinsToday: checkedToday ? 0 : plannedToday,
  });
}


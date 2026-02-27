import { prisma } from "@/lib/prisma";

export const weeklyRewardTable = {
  1: 10,
  2: 12,
  3: 14,
  4: 16,
  5: 18,
  6: 20,
  7: 22,
} as const;

export const weeklyFullBonus = 50;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function getDateKey(date: Date, _tz?: string): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function getWeekdayMon1(date: Date): number {
  const day = date.getDay(); // Sun=0..Sat=6
  return day === 0 ? 7 : day; // Mon=1..Sun=7
}

function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map((x) => Number.parseInt(x, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

export function getWeekStartDateKey(dateKey: string): string {
  const date = parseDateKey(dateKey);
  const weekday = getWeekdayMon1(date);
  const monday = new Date(date);
  monday.setDate(date.getDate() - (weekday - 1));
  return getDateKey(monday);
}

export async function canGrantWeeklyBonus(userId: number, weekStartKey: string): Promise<boolean> {
  const monday = parseDateKey(weekStartKey);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const days = await prisma.checkin.findMany({
    where: {
      userId,
      dateKey: {
        gte: getDateKey(monday),
        lte: getDateKey(sunday),
      },
    },
    select: { dateKey: true },
  });
  const distinctDayCount = new Set(days.map((item) => item.dateKey)).size;

  if (distinctDayCount < 7) return false;

  const existingBonus = await prisma.coinLedger.findFirst({
    where: {
      userId,
      dateKey: weekStartKey,
      type: "weekly_bonus",
    },
    select: { id: true },
  });

  return !existingBonus;
}


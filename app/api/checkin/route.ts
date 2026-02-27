import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/src/lib/auth";
import { getDateKey, getWeekStartDateKey, getWeekdayMon1, weeklyFullBonus, weeklyRewardTable } from "@/src/lib/coins";

export const dynamic = "force-dynamic";

type TxClient = Parameters<typeof prisma.$transaction>[0] extends (tx: infer T) => any ? T : never;

function jsonNoStore(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, {
    status: init?.status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return jsonNoStore({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const dateKey = getDateKey(now);
  const weekday = getWeekdayMon1(now);
  const weekStartKey = getWeekStartDateKey(dateKey);

  const result = await prisma.$transaction(async (tx: TxClient) => {
    const wallet = await tx.wallet.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
      select: { ankiBalance: true },
    });

    const existing = await tx.checkin.findUnique({
      where: { userId_dateKey: { userId: user.id, dateKey } },
      select: { coins: true },
    });

    if (existing) {
      const weekCheckins = await tx.checkin.findMany({
        where: {
          userId: user.id,
          dateKey: {
            gte: weekStartKey,
            lte: dateKey,
          },
        },
        select: { dateKey: true },
      });
      const thisWeekChecked = new Set(weekCheckins.map((item) => item.dateKey)).size;
      return {
        already: true,
        dateKey,
        todayCoins: existing.coins,
        weeklyBonusGranted: false,
        weeklyBonus: 0,
        balance: wallet.ankiBalance,
        thisWeekChecked,
      };
    }

    const weekCheckinsBefore = await tx.checkin.findMany({
      where: {
        userId: user.id,
        dateKey: {
          gte: weekStartKey,
          lte: dateKey,
        },
      },
      select: { dateKey: true },
    });
    const completed = new Set(weekCheckinsBefore.map((item) => item.dateKey)).size;
    const k = Math.min(7, completed + 1);
    const todayCoins = weeklyRewardTable[k as keyof typeof weeklyRewardTable] ?? weeklyRewardTable[7];

    await tx.checkin.create({
      data: {
        userId: user.id,
        dateKey,
        weekday,
        coins: todayCoins,
      },
    });

    let balance = wallet.ankiBalance + todayCoins;
    await tx.wallet.update({
      where: { userId: user.id },
      data: { ankiBalance: balance },
    });

    await tx.coinLedger.create({
      data: {
        userId: user.id,
        dateKey,
        type: "checkin",
        delta: todayCoins,
        balanceAfter: balance,
      },
    });

    const thisWeekChecked = Math.min(7, completed + 1);
    let weeklyBonusGranted = false;
    let weeklyBonus = 0;

    if (thisWeekChecked === 7) {
      const existingBonus = await tx.coinLedger.findFirst({
        where: {
          userId: user.id,
          dateKey: weekStartKey,
          type: "weekly_bonus",
        },
        select: { id: true },
      });

      if (!existingBonus) {
        balance += weeklyFullBonus;
        weeklyBonusGranted = true;
        weeklyBonus = weeklyFullBonus;
        await tx.wallet.update({
          where: { userId: user.id },
          data: { ankiBalance: balance },
        });
        await tx.coinLedger.create({
          data: {
            userId: user.id,
            dateKey: weekStartKey,
            type: "weekly_bonus",
            delta: weeklyFullBonus,
            balanceAfter: balance,
          },
        });
      }
    }

    return {
      already: false,
      dateKey,
      todayCoins,
      weeklyBonusGranted,
      weeklyBonus,
      balance,
      thisWeekChecked,
    };
  });

  return jsonNoStore(result);
}

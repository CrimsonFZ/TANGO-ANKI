"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  getBackgroundPrefStorageKey,
  parseBackgroundPref,
  resolveBackgroundFromPref,
} from "@/src/lib/backgrounds";
import { fetchCurrentUserNoStore, normalizeClientLevel, scopedStorageKey } from "@/src/lib/client-user";
import { useToast } from "@/src/components/toast-provider";

type StatsResponse = {
  studyRemaining: number;
  reviewDue: number;
};

type WalletResponse = {
  balance: number;
};

type TodayCheckinResponse = {
  dateKey: string;
  checkedInToday: boolean;
  todayCoinsPlanned: number;
  todayCoins: number;
};

type CheckinResponse = {
  already: boolean;
  dateKey: string;
  balance: number;
  todayCoins: number;
  weeklyBonusGranted: boolean;
  weeklyBonus: number;
};

const DEFAULT_LEVEL = "n1";

export default function Home() {
  const router = useRouter();
  const { showToast } = useToast();
  const [userId, setUserId] = useState<number | null>(null);
  const [stats, setStats] = useState<StatsResponse>({ studyRemaining: 0, reviewDue: 0 });
  const [ankiBalance, setAnkiBalance] = useState(0);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [todayCoinsPlanned, setTodayCoinsPlanned] = useState(10);
  const [todayGotCoins, setTodayGotCoins] = useState(0);
  const [checkingIn, setCheckingIn] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState("/bg/bg1.jpg");

  const checkinCoins = useMemo(
    () => (checkedInToday ? (todayGotCoins || todayCoinsPlanned) : todayCoinsPlanned),
    [checkedInToday, todayGotCoins, todayCoinsPlanned],
  );

  function applyBackgroundPref(targetUserId: number) {
    const prefRaw = localStorage.getItem(getBackgroundPrefStorageKey(targetUserId));
    const pref = parseBackgroundPref(prefRaw);
    setBackgroundImage(resolveBackgroundFromPref(targetUserId, pref));
  }

  async function loadHomeData() {
    const currentUser = await fetchCurrentUserNoStore();
    if (!currentUser) {
      router.replace("/auth/login");
      return;
    }
    setUserId(currentUser.id);
    applyBackgroundPref(currentUser.id);
    const selectedLevel = normalizeClientLevel(localStorage.getItem(scopedStorageKey(currentUser.id, "selectedLevel")) ?? DEFAULT_LEVEL);

    const [statsResp, walletResp, todayResp] = await Promise.all([
      fetch(`/api/me/stats?bookLevel=${encodeURIComponent(selectedLevel)}`, { cache: "no-store" }),
      fetch("/api/wallet", { cache: "no-store" }),
      fetch("/api/checkin/today", { cache: "no-store" }),
    ]);

    if (statsResp.ok) {
      const statsData = (await statsResp.json()) as Partial<StatsResponse>;
      setStats({
        studyRemaining: statsData.studyRemaining ?? 0,
        reviewDue: statsData.reviewDue ?? 0,
      });
    }

    if (walletResp.ok) {
      const walletData = (await walletResp.json()) as Partial<WalletResponse>;
      setAnkiBalance(walletData.balance ?? 0);
    }

    if (todayResp.ok) {
      const todayData = (await todayResp.json()) as Partial<TodayCheckinResponse>;
      setCheckedInToday(Boolean(todayData.checkedInToday));
      setTodayCoinsPlanned(todayData.todayCoinsPlanned ?? 10);
      setTodayGotCoins(todayData.checkedInToday ? (todayData.todayCoins ?? 0) : 0);
    }
  }

  useEffect(() => {
    function onVisibleOrFocus() {
      loadHomeData().catch(() => undefined);
    }

    function onBackgroundPrefChanged() {
      if (!userId) return;
      applyBackgroundPref(userId);
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        onVisibleOrFocus();
      }
    }

    onVisibleOrFocus();
    window.addEventListener("focus", onVisibleOrFocus);
    window.addEventListener("storage", onBackgroundPrefChanged);
    window.addEventListener("bg-pref-changed", onBackgroundPrefChanged);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onVisibleOrFocus);
      window.removeEventListener("storage", onBackgroundPrefChanged);
      window.removeEventListener("bg-pref-changed", onBackgroundPrefChanged);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [userId]);

  async function onCheckin() {
    if (checkedInToday || checkingIn) return;
    setCheckingIn(true);
    try {
      const response = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });
      if (!response.ok) {
        showToast("签到失败，请稍后重试", "error");
        return;
      }

      const data = (await response.json()) as CheckinResponse;
      if (process.env.NODE_ENV !== "production") {
        console.log("checkin resp", data);
      }
      const coins = data.todayCoins ?? 0;
      if (coins > 0 || data.already) {
        setCheckedInToday(true);
        setTodayGotCoins(coins);
        setTodayCoinsPlanned((prev) => coins || prev);
        setAnkiBalance(data.balance ?? 0);
      }

      const msg = data.weeklyBonusGranted
        ? `获得 anki币 +${coins}，+${data.weeklyBonus} 周满勤奖励`
        : `获得 anki币 +${coins}`;
      showToast(msg, "success");

      loadHomeData().catch(() => undefined);
      router.refresh();
    } catch {
      showToast("签到失败，请稍后重试", "error");
    } finally {
      setCheckingIn(false);
    }
  }

  return (
    <div className="relative -mx-4 -mt-1 min-h-[calc(100svh-13rem)] overflow-hidden rounded-[2rem]">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${backgroundImage}')` }} />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/20 via-slate-950/45 to-slate-950/85" />
      <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-slate-950/55 via-slate-950/20 to-transparent" />
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(2,6,23,0.85)] backdrop-blur-[1.5px]" />

      <div className="relative flex min-h-[calc(100svh-13rem)] flex-col justify-between px-5 py-7">
        <div className="pt-12 text-center">
          <div className="mb-3 flex justify-center">
            <div className="overflow-hidden rounded-2xl ring-1 ring-white/10 shadow-[0_12px_35px_rgba(0,0,0,0.35)]">
              <Image
                src="/LOGO.png"
                alt="TANGO ANKI Logo"
                width={900}
                height={300}
                priority
                className="block h-auto w-[36vw] max-w-[260px]"
              />
            </div>
          </div>
          <h1 className="mt-3 text-4xl font-bold leading-[1.05] tracking-tight [text-shadow:0_2px_14px_rgba(2,6,23,0.52)]">日语背词</h1>
        </div>

        <div className="mb-4 space-y-3">
          <button
            type="button"
            disabled={checkedInToday || checkingIn}
            onClick={onCheckin}
            className="glass-card ui-primary-btn ui-frosted-card block w-full p-4 text-center text-base font-semibold disabled:opacity-60"
          >
            {checkedInToday ? `已签到 +${checkinCoins}` : `签到 +${checkinCoins}`}
          </button>

          <Link href="/study" className="glass-card ui-frosted-card block p-5">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-sm text-white/70">学习</p>
                <h3 className="mt-1 text-2xl font-semibold">开始新词</h3>
              </div>
              <p className="text-right text-sm text-white/80">
                剩余
                <span className="ml-2 text-3xl font-bold text-white">{stats.studyRemaining}</span>
              </p>
            </div>
          </Link>

          <Link href="/review" className="glass-card ui-frosted-card block p-5">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-sm text-white/70">复习</p>
                <h3 className="mt-1 text-2xl font-semibold">处理到期</h3>
              </div>
              <p className="text-right text-sm text-white/80">
                到期
                <span className="ml-2 text-3xl font-bold text-white">{stats.reviewDue}</span>
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { scopedStorageKey } from "@/src/lib/client-user";

type Level = "n1" | "n2" | "n3" | "n5n4";

type MeStatsResponse = {
  learnedTotal: number;
  masteredTotal: number;
  totalWords: number;
  todayLearned: number;
  todayReview: number;
  totalStudyMs: number;
  todayStudyMs: number;
};

type WalletResponse = {
  balance: number;
};

type CalendarItem = {
  dateKey: string;
  checkedIn: boolean;
  gotCoins: number;
};

type CalendarResponse = {
  month: string;
  items: CalendarItem[];
};

type StreakResponse = {
  currentStreakDays: number;
  thisWeekChecked: number;
  nextPlannedCoinsToday: number;
};

type AuthMeResponse = {
  ok: boolean;
  user?: {
    id: number;
    username: string;
  };
};

const LEVELS: Level[] = ["n1", "n2", "n3", "n5n4"];
const DEFAULT_LEVEL: Level = "n1";

const LABELS = {
  currentBook: "当前词书",
  switchBook: "换本词书",
  learned: "已学",
  mastered: "已掌握",
  totalWords: "总词数",
  overview: "概览",
  todayLearned: "今日学习",
  todayReview: "今日复习",
  cumulativeLearned: "累计学习",
  cumulativeTime: "累计时长",
  studyCalendar: "学习日历",
  weeklySigned: "本周已签",
  weeklyBonusHint: "周满勤额外 +50",
  settings: "设置",
  chooseBookLevel: "选择词书等级",
  userFallback: "用户",
  ankiCoin: "anki币",
  minute: "分钟",
  weekdays: ["一", "二", "三", "四", "五", "六", "日"],
} as const;

function normalizeLevel(value: string | null): Level {
  const canonical = (value ?? "").trim().toLowerCase();
  return LEVELS.includes(canonical as Level) ? (canonical as Level) : DEFAULT_LEVEL;
}

function formatStudyTime(ms: number): string {
  const safeMs = Math.max(0, ms || 0);
  const totalMinutes = Math.floor(safeMs / 60000);
  if (totalMinutes < 60) return `${totalMinutes} ${LABELS.minute}`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function getDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map((x) => Number.parseInt(x, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

export default function MePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<number | null>(null);
  const [level, setLevel] = useState<Level>(DEFAULT_LEVEL);
  const [username, setUsername] = useState("");
  const [stats, setStats] = useState<MeStatsResponse>({
    learnedTotal: 0,
    masteredTotal: 0,
    totalWords: 0,
    todayLearned: 0,
    todayReview: 0,
    totalStudyMs: 0,
    todayStudyMs: 0,
  });
  const [balance, setBalance] = useState(0);
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([]);
  const [streakDays, setStreakDays] = useState(0);
  const [thisWeekChecked, setThisWeekChecked] = useState(0);
  const [selectorOpen, setSelectorOpen] = useState(false);

  const now = useMemo(() => new Date(), []);
  const currentMonthKey = useMemo(() => getMonthKey(now), [now]);

  async function loadAll(selectedLevel: Level) {
    const authResp = await fetch("/api/auth/me", { cache: "no-store" });
    if (authResp.status === 401) {
      router.replace("/auth/login");
      return;
    }
    if (authResp.ok) {
      const authData = (await authResp.json()) as AuthMeResponse;
      const authUser = authData.user;
      if (!authUser) return;
      setUsername(authUser.username);
      setUserId(authUser.id);
      const scopedLevel = normalizeLevel(localStorage.getItem(scopedStorageKey(authUser.id, "selectedLevel")));
      if (scopedLevel !== selectedLevel) {
        setLevel(scopedLevel);
      }
      selectedLevel = scopedLevel;
    }

    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthKey = getMonthKey(prevMonthDate);

    const [statsResp, walletResp, calendarResp, prevCalendarResp, streakResp] = await Promise.all([
      fetch(`/api/me/stats?bookLevel=${selectedLevel}`, { cache: "no-store" }),
      fetch("/api/wallet", { cache: "no-store" }),
      fetch(`/api/checkin/calendar?month=${currentMonthKey}`, { cache: "no-store" }),
      fetch(`/api/checkin/calendar?month=${prevMonthKey}`, { cache: "no-store" }),
      fetch("/api/checkin/streak", { cache: "no-store" }),
    ]);

    if (statsResp.ok) {
      const data = (await statsResp.json()) as Partial<MeStatsResponse>;
      setStats({
        learnedTotal: data.learnedTotal ?? 0,
        masteredTotal: data.masteredTotal ?? 0,
        totalWords: data.totalWords ?? 0,
        todayLearned: data.todayLearned ?? 0,
        todayReview: data.todayReview ?? 0,
        totalStudyMs: data.totalStudyMs ?? 0,
        todayStudyMs: data.todayStudyMs ?? 0,
      });
    }

    if (walletResp.ok) {
      const data = (await walletResp.json()) as Partial<WalletResponse>;
      setBalance(data.balance ?? 0);
    }

    const currentCalendar = calendarResp.ok ? ((await calendarResp.json()) as CalendarResponse) : { month: currentMonthKey, items: [] };
    const prevCalendar = prevCalendarResp.ok ? ((await prevCalendarResp.json()) as CalendarResponse) : { month: prevMonthKey, items: [] };
    setCalendarItems(currentCalendar.items ?? []);

    if (streakResp.ok) {
      const streakData = (await streakResp.json()) as Partial<StreakResponse>;
      setStreakDays(streakData.currentStreakDays ?? 0);
      setThisWeekChecked(streakData.thisWeekChecked ?? 0);
    } else {
      const checkedSet = new Set<string>();
      for (const item of [...(prevCalendar.items ?? []), ...(currentCalendar.items ?? [])]) {
        if (item.checkedIn) checkedSet.add(item.dateKey);
      }

      let streak = 0;
      let cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      while (checkedSet.has(getDateKey(cursor))) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      }
      setStreakDays(streak);
    }
  }

  useEffect(() => {
    if (!userId) {
      loadAll(DEFAULT_LEVEL).catch(() => undefined);
      return;
    }
    const saved = normalizeLevel(localStorage.getItem(scopedStorageKey(userId, "selectedLevel")));
    setLevel(saved);
    loadAll(saved).catch(() => undefined);
  }, [currentMonthKey, now, userId]);

  useEffect(() => {
    function onFocusRefresh() {
      if (!userId) {
        loadAll(DEFAULT_LEVEL).catch(() => undefined);
        return;
      }
      const current = normalizeLevel(localStorage.getItem(scopedStorageKey(userId, "selectedLevel")));
      setLevel(current);
      loadAll(current).catch(() => undefined);
    }

    function onVisibilityRefresh() {
      if (document.visibilityState === "visible") {
        onFocusRefresh();
      }
    }

    window.addEventListener("focus", onFocusRefresh);
    document.addEventListener("visibilitychange", onVisibilityRefresh);
    return () => {
      window.removeEventListener("focus", onFocusRefresh);
      document.removeEventListener("visibilitychange", onVisibilityRefresh);
    };
  }, [currentMonthKey, now, userId]);

  function selectLevel(nextLevel: Level) {
    if (userId) {
      localStorage.setItem(scopedStorageKey(userId, "selectedLevel"), nextLevel);
    }
    setLevel(nextLevel);
    setSelectorOpen(false);
    loadAll(nextLevel).catch(() => undefined);
  }

  const firstDayWeekday = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    const jsDay = d.getDay(); // Sun=0..Sat=6
    return jsDay === 0 ? 7 : jsDay;
  }, [now]);

  const leadingBlankCount = firstDayWeekday - 1;
  const avatarInitial = (username || LABELS.userFallback).slice(0, 1).toUpperCase();

  return (
    <div className="me-root space-y-4">
      <section className="glass-card p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/35 bg-white/20 text-sm font-semibold text-white">
              {avatarInitial}
            </div>
            <div>
              <p className="text-sm font-semibold">{username || LABELS.userFallback}</p>
              <p className="text-xs text-white/70">{LABELS.currentBook}</p>
              <h2 className="mt-1 text-xl font-semibold uppercase">{level}</h2>
            </div>
          </div>
          <div className="text-right">
            <p className="rounded-full border border-amber-200/50 bg-amber-300/15 px-3 py-1 text-xs font-medium text-amber-100">
              {LABELS.ankiCoin} {balance}
            </p>
            <button
              type="button"
              onClick={() => setSelectorOpen(true)}
              className="ui-icon-btn mt-2 rounded-2xl border border-white/30 bg-white/20 px-4 py-2 text-sm font-medium"
            >
              {LABELS.switchBook}
            </button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-xs text-white/70">{LABELS.learned}</p>
            <p className="mt-1 text-lg font-semibold">{stats.learnedTotal}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-xs text-white/70">{LABELS.mastered}</p>
            <p className="mt-1 text-lg font-semibold">{stats.masteredTotal}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-xs text-white/70">{LABELS.totalWords}</p>
            <p className="mt-1 text-lg font-semibold">{stats.totalWords}</p>
          </div>
        </div>
      </section>

      <section className="glass-card p-5">
        <p className="text-xs text-white/70">{LABELS.overview}</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-xs text-white/70">{LABELS.todayLearned}</p>
            <p className="mt-1 text-lg font-semibold">{stats.todayLearned}</p>
            <p className="mt-1 text-xs text-white/65">{formatStudyTime(stats.todayStudyMs)}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-xs text-white/70">{LABELS.todayReview}</p>
            <p className="mt-1 text-lg font-semibold">{stats.todayReview}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-xs text-white/70">{LABELS.cumulativeLearned}</p>
            <p className="mt-1 text-lg font-semibold">{stats.learnedTotal}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-xs text-white/70">{LABELS.cumulativeTime}</p>
            <p className="mt-1 text-lg font-semibold">{formatStudyTime(stats.totalStudyMs)}</p>
          </div>
        </div>
      </section>

      <section className="glass-card p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/70">{LABELS.studyCalendar}</p>
          <p className="text-sm">{LABELS.weeklySigned} {thisWeekChecked}/7</p>
        </div>
        <p className="mt-1 text-xs text-amber-100/90">{LABELS.weeklyBonusHint}</p>
        <div className="mt-3 grid grid-cols-7 gap-2 text-center text-[10px] text-white/70">
          {LABELS.weekdays.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-2">
          {Array.from({ length: leadingBlankCount }).map((_, idx) => (
            <div key={`blank-${idx}`} className="h-12 rounded-lg bg-transparent" />
          ))}
          {calendarItems.map((item) => {
            const day = parseDateKey(item.dateKey).getDate();
            return (
              <div
                key={item.dateKey}
                className={`h-12 rounded-lg border p-1 text-center ${
                  item.checkedIn ? "border-emerald-200/60 bg-emerald-300/25" : "border-white/20 bg-white/10"
                }`}
              >
                <p className="text-[11px] font-semibold">{day}</p>
                {item.checkedIn && <p className="text-[10px] text-white/75">+{item.gotCoins}</p>}
                {item.checkedIn && <p className="text-[10px]">OK</p>}
              </div>
            );
          })}
        </div>
      </section>

      <Link href="/me/settings" className="glass-card ui-frosted-card block p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm">{LABELS.settings}</span>
          <span className="ui-icon-btn rounded-full px-2 py-1 text-white/70">&gt;</span>
        </div>
      </Link>

      {selectorOpen && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/45 p-4" onClick={() => setSelectorOpen(false)}>
          <div className="glass-card safe-bottom w-full p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold">{LABELS.chooseBookLevel}</h3>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {LEVELS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => selectLevel(item)}
                  className={`ui-primary-btn rounded-2xl border px-4 py-3 text-sm uppercase transition duration-200 ease-out ${
                    level === item ? "border-white/50 bg-white/30 font-semibold" : "border-white/25 bg-white/10 text-white/85"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BACKGROUNDS,
  type BackgroundPref,
  getBackgroundByIndex,
  getBackgroundPrefStorageKey,
  parseBackgroundPref,
} from "@/src/lib/backgrounds";
import { fetchCurrentUserNoStore, normalizeClientLevel, scopedStorageKey } from "@/src/lib/client-user";
import { useToast } from "@/src/components/toast-provider";

type Level = "n1" | "n2" | "n3" | "n5n4";

const DEFAULT_LEVEL: Level = "n1";
const AUTO_PRONOUNCE_KEY = "autoPronounce";
const SELECTED_LEVEL_KEY = "selectedLevel";

const CLIENT_SESSION_KEYS = [
  "activeStudySession",
  "activeReviewSession",
  "lastStudySessionWordIds",
  "lastReviewSessionWordIds",
] as const;

export default function SettingsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [userId, setUserId] = useState<number | null>(null);
  const [autoPronounce, setAutoPronounce] = useState(true);
  const [level, setLevel] = useState<Level>(DEFAULT_LEVEL);
  const [bgPref, setBgPref] = useState<BackgroundPref>({ mode: "random" });
  const [resetting, setResetting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadSettings() {
      const user = await fetchCurrentUserNoStore();
      if (!user) {
        router.replace("/auth/login");
        return;
      }
      setUserId(user.id);

      const savedAuto = localStorage.getItem(AUTO_PRONOUNCE_KEY);
      if (savedAuto === null) {
        localStorage.setItem(AUTO_PRONOUNCE_KEY, "true");
        setAutoPronounce(true);
      } else {
        setAutoPronounce(savedAuto === "true");
      }

      const savedLevel = normalizeClientLevel(localStorage.getItem(scopedStorageKey(user.id, SELECTED_LEVEL_KEY)));
      setLevel(savedLevel);

      const savedBgPref = parseBackgroundPref(localStorage.getItem(getBackgroundPrefStorageKey(user.id)));
      setBgPref(savedBgPref);
    }

    loadSettings().catch(() => undefined);
  }, []);

  function onToggleAutoPronounce() {
    const next = !autoPronounce;
    setAutoPronounce(next);
    localStorage.setItem(AUTO_PRONOUNCE_KEY, String(next));
  }

  function saveBackgroundPref(next: BackgroundPref) {
    if (!userId) return;
    setBgPref(next);
    localStorage.setItem(getBackgroundPrefStorageKey(userId), JSON.stringify(next));
    window.dispatchEvent(new Event("bg-pref-changed"));
    showToast("主页背景已更新", "success");
    router.refresh();
  }

  function onSelectRandomBackground() {
    saveBackgroundPref({ mode: "random" });
  }

  function onSelectFixedBackground(index: number) {
    saveBackgroundPref({ mode: "fixed", index });
  }

  async function onResetProgress() {
    setResetting(true);
    setMessage("");
    try {
      const response = await fetch("/api/resetProgress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level }),
      });

      if (!response.ok) {
        setMessage("重置失败，请稍后重试");
        return;
      }

      const data = (await response.json()) as { resetCount?: number };
      setMessage(`已重置 ${data.resetCount ?? 0} 条进度`);
    } catch {
      setMessage("重置失败，请稍后重试");
    } finally {
      setResetting(false);
    }
  }

  function clearClientSessionState() {
    if (!userId) return;
    for (const key of CLIENT_SESSION_KEYS) {
      localStorage.removeItem(scopedStorageKey(userId, key));
    }
  }

  async function onLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        cache: "no-store",
      });

      if (!response.ok) {
        showToast("退出登录失败，请稍后重试", "error");
        return;
      }

      clearClientSessionState();
      router.replace("/auth/login");
      router.refresh();
    } catch {
      showToast("退出登录失败，请稍后重试", "error");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="glass-card p-5">
        <h2 className="text-lg font-semibold">学习设置</h2>
        <p className="mt-2 text-sm text-white/75">当前词书：{level.toUpperCase()}</p>
      </section>

      <section className="glass-card p-5">
        <h3 className="text-base font-semibold">主页背景</h3>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onSelectRandomBackground}
            className={`ui-primary-btn rounded-xl border px-3 py-2 text-xs font-semibold transition duration-200 ease-out ${
              bgPref.mode === "random"
                ? "border-emerald-200/80 bg-emerald-300/30 text-emerald-50"
                : "border-white/30 bg-white/10 text-white/85"
            }`}
          >
            随机
          </button>
          <p className="text-xs text-white/70">随机模式按日期固定每天一张</p>
        </div>

        <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {BACKGROUNDS.map((bg, index) => {
            const selected = bgPref.mode === "fixed" && bgPref.index === index;
            return (
              <button
                key={bg}
                type="button"
                onClick={() => onSelectFixedBackground(index)}
                className={`ui-frosted-card ui-primary-btn relative h-16 w-24 shrink-0 overflow-hidden rounded-xl border transition duration-200 ease-out ${
                  selected ? "border-emerald-200 ring-2 ring-emerald-300/70" : "border-white/30"
                }`}
                aria-label={`选择背景 ${index + 1}`}
                title={`背景 ${index + 1}`}
              >
                <img src={getBackgroundByIndex(index)} alt={`背景 ${index + 1}`} className="h-full w-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 bg-black/45 px-1 py-0.5 text-[10px] text-white">{index + 1}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="glass-card p-5">
        <div className="ui-frosted-card flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3">
          <span className="text-sm">自动发音</span>
          <button
            type="button"
            onClick={onToggleAutoPronounce}
            className={`h-7 w-12 rounded-full p-1 transition ${
              autoPronounce ? "bg-emerald-400/90" : "bg-white/30"
            }`}
            aria-pressed={autoPronounce}
          >
            <span
              className={`block h-5 w-5 rounded-full bg-white transition ${
                autoPronounce ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <div className="ui-frosted-card mt-3 flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3">
          <span className="text-sm">每组单词</span>
          <span className="text-sm text-white/85">10</span>
        </div>

        <div className="ui-frosted-card mt-3 flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3">
          <span className="text-sm">背词模式</span>
          <span className="text-sm text-white/85">键盘</span>
        </div>
      </section>

      <section className="glass-card p-5 space-y-3">
        <button
          type="button"
          disabled={resetting}
          onClick={onResetProgress}
          className="w-full rounded-2xl border border-red-300/40 bg-red-400/20 px-4 py-3 text-sm font-semibold text-red-50 disabled:opacity-60"
        >
          {resetting ? "重置中..." : "重置当前词书进度"}
        </button>

        <button
          type="button"
          disabled={loggingOut}
          onClick={onLogout}
          className="w-full rounded-2xl border border-rose-300/45 bg-rose-400/20 px-4 py-3 text-sm font-semibold text-rose-50 backdrop-blur disabled:opacity-60"
        >
          {loggingOut ? "退出中..." : "退出登录"}
        </button>

        {message && <p className="text-sm text-white/85">{message}</p>}
      </section>
    </div>
  );
}

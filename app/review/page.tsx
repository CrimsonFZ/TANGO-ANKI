"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { speakJa } from "@/src/lib/tts";
import { fetchCurrentUserNoStore, normalizeClientLevel, scopedStorageKey } from "@/src/lib/client-user";
import { ZH } from "@/src/lib/labels_zh";

type ReviewWord = {
  wordId: number;
  wordName: string;
  kanaReading: string | null;
  correctDesc: string;
  wordDesc: string;
  exampleJa?: string | null;
  exampleZh?: string | null;
};

type ReviewResponse = {
  words: ReviewWord[];
};

const DEFAULT_LEVEL = "n1";
const SESSION_SIZE = 10;
const REVIEW_SESSION_META_KEY = "activeReviewSession";
type TransitionPhase = "idle" | "leaving" | "entering";

export default function ReviewPage() {
  const router = useRouter();
  const [words, setWords] = useState<ReviewWord[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<"know" | "vague" | "forgot" | null>(null);
  const [autoPronounce, setAutoPronounce] = useState(false);
  const [generatingExample, setGeneratingExample] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transitionPhase, setTransitionPhase] = useState<TransitionPhase>("idle");
  const lastActionRef = useRef(0);
  const transitionTimersRef = useRef<number[]>([]);

  const currentWord = words[index] ?? null;
  const progressLabel = useMemo(() => `${Math.min(index + 1, SESSION_SIZE)}/${SESSION_SIZE}`, [index]);
  const isTransitioning = transitionPhase !== "idle";
  const wordCardTransitionClass =
    transitionPhase === "leaving"
      ? "opacity-0 -translate-y-2"
      : transitionPhase === "entering"
        ? "opacity-0 translate-y-2"
        : "opacity-100 translate-y-0";

  useEffect(() => {
    return () => {
      transitionTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      transitionTimersRef.current = [];
    };
  }, []);

  function transitionToNextWord(nextIndex: number) {
    if (isTransitioning) return;
    setTransitionPhase("leaving");
    const leaveTimer = window.setTimeout(() => {
      setIndex(nextIndex);
      setRevealed(false);
      setSelectedGrade(null);
      setTransitionPhase("entering");
      const enterTimer = window.setTimeout(() => {
        setTransitionPhase("idle");
      }, 20);
      transitionTimersRef.current.push(enterTimer);
    }, 170);
    transitionTimersRef.current.push(leaveTimer);
  }

  useEffect(() => {
    async function loadWords() {
      const user = await fetchCurrentUserNoStore();
      if (!user) {
        router.replace("/auth/login");
        return;
      }
      const selectedLevel = normalizeClientLevel(localStorage.getItem(scopedStorageKey(user.id, "selectedLevel")) ?? DEFAULT_LEVEL);
      const shouldAutoPronounce = localStorage.getItem("autoPronounce") === "true";
      setAutoPronounce(shouldAutoPronounce);
      lastActionRef.current = performance.now();
      setLoading(true);
      const startResp = await fetch("/api/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "review", bookLevel: selectedLevel }),
      });
      if (startResp.ok) {
        const startData = (await startResp.json()) as { sessionId?: string };
        if (startData.sessionId) {
          setSessionId(startData.sessionId);
          localStorage.setItem(
            scopedStorageKey(user.id, REVIEW_SESSION_META_KEY),
            JSON.stringify({ sessionId: startData.sessionId, startedAtMs: Date.now() }),
          );
        }
      }

      const response = await fetch(`/api/review?level=${encodeURIComponent(selectedLevel)}&limit=${SESSION_SIZE}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        setWords([]);
        setLoading(false);
        return;
      }
      const data = (await response.json()) as ReviewResponse;
      setWords(data.words ?? []);
      setLoading(false);
    }

    loadWords().catch(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!currentWord) return;
    router.replace(`/review?i=${index + 1}&total=${SESSION_SIZE}&wordId=${currentWord.wordId}`, { scroll: false });
    if (autoPronounce) {
      speakJa(currentWord.wordName);
    }
  }, [autoPronounce, currentWord, index, router]);

  async function chooseGrade(grade: "know" | "vague" | "forgot") {
    if (!currentWord) return;
    if (sessionId) {
      const nowTick = performance.now();
      const deltaMs = Math.max(0, Math.round(nowTick - lastActionRef.current));
      lastActionRef.current = nowTick;
      fetch("/api/session/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, wordId: currentWord.wordId, type: "review_grade", grade, deltaMs }),
      }).catch(() => undefined);
    }
    setSelectedGrade(grade);
    setRevealed(true);
    await fetch("/api/grade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wordId: currentWord.wordId, grade }),
    });
  }

  function goNext() {
    if (!words.length) return;
    if (index < words.length - 1 && index < SESSION_SIZE - 1) {
      transitionToNextWord(index + 1);
      return;
    }

    const wordIds = words.slice(0, SESSION_SIZE).map((word) => word.wordId);
    fetchCurrentUserNoStore()
      .then((user) => {
        if (!user) {
          router.replace("/auth/login");
          return;
        }
        localStorage.setItem(scopedStorageKey(user.id, "lastReviewSessionWordIds"), JSON.stringify(wordIds));
        router.push("/test?mode=review");
      })
      .catch(() => undefined);
  }

  async function onGenerateExample() {
    if (!currentWord || generatingExample) return;
    setGeneratingExample(true);
    try {
      const response = await fetch("/api/generateExample", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordId: currentWord.wordId }),
      });
      if (!response.ok) return;

      const data = (await response.json()) as { exampleJa?: string | null; exampleZh?: string | null };
      setWords((prev) =>
        prev.map((word) =>
          word.wordId === currentWord.wordId
            ? { ...word, exampleJa: data.exampleJa ?? word.exampleJa ?? null, exampleZh: data.exampleZh ?? word.exampleZh ?? null }
            : word,
        ),
      );
    } finally {
      setGeneratingExample(false);
    }
  }

  if (loading) {
    return <div className="glass-card p-5 text-sm text-white/80">{ZH.loading}</div>;
  }

  if (!currentWord) {
    return <div className="glass-card p-5 text-sm text-white/80">{ZH.noDueReview}</div>;
  }

  return (
    <div className="space-y-4">
      <section className={`glass-card p-6 transition-all duration-200 ease-out ${wordCardTransitionClass}`}>
        <p className="text-xs tracking-normal text-white/70">{ZH.progress} {progressLabel}</p>
        <h2 className="mt-3 text-4xl font-semibold leading-tight">{currentWord.wordName}</h2>
        {currentWord.kanaReading && <p className="mt-1 text-sm text-white/75">{currentWord.kanaReading}</p>}

        <button type="button" onClick={() => speakJa(currentWord.wordName)} className="ui-icon-btn font-inherit mt-4 rounded-2xl border border-white/30 bg-white/20 px-4 py-2 text-sm font-medium tracking-normal">
          {ZH.playAudio}
        </button>
      </section>

      <section className="grid grid-cols-3 gap-3">
        <button type="button" disabled={isTransitioning} onClick={() => chooseGrade("know")} className={`glass-card ui-primary-btn ui-frosted-card font-inherit p-3 text-sm font-medium tracking-normal ${selectedGrade === "know" ? "bg-white/25" : ""} disabled:opacity-60`}>
          {ZH.know}
        </button>
        <button type="button" disabled={isTransitioning} onClick={() => chooseGrade("vague")} className={`glass-card ui-primary-btn ui-frosted-card font-inherit p-3 text-sm font-medium tracking-normal ${selectedGrade === "vague" ? "bg-white/25" : ""} disabled:opacity-60`}>
          {ZH.vague}
        </button>
        <button type="button" disabled={isTransitioning} onClick={() => chooseGrade("forgot")} className={`glass-card ui-primary-btn ui-frosted-card font-inherit p-3 text-sm font-medium tracking-normal ${selectedGrade === "forgot" ? "bg-white/25" : ""} disabled:opacity-60`}>
          {ZH.forgot}
        </button>
      </section>

      {revealed && (
        <section className="glass-card p-5">
          <p className="text-xs tracking-normal text-white/70">{ZH.meaning}</p>
          <p className="mt-2 text-lg font-semibold">{currentWord.correctDesc}</p>
          <p className="mt-2 text-sm text-white/80">{currentWord.wordDesc}</p>
          {currentWord.exampleJa && currentWord.exampleZh ? (
            <div className="mt-4 rounded-2xl bg-white/10 p-3">
              <p className="text-xs tracking-normal text-white/70">{ZH.example}</p>
              <p className="mt-1 text-sm">{currentWord.exampleJa}</p>
              <p className="mt-1 text-sm text-white/80">{currentWord.exampleZh}</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={onGenerateExample}
              disabled={generatingExample}
              className="ui-icon-btn font-inherit mt-4 rounded-2xl border border-white/30 bg-white/20 px-4 py-2 text-sm font-medium tracking-normal disabled:opacity-60"
            >
              {generatingExample ? ZH.generating : ZH.generateExample}
            </button>
          )}
        </section>
      )}

      <button type="button" onClick={goNext} disabled={!revealed || isTransitioning} className="glass-card ui-primary-btn ui-frosted-card font-inherit w-full p-4 text-center text-base font-semibold tracking-normal disabled:opacity-55">
        {ZH.next}
      </button>
    </div>
  );
}



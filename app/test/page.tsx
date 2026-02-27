"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { speakJa } from "@/src/lib/tts";
import { fetchCurrentUserNoStore, scopedStorageKey } from "@/src/lib/client-user";
import { useToast } from "@/src/components/toast-provider";

type TestWord = {
  wordId: number;
  wordName: string;
  kanaReading: string | null;
  isKanaOnly: boolean;
  correctDesc: string;
  wordDesc: string;
};

type WordsByIdsResponse = {
  words: TestWord[];
};

function toHiragana(input: string): string {
  return input.replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

function normalizeText(input: string): string {
  return input.trim().normalize("NFKC").replace(/[\s\u3000]+/g, "");
}

function normalizeKana(input: string): string {
  return toHiragana(normalizeText(input));
}

function isKanaText(input: string): boolean {
  return /^[ぁ-んァ-ヶー]+$/u.test(normalizeText(input));
}

export default function TestPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") === "review" ? "review" : "study";
  const storageKeyBase = mode === "review" ? "lastReviewSessionWordIds" : "lastStudySessionWordIds";
  const sessionMetaKeyBase = mode === "review" ? "activeReviewSession" : "activeStudySession";
  const [userId, setUserId] = useState<number | null>(null);

  const [words, setWords] = useState<TestWord[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [kanaInput, setKanaInput] = useState("");
  const [kanjiInput, setKanjiInput] = useState("");
  const [wrongAttempts, setWrongAttempts] = useState<Record<number, number>>({});
  const [autoPronounce, setAutoPronounce] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStartedAtMs, setSessionStartedAtMs] = useState<number | null>(null);
  const completedSentRef = useRef(false);
  const lastActionRef = useRef(0);

  const currentWord = words[index] ?? null;
  const storageKey = useMemo(() => (userId ? scopedStorageKey(userId, storageKeyBase) : storageKeyBase), [storageKeyBase, userId]);
  const sessionMetaKey = useMemo(
    () => (userId ? scopedStorageKey(userId, sessionMetaKeyBase) : sessionMetaKeyBase),
    [sessionMetaKeyBase, userId],
  );
  const progressLabel = useMemo(
    () => `${Math.min(index + 1, words.length || 1)}/${words.length || 0}`,
    [index, words.length],
  );

  useEffect(() => {
    async function loadWords() {
      const user = await fetchCurrentUserNoStore();
      if (!user) {
        router.replace("/auth/login");
        return;
      }
      setUserId(user.id);

      const shouldAutoPronounce = localStorage.getItem("autoPronounce") === "true";
      setAutoPronounce(shouldAutoPronounce);
      lastActionRef.current = performance.now();

      const scopedSessionMetaKey = scopedStorageKey(user.id, sessionMetaKeyBase);
      const scopedStorageKeyName = scopedStorageKey(user.id, storageKeyBase);

      const metaRaw = localStorage.getItem(scopedSessionMetaKey);
      if (metaRaw) {
        try {
          const parsed = JSON.parse(metaRaw) as { sessionId?: string; startedAtMs?: number };
          if (parsed.sessionId) setSessionId(parsed.sessionId);
          if (typeof parsed.startedAtMs === "number") setSessionStartedAtMs(parsed.startedAtMs);
        } catch {
          setSessionId(null);
          setSessionStartedAtMs(null);
        }
      }

      setLoading(true);
      const stored = localStorage.getItem(scopedStorageKeyName);
      if (!stored) {
        setWords([]);
        setLoading(false);
        return;
      }

      let wordIds: number[] = [];
      try {
        const parsed = JSON.parse(stored) as unknown;
        if (Array.isArray(parsed)) {
          wordIds = parsed.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0);
        }
      } catch {
        wordIds = [];
      }

      if (!wordIds.length) {
        setWords([]);
        setLoading(false);
        return;
      }

      const response = await fetch("/api/wordsByIds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordIds }),
      });

      if (!response.ok) {
        setWords([]);
        setLoading(false);
        return;
      }

      const data = (await response.json()) as WordsByIdsResponse;
      setWords(data.words ?? []);
      setLoading(false);
    }

    loadWords().catch(() => setLoading(false));
  }, [router, sessionMetaKeyBase, storageKeyBase]);

  useEffect(() => {
    if (!currentWord) return;
    router.replace(`/test?mode=${mode}&i=${index + 1}&total=${words.length}`, { scroll: false });
    if (autoPronounce) {
      speakJa(currentWord.wordName);
    }
  }, [autoPronounce, currentWord, index, mode, router, words.length]);

  function resetInputs() {
    setKanaInput("");
    setKanjiInput("");
  }

  async function sendCompleteIfNeeded(): Promise<boolean> {
    if (completedSentRef.current || !sessionId) return true;
    completedSentRef.current = true;
    const totalMs = Math.max(0, Math.round(Date.now() - (sessionStartedAtMs ?? Date.now())));
    const stored = localStorage.getItem(storageKey);
    const wordIds = stored
      ? (JSON.parse(stored) as unknown[]).map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0)
      : [];

    try {
      const response = await fetch("/api/session/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, wordIds, totalMs }),
      });
      if (!response.ok) {
        showToast("会话保存失败，请稍后重试", "error");
        return false;
      }
      showToast("会话已完成", "success");
      return true;
    } catch {
      showToast("会话保存失败，请稍后重试", "error");
      return false;
    }
  }

  async function moveNextWord() {
    setFeedback("");
    resetInputs();
    if (index >= words.length - 1) {
      await sendCompleteIfNeeded();
      router.push("/");
      router.refresh();
      return;
    }
    setIndex((prev) => prev + 1);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!currentWord) return;

    let passed = false;
    let expectedRaw = "";
    let inputRaw = "";
    let expectedNorm = "";
    let inputNorm = "";

    if (currentWord.isKanaOnly) {
      const expectedKana = currentWord.wordName;
      expectedRaw = expectedKana;
      inputRaw = kanaInput;
      expectedNorm = normalizeKana(expectedKana);
      inputNorm = normalizeKana(kanaInput);
      passed = inputNorm === expectedNorm;
    } else {
      const expectedKanji = currentWord.wordName;
      const expectedKana = currentWord.kanaReading && isKanaText(currentWord.kanaReading) ? currentWord.kanaReading : null;
      const expectedKanjiNorm = normalizeText(expectedKanji);
      const inputKanjiNorm = normalizeText(kanjiInput);
      const expectedKanaNorm = expectedKana ? normalizeKana(expectedKana) : null;
      const inputKanaNorm = expectedKana ? normalizeKana(kanaInput) : null;
      expectedRaw = `kanji=${expectedKanji} | kana=${expectedKana}`;
      inputRaw = `kanji=${kanjiInput} | kana=${kanaInput}`;
      expectedNorm = `kanji=${expectedKanjiNorm} | kana=${expectedKanaNorm}`;
      inputNorm = `kanji=${inputKanjiNorm} | kana=${inputKanaNorm}`;
      passed = expectedKana
        ? inputKanjiNorm === expectedKanjiNorm && inputKanaNorm === expectedKanaNorm
        : inputKanjiNorm === expectedKanjiNorm;
    }

    const nowTick = performance.now();
    const deltaMs = Math.max(0, Math.round(nowTick - lastActionRef.current));
    lastActionRef.current = nowTick;
    if (sessionId) {
      fetch("/api/session/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          wordId: currentWord.wordId,
          type: "test_submit",
          grade: passed ? "correct" : "wrong",
          deltaMs,
        }),
      }).catch(() => undefined);
    }

    if (passed) {
      setFeedback("正确");
      await moveNextWord();
      return;
    }

    const currentCount = (wrongAttempts[currentWord.wordId] ?? 0) + 1;
    if (currentCount >= 3) {
      await fetch("/api/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordId: currentWord.wordId }),
      });
      setWrongAttempts((prev) => ({ ...prev, [currentWord.wordId]: 0 }));
      setFeedback("错误达 3 次，已回退一级并进入下一词");
      await moveNextWord();
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      console.debug("[test-wrong]", {
        wordId: currentWord.wordId,
        expectedRaw,
        expectedNorm,
        inputRaw,
        inputNorm,
      });
    }

    setWrongAttempts((prev) => ({ ...prev, [currentWord.wordId]: currentCount }));
    setFeedback(`错误，还可重试 ${3 - currentCount} 次`);
  }

  if (loading) {
    return <div className="glass-card p-5 text-sm text-white/80">加载测试数据中...</div>;
  }

  if (!words.length) {
    return (
      <div className="space-y-4">
        <section className="glass-card p-5">
          <h2 className="text-lg font-semibold">暂无测试数据</h2>
          <p className="mt-2 text-sm text-white/75">请先完成学习或复习 10 词会话。</p>
        </section>
        <button type="button" className="glass-card w-full p-4 text-center text-base font-semibold" onClick={() => router.push("/")}>
          返回主页
        </button>
      </div>
    );
  }

  if (completed || !currentWord) {
    return (
      <div className="space-y-4">
        <section className="glass-card p-5">
          <h2 className="text-lg font-semibold">测试完成</h2>
          <p className="mt-2 text-sm text-white/75">本次会话单词已全部通过。</p>
        </section>
        <button type="button" className="glass-card w-full p-4 text-center text-base font-semibold" onClick={() => router.push("/")}>
          返回主页
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="glass-card p-5">
        <p className="text-xs text-white/70">进度 {progressLabel}</p>
        <p className="mt-2 text-sm text-white/80">请根据提示输入答案</p>
      </section>

      <section className="glass-card p-5">
        {currentWord.isKanaOnly ? (
          <>
            <p className="text-xs text-white/70">根据释义写假名</p>
            <p className="mt-2 text-lg font-semibold">{currentWord.correctDesc}</p>
          </>
        ) : (
          <>
            <p className="text-xs text-white/70">根据释义写汉字和假名</p>
            <p className="mt-2 text-lg font-semibold">{currentWord.correctDesc}</p>
            <p className="mt-1 text-sm text-white/75">{currentWord.wordDesc}</p>
          </>
        )}

        <button type="button" className="mt-4 rounded-2xl border border-white/30 bg-white/20 px-4 py-2 text-sm font-medium" onClick={() => speakJa(currentWord.wordName)}>
          播放发音
        </button>
      </section>

      <form onSubmit={onSubmit} className="glass-card space-y-3 p-5">
        {!currentWord.isKanaOnly && (
          <label className="block">
            <span className="mb-1 block text-xs text-white/70">漢字</span>
            <input
              value={kanjiInput}
              onChange={(e) => setKanjiInput(e.target.value)}
              className="w-full rounded-2xl border border-white/25 bg-white/10 px-4 py-3 text-sm outline-none placeholder:text-white/45"
              placeholder="输入汉字"
            />
          </label>
        )}

        {(currentWord.isKanaOnly || (currentWord.kanaReading && isKanaText(currentWord.kanaReading))) ? (
          <label className="block">
            <span className="mb-1 block text-xs text-white/70">假名</span>
            <input
              value={kanaInput}
              onChange={(e) => setKanaInput(e.target.value)}
              className="w-full rounded-2xl border border-white/25 bg-white/10 px-4 py-3 text-sm outline-none placeholder:text-white/45"
              placeholder="输入假名"
            />
          </label>
        ) : (
          !currentWord.isKanaOnly && (
            <p className="text-xs text-white/65">该词缺少可用假名读音，已跳过假名输入。</p>
          )
        )}

        {feedback && <p className="text-sm text-white/90">{feedback}</p>}

        <button type="submit" className="w-full rounded-2xl border border-white/35 bg-white/25 px-4 py-3 text-sm font-semibold">
          提交
        </button>
      </form>
    </div>
  );
}

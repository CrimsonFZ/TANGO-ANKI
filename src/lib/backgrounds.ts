export const BACKGROUNDS = Array.from({ length: 20 }, (_, index) => `/bg/bg${index + 1}.jpg`);

export type BackgroundPref = { mode: "random" } | { mode: "fixed"; index: number };

export function getRandomBackground(): string {
  const randomIndex = Math.floor(Math.random() * BACKGROUNDS.length);
  return BACKGROUNDS[randomIndex] ?? BACKGROUNDS[0];
}

export function getBackgroundByIndex(index: number): string {
  if (!Number.isFinite(index)) return BACKGROUNDS[0];
  const normalized = ((Math.trunc(index) % BACKGROUNDS.length) + BACKGROUNDS.length) % BACKGROUNDS.length;
  return BACKGROUNDS[normalized] ?? BACKGROUNDS[0];
}

export function getBackgroundPrefStorageKey(userId: number): string {
  return `bgPref:${userId}`;
}

export function parseBackgroundPref(raw: string | null): BackgroundPref {
  if (!raw) return { mode: "random" };
  try {
    const parsed = JSON.parse(raw) as Partial<BackgroundPref>;
    if (parsed.mode === "fixed" && typeof parsed.index === "number" && Number.isFinite(parsed.index)) {
      return { mode: "fixed", index: parsed.index };
    }
    if (parsed.mode === "random") {
      return { mode: "random" };
    }
  } catch {
    // ignore parse errors and fall back to random
  }
  return { mode: "random" };
}

export function toDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function hashText(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getDailyBackgroundByUser(userId: number, dateKey = toDateKey()): string {
  const index = hashText(`${userId}:${dateKey}`) % BACKGROUNDS.length;
  return getBackgroundByIndex(index);
}

export function resolveBackgroundFromPref(userId: number, pref: BackgroundPref, dateKey = toDateKey()): string {
  if (pref.mode === "fixed") return getBackgroundByIndex(pref.index);
  return getDailyBackgroundByUser(userId, dateKey);
}

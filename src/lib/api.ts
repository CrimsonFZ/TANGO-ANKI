import { type BookLevel } from "@prisma/client";

const LEVELS = new Set<BookLevel>(["n1", "n2", "n3", "n5n4"]);

export function normalizeLevel(input: string | null): BookLevel | null {
  if (!input) return null;
  const canonical = input.trim().toLowerCase();
  return LEVELS.has(canonical as BookLevel) ? (canonical as BookLevel) : null;
}

export function parseLevel(input: string | null): BookLevel | null {
  return normalizeLevel(input);
}

export function parseLimit(input: string | null, fallback = 10): number {
  if (!input) return fallback;
  const parsed = Number.parseInt(input, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 100);
}

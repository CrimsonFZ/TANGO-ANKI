"use client";

export type ClientAuthUser = {
  id: number;
  username: string;
};

type AuthMeResponse = {
  ok?: boolean;
  user?: ClientAuthUser;
};

export function scopedStorageKey(userId: number, baseKey: string): string {
  return `u:${userId}:${baseKey}`;
}

export function normalizeClientLevel(input: string | null): "n1" | "n2" | "n3" | "n5n4" {
  const canonical = (input ?? "").trim().toLowerCase();
  if (canonical === "n1" || canonical === "n2" || canonical === "n3" || canonical === "n5n4") return canonical;
  return "n1";
}

export async function fetchCurrentUserNoStore(): Promise<ClientAuthUser | null> {
  const response = await fetch("/api/auth/me", { cache: "no-store" });
  if (!response.ok) return null;
  const data = (await response.json()) as AuthMeResponse;
  return data.ok && data.user ? data.user : null;
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "注册失败");
        return;
      }

      router.replace("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100svh-10rem)] items-center">
      <div className="glass-card w-full p-6">
        <h1 className="text-center text-2xl font-semibold">注册</h1>
        <form onSubmit={onSubmit} className="mt-5 space-y-3">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="用户名"
            className="w-full rounded-2xl border border-white/25 bg-white/10 px-4 py-3 text-sm outline-none placeholder:text-white/45"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密码（至少8位）"
            className="w-full rounded-2xl border border-white/25 bg-white/10 px-4 py-3 text-sm outline-none placeholder:text-white/45"
          />
          {error && <p className="text-sm text-red-200">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl border border-white/35 bg-white/25 px-4 py-3 text-sm font-semibold disabled:opacity-60"
          >
            {loading ? "注册中..." : "注册"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-white/80">
          已有账号？{" "}
          <Link href="/auth/login" className="font-semibold text-white">
            去登录
          </Link>
        </p>
      </div>
    </div>
  );
}

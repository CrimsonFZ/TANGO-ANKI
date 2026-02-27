"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ToastProvider } from "@/src/components/toast-provider";

const ROOT_TABS = ["/", "/study", "/review", "/me"] as const;

const TAB_ITEMS = [
  { href: "/", label: "主页" },
  { href: "/study", label: "学习" },
  { href: "/review", label: "复习" },
  { href: "/me", label: "我的" },
] as const;

function resolveTitle(pathname: string, progressLabel: string | null): string {
  if (pathname === "/") return "主页";
  if (pathname === "/study") return progressLabel ? `学习 ${progressLabel}` : "学习";
  if (pathname === "/review") return "复习";
  if (pathname === "/me") return "我的";
  if (pathname === "/me/settings") return "设置";
  if (pathname === "/test") return "测试";
  return "详情";
}

function IconButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`h-10 w-10 rounded-full border border-white/30 bg-white/15 text-white backdrop-blur-lg transition active:scale-95 ${props.className ?? ""}`}
    />
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [starModalOpen, setStarModalOpen] = useState(false);

  const canGoBack = !ROOT_TABS.includes(pathname as (typeof ROOT_TABS)[number]);
  const progressLabel = pathname === "/study"
    ? `${searchParams.get("i") ?? "1"}/${searchParams.get("total") ?? "10"}`
    : null;
  const title = resolveTitle(pathname, progressLabel);
  const currentWordId = Number(searchParams.get("wordId") ?? "");
  const canToggleCurrentWord = Number.isInteger(currentWordId) && currentWordId > 0;

  const starButtonTitle = useMemo(() => {
    return canToggleCurrentWord ? "收藏当前词" : "收藏列表";
  }, [canToggleCurrentWord]);

  async function onPressStar() {
    if (canToggleCurrentWord) {
      await fetch("/api/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordId: currentWordId, field: "starred" }),
      });
      return;
    }

    setStarModalOpen(true);
  }

  return (
    <ToastProvider>
      <div className="mx-auto flex min-h-[100svh] w-full max-w-md flex-col">
      <header className="safe-top sticky top-0 z-30 px-4">
        <div className="glass-card mt-2 flex h-14 items-center justify-between px-3">
          <div className="w-10">
            {canGoBack && (
              <IconButton aria-label="返回" onClick={() => router.back()}>
                <svg viewBox="0 0 24 24" className="mx-auto h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </IconButton>
            )}
          </div>

          <h1 className="text-sm font-semibold tracking-wide">{title}</h1>

          <div className="flex w-24 justify-end gap-2">
            <IconButton aria-label={starButtonTitle} onClick={onPressStar}>
              <svg viewBox="0 0 24 24" className="mx-auto h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3.5l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.8 6.4 20.7l1.1-6.2L3 10.1l6.2-.9z" />
              </svg>
            </IconButton>
            <IconButton aria-label="设置" onClick={() => router.push("/me/settings")}>
              <svg viewBox="0 0 24 24" className="mx-auto h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.2a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1z" />
              </svg>
            </IconButton>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pb-28 pt-4">{children}</main>

      <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-30 mx-auto w-full max-w-md px-4">
        <div className="glass-card mb-2 flex items-center justify-between px-3 py-2">
          {TAB_ITEMS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`rounded-2xl px-4 py-2 text-sm transition ${
                  active ? "bg-white/25 font-semibold text-white" : "text-white/80"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {starModalOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/45 p-4" onClick={() => setStarModalOpen(false)}>
          <div className="glass-card safe-bottom w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 text-base font-semibold">收藏列表</div>
            <p className="text-sm text-white/75">当前是 UI 骨架。后续可接入收藏词列表与跳转。</p>
            <button
              type="button"
              onClick={() => setStarModalOpen(false)}
              className="mt-4 w-full rounded-2xl border border-white/30 bg-white/20 px-4 py-3 text-sm font-medium"
            >
              关闭
            </button>
          </div>
        </div>
      )}
      </div>
    </ToastProvider>
  );
}

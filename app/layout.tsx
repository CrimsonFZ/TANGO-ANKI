import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/src/components/app-shell";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Tango Anki",
  description: "Japanese vocabulary learning app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased cjk-safe">
        <Suspense fallback={<div className="min-h-[100svh] bg-transparent" />}>
          <AppShell>{children}</AppShell>
        </Suspense>
      </body>
    </html>
  );
}

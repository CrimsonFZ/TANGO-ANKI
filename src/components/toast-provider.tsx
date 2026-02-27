"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type ToastType = "success" | "error" | "info";

type ToastState = {
  id: number;
  message: string;
  type: ToastType;
};

type ToastContextValue = {
  showToast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [visible, setVisible] = useState(false);
  const idRef = useRef(0);
  const hideTimerRef = useRef<number | null>(null);
  const clearTimerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);

    const nextId = idRef.current + 1;
    idRef.current = nextId;
    setToast({ id: nextId, message, type });
    setVisible(true);

    hideTimerRef.current = window.setTimeout(() => setVisible(false), 2200);
    clearTimerRef.current = window.setTimeout(() => setToast(null), 2500);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  const toneClasses =
    toast?.type === "success"
      ? "border-emerald-200/45 bg-emerald-900/30"
      : toast?.type === "error"
        ? "border-rose-200/45 bg-rose-950/35"
        : "border-white/35 bg-slate-950/45";

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed left-1/2 top-6 z-[60] w-[90%] max-w-md -translate-x-1/2">
        {toast && (
          <div
            key={toast.id}
            className={`rounded-2xl border px-4 py-3 text-center text-sm text-white backdrop-blur-xl transition-all duration-300 ease-out ${toneClasses} ${
              visible ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
            }`}
          >
            {toast.message}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}


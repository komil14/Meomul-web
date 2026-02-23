import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { PropsWithChildren } from "react";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const TOAST_DURATION_MS = 2800;

const ToastContext = createContext<ToastContextValue | null>(null);

const toneClasses: Record<ToastKind, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-rose-200 bg-rose-50 text-rose-800",
  info: "border-slate-200 bg-slate-50 text-slate-800",
};

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timeoutMapRef = useRef<Record<number, number>>({});
  const idCounterRef = useRef(0);

  const removeToast = useCallback((id: number) => {
    const timeoutId = timeoutMapRef.current[id];
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      delete timeoutMapRef.current[id];
    }

    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    (kind: ToastKind, message: string) => {
      idCounterRef.current += 1;
      const nextToast: ToastItem = {
        id: idCounterRef.current,
        kind,
        message,
      };

      setToasts((prev) => [...prev, nextToast].slice(-4));

      const timeoutId = window.setTimeout(() => {
        removeToast(nextToast.id);
      }, TOAST_DURATION_MS);
      timeoutMapRef.current[nextToast.id] = timeoutId;
    },
    [removeToast],
  );

  useEffect(() => {
    return () => {
      Object.values(timeoutMapRef.current).forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeoutMapRef.current = {};
    };
  }, []);

  const contextValue = useMemo<ToastContextValue>(
    () => ({
      success: (message: string) => pushToast("success", message),
      error: (message: string) => pushToast("error", message),
      info: (message: string) => pushToast("info", message),
    }),
    [pushToast],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="pointer-events-none fixed right-4 top-16 z-50 flex w-[min(92vw,24rem)] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-lg border px-3 py-2 text-sm font-medium shadow-sm ${toneClasses[toast.kind]}`}
            role="status"
            aria-live="polite"
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }

  return context;
}

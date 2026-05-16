/**
 * useToast hook — separated from components so react-refresh/only-export-components
 * doesn't complain about non-component exports mixed with components.
 */
import { createContext, useCallback, useContext, useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ToastVariant = "default" | "destructive" | "success";

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
}

interface ToastContextValue {
  toast: (item: Omit<ToastItem, "id">) => void;
  toasts: ToastItem[];
  dismiss: (id: string) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return { toast: ctx.toast };
}

export function useToastState() {
  const counterRef = useRef(0);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((item: Omit<ToastItem, "id">) => {
    const id = String(++counterRef.current);
    setToasts((prev) => [...prev, { ...item, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, toast, dismiss };
}

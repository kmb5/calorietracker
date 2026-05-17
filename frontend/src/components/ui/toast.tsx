/**
 * Toast UI components.
 *
 * Provider wraps the app; ToastViewport renders the floating list.
 * For the hook, import { useToast } from "../../hooks/useToast".
 */
import { useEffect, useState } from "react";
import { ToastContext, useToastState } from "../../hooks/useToast";
import type { ToastItem } from "../../hooks/useToast";

// ── Provider ──────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { toasts, toast, dismiss } = useToastState();

  return (
    <ToastContext.Provider value={{ toast, toasts, dismiss }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ── Viewport (the floating list) ──────────────────────────────────────────────

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="pointer-events-none fixed bottom-4 left-1/2 z-[9999] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2"
    >
      {toasts.map((t) => (
        <ToastBubble key={t.id} item={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// ── Individual bubble ─────────────────────────────────────────────────────────

function ToastBubble({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  // Animate in
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const bgClass =
    item.variant === "destructive"
      ? "bg-destructive text-destructive-foreground"
      : item.variant === "success"
        ? "bg-success-bg text-success border border-success/30"
        : "bg-card text-foreground border border-border";

  return (
    <div
      role="status"
      className={`shadow-card pointer-events-auto flex items-start gap-3 rounded-[12px] px-4 py-3.5 transition-all duration-300 ${bgClass} ${
        visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug font-semibold">{item.title}</p>
        {item.description && (
          <p className="mt-0.5 text-[13px] leading-snug opacity-80">
            {item.description}
          </p>
        )}
      </div>
      {item.action && (
        <button
          onClick={item.action.onClick}
          className="flex-shrink-0 cursor-pointer text-sm font-semibold underline underline-offset-2"
          aria-label={item.action.label}
        >
          {item.action.label}
        </button>
      )}
      <button
        onClick={() => onDismiss(item.id)}
        className="ml-1 flex-shrink-0 cursor-pointer rounded-full p-0.5 opacity-60 transition-opacity hover:opacity-100"
        aria-label="Dismiss"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

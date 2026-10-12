import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastTone = "success" | "error" | "info";

interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  message?: string;
}

interface ToastContextValue {
  push: (tone: ToastTone, title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const remove = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, title: string, message?: string) => {
      const id = nextId.current++;
      setToasts((list) => [...list, { id, tone, title, message }]);
      window.setTimeout(() => remove(id), tone === "error" ? 7000 : 4500);
    },
    [remove],
  );

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="region" aria-label="Notifications">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`} role={t.tone === "error" ? "alert" : "status"}>
            <span aria-hidden="true">
              {t.tone === "success" ? "✅" : t.tone === "error" ? "⚠️" : "ℹ️"}
            </span>
            <div>
              <div className="toast-title">{t.title}</div>
              {t.message && <div className="toast-msg">{t.message}</div>}
            </div>
            <button
              className="toast-close"
              aria-label="Dismiss notification"
              onClick={() => remove(t.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

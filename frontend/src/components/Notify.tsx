import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

// ── Types ────────────────────────────────────────────────────────────────────

type NotifyKind = 'success' | 'error' | 'info';

interface ToastOptions {
  title?: string;
  duration?: number;
}

type ToastApi = (message: string, opts?: ToastOptions) => void;

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface NotifyApi {
  success: ToastApi;
  error: ToastApi;
  info: ToastApi;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

// ── Internal state shapes ─────────────────────────────────────────────────────

interface ToastItem {
  id: string;
  kind: NotifyKind;
  title?: string;
  message: string;
  duration: number;
  leaving: boolean;
}

interface PendingConfirm {
  opts: ConfirmOptions;
  resolve: (value: boolean) => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const NotifyContext = createContext<NotifyApi | null>(null);

// ── Single Toast component ────────────────────────────────────────────────────

interface ToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

function Toast({ toast, onDismiss }: ToastProps) {
  // Schedule auto-dismiss
  useEffect(() => {
    if (toast.duration === 0) return;
    const timer = window.setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div
      role="alert"
      aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}
      className={`notify-toast${toast.leaving ? ' is-leaving' : ''}`}
    >
      <div className={`notify-bar ${toast.kind}`} aria-hidden="true" />
      <div className="notify-body">
        {toast.title && <div className="notify-title">{toast.title}</div>}
        <div className="notify-msg">{toast.message}</div>
      </div>
      <button
        type="button"
        className="notify-close"
        aria-label="Закрыть уведомление"
        onClick={() => onDismiss(toast.id)}
      >
        ✕
      </button>
    </div>
  );
}

// ── Confirm Modal component ───────────────────────────────────────────────────

interface ConfirmModalProps {
  pending: PendingConfirm;
}

function ConfirmModal({ pending }: ConfirmModalProps) {
  const { opts, resolve } = pending;
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus cancel button on mount (safer default for destructive ops)
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Esc → cancel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resolve(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [resolve]);

  return createPortal(
    <div
      className="notify-cf-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) resolve(false);
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="notify-cf-title"
      aria-describedby="notify-cf-msg"
    >
      <div className="notify-cf-card">
        <p id="notify-cf-title" className="notify-cf-title">
          {opts.title ?? 'Подтверждение'}
        </p>
        <p id="notify-cf-msg" className="notify-cf-msg">
          {opts.message}
        </p>
        <div className="notify-cf-actions">
          <button
            ref={cancelRef}
            type="button"
            className="notify-cf-btn"
            onClick={() => resolve(false)}
          >
            {opts.cancelLabel ?? 'Отмена'}
          </button>
          <button
            type="button"
            className={`notify-cf-btn ${opts.danger ? 'danger' : 'primary'}`}
            onClick={() => resolve(true)}
          >
            {opts.confirmLabel ?? 'Подтвердить'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Provider ──────────────────────────────────────────────────────────────────

interface NotifyProviderProps {
  children: React.ReactNode;
}

export function NotifyProvider({ children }: NotifyProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  // Dismiss: start leave animation, then remove
  const dismiss = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)),
    );
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 200); // slightly longer than notify-out 0.18s
  }, []);

  const addToast = useCallback(
    (kind: NotifyKind, message: string, opts?: ToastOptions) => {
      const id = crypto.randomUUID();
      const defaultDuration = kind === 'error' ? 6000 : 4000;
      const duration = opts?.duration ?? defaultDuration;
      setToasts((prev) => [
        { id, kind, title: opts?.title, message, duration, leaving: false },
        ...prev,
      ]);
    },
    [],
  );

  const success = useCallback<ToastApi>(
    (message, opts) => addToast('success', message, opts),
    [addToast],
  );

  const error = useCallback<ToastApi>(
    (message, opts) => addToast('error', message, opts),
    [addToast],
  );

  const info = useCallback<ToastApi>(
    (message, opts) => addToast('info', message, opts),
    [addToast],
  );

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      const wrappedResolve = (value: boolean) => {
        setPendingConfirm(null);
        resolve(value);
      };
      setPendingConfirm({ opts, resolve: wrappedResolve });
    });
  }, []);

  const api: NotifyApi = { success, error, info, confirm };

  return (
    <NotifyContext.Provider value={api}>
      {children}

      {/* Toast stack — portal to body */}
      {createPortal(
        <div className="notify-stack" aria-label="Уведомления">
          {toasts.map((t) => (
            <Toast key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </div>,
        document.body,
      )}

      {/* Confirm modal */}
      {pendingConfirm && <ConfirmModal pending={pendingConfirm} />}

      <style>{notifyCss}</style>
    </NotifyContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useNotify(): NotifyApi {
  const ctx = useContext(NotifyContext);
  if (!ctx) {
    throw new Error('useNotify() must be called inside <NotifyProvider>.');
  }
  return ctx;
}

// ── CSS ───────────────────────────────────────────────────────────────────────

const notifyCss = `
.notify-stack {
  position: fixed;
  top: 18px;
  right: 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 9999;
  pointer-events: none;
  max-width: 380px;
  width: calc(100vw - 36px);
}
@media (max-width: 640px) {
  .notify-stack { left: 18px; max-width: none; }
}
.notify-toast {
  display: grid;
  grid-template-columns: 4px 1fr auto;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(20, 24, 42, 0.92);
  backdrop-filter: blur(14px) saturate(160%);
  -webkit-backdrop-filter: blur(14px) saturate(160%);
  border: 1px solid var(--border);
  color: var(--text);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
  animation: notify-in 0.22s cubic-bezier(0.22, 1, 0.36, 1);
  pointer-events: auto;
}
:root[data-theme="light"] .notify-toast {
  background: rgba(255, 255, 255, 0.95);
  color: #1a1f33;
}
.notify-toast.is-leaving { animation: notify-out 0.18s ease forwards; }
@keyframes notify-in {
  from { opacity: 0; transform: translateX(20px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes notify-out {
  to { opacity: 0; transform: translateX(20px); }
}
.notify-bar {
  border-radius: 4px;
  align-self: stretch;
}
.notify-bar.success { background: #4ade80; }
.notify-bar.error   { background: #f87171; }
.notify-bar.info    { background: #38bdf8; }
.notify-body { min-width: 0; }
.notify-title { font-weight: 700; font-size: 14px; margin-bottom: 2px; }
.notify-msg { font-size: 13px; color: var(--muted); line-height: 1.4; white-space: pre-line; word-wrap: break-word; }
:root[data-theme="light"] .notify-msg { color: #4a5070; }
.notify-close {
  background: transparent;
  border: none;
  color: var(--muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: grid; place-items: center;
  width: 28px; height: 28px;
  transition: background 0.15s, color 0.15s;
  align-self: flex-start;
  min-height: 0;
  box-shadow: none;
  background-image: none;
  font-size: 13px;
}
.notify-close:hover { background: var(--panel-2); color: var(--text); background-image: none; transform: none; box-shadow: none; }

/* Confirm modal */
.notify-cf-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.58);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  animation: notify-fade 0.18s ease;
}
@keyframes notify-fade { from { opacity: 0 } to { opacity: 1 } }
.notify-cf-card {
  width: 100%;
  max-width: 440px;
  background: var(--panel);
  border: 1px solid var(--border-strong);
  border-radius: 18px;
  padding: 24px;
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.45);
  animation: notify-pop 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}
:root[data-theme="light"] .notify-cf-card { background: rgba(255, 255, 255, 0.96); }
@keyframes notify-pop {
  from { opacity: 0; transform: scale(0.94); }
  to   { opacity: 1; transform: scale(1); }
}
.notify-cf-title { font-size: 17px; font-weight: 700; margin: 0 0 8px; }
.notify-cf-msg { font-size: 14px; color: var(--muted); line-height: 1.5; white-space: pre-line; margin: 0 0 20px; }
:root[data-theme="light"] .notify-cf-msg { color: #4a5070; }
.notify-cf-actions { display: flex; justify-content: flex-end; gap: 10px; }
.notify-cf-btn {
  padding: 10px 18px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--border);
  background: var(--panel-2);
  color: var(--text);
  transition: background 0.18s, transform 0.12s, box-shadow 0.2s;
  min-height: 0;
  box-shadow: none;
  background-image: none;
}
.notify-cf-btn:hover { background: var(--panel); transform: translateY(-1px); background-image: none; box-shadow: none; }
.notify-cf-btn.primary {
  background-image: linear-gradient(135deg, #4ade80 0%, #22d3ee 100%);
  background-color: transparent;
  color: #04210d;
  border-color: transparent;
}
.notify-cf-btn.primary:hover {
  background-image: linear-gradient(135deg, #4ade80 0%, #22d3ee 100%);
  box-shadow: 0 8px 20px -4px rgba(74, 222, 128, 0.45);
}
.notify-cf-btn.danger {
  background-image: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
  background-color: transparent;
  color: #fff;
  border-color: transparent;
}
.notify-cf-btn.danger:hover {
  background-image: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
  box-shadow: 0 8px 20px -4px rgba(248, 113, 113, 0.5);
}
`;

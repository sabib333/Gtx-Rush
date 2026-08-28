import React, { useEffect, useState } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info' | 'xp';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

const typeConfig: Record<ToastType, { icon: string; classes: string }> = {
  success: { icon: '✓', classes: 'bg-success-500/15 border-success-500/30 text-success-400' },
  error: { icon: '✕', classes: 'bg-danger-500/15 border-danger-500/30 text-danger-400' },
  warning: { icon: '⚠', classes: 'bg-warning-500/15 border-warning-500/30 text-warning-400' },
  info: { icon: 'ℹ', classes: 'bg-accent-500/15 border-accent-500/30 text-accent-400' },
  xp: { icon: '⚡', classes: 'bg-energy-500/15 border-energy-500/30 text-energy-400' },
};

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  return (
    <div className="fixed top-4 left-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const config = typeConfig[toast.type];

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration ?? 3000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div
      className={`
        pointer-events-auto flex items-center gap-3 px-4 py-3
        rounded-xl border backdrop-blur-xl shadow-elevated
        animate-slide-down
        ${config.classes}
      `}
    >
      <span className="text-lg flex-shrink-0">{config.icon}</span>
      <span className="text-body-sm font-medium text-txt-primary flex-1">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-txt-tertiary hover:text-white transition-colors"
      >
        ✕
      </button>
    </div>
  );
}

/* ============================================================
   Toast Hook
   ============================================================ */

let toastCounter = 0;

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = (type: ToastType, message: string, duration?: number) => {
    const id = `toast-${++toastCounter}`;
    setToasts((prev) => [...prev, { id, type, message, duration }]);
  };

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return {
    toasts,
    toast: addToast,
    dismiss,
    success: (msg: string) => addToast('success', msg),
    error: (msg: string) => addToast('error', msg),
    warning: (msg: string) => addToast('warning', msg),
    info: (msg: string) => addToast('info', msg),
    xp: (msg: string) => addToast('xp', msg),
  };
}

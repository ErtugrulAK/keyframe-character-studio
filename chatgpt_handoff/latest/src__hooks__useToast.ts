import { useState, useCallback } from 'react';

export interface ToastOptions {
  /** Optional concise headline rendered above the message. */
  title?: string;
  /** Optional next-step hint rendered below the message. */
  action?: string;
  /** Overrides the default auto-dismiss delay in milliseconds. */
  durationMs?: number;
}

export interface ToastItem {
  id: string;
  message: string;
  /** Optional so the previously exported public shape stays compatible; toasts always set it. */
  type?: 'success' | 'error' | 'info';
  title?: string;
  action?: string;
}

export const TOAST_DEFAULT_DURATION_MS = 3200;

export const useToast = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((
    message: string,
    type: 'success' | 'error' | 'info' = 'success',
    options: ToastOptions = {},
  ) => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, {
      id,
      message,
      type,
      ...(options.title ? { title: options.title } : {}),
      ...(options.action ? { action: options.action } : {}),
    }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, options.durationMs ?? TOAST_DEFAULT_DURATION_MS);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, showToast, removeToast };
};

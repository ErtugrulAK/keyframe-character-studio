import React from 'react';
import ReactDOM from 'react-dom';
import { CheckCircle2, AlertCircle, Sparkles, X } from 'lucide-react';
import type { ToastItem } from '../../hooks/useToast';

interface ToastPortalProps {
  toasts: ToastItem[];
  removeToast: (id: string) => void;
}

/**
 * Type-specific accent drawn from the shared editor tokens. Success is the
 * primary accent, errors stay on the danger token, and info takes the
 * attention hue so it never competes with the primary action color.
 */
const toastAccent = (type: ToastItem['type']): string => {
  if (type === 'error') return 'var(--kcs-danger)';
  if (type === 'info') return 'var(--kcs-border-focus)';
  return 'var(--kcs-accent)';
};

export const ToastPortal: React.FC<ToastPortalProps> = ({ toasts, removeToast }) => {
  if (toasts.length === 0) return null;

  return ReactDOM.createPortal(
    <div
      style={{
        position: 'fixed',
        top: 24,
        right: 24,
        zIndex: 9999999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => {
        const accent = toastAccent(t.type);
        return (
          <div
            key={t.id}
            style={{
              pointerEvents: 'auto',
              minWidth: 280,
              maxWidth: 420,
              padding: '12px 18px',
              borderRadius: 'var(--kcs-radius-panel)',
              background: 'var(--kcs-bg-surface)',
              border: `1px solid ${accent}`,
              boxShadow: 'var(--kcs-shadow-card)',
              color: 'var(--kcs-text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {t.type === 'success' && <CheckCircle2 size={18} className="text-teal" style={{ color: accent }} />}
              {t.type === 'error' && <AlertCircle size={18} className="text-red" style={{ color: accent }} />}
              {t.type === 'info' && <Sparkles size={18} className="text-cyan" style={{ color: accent }} />}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {t.title && <span style={{ fontSize: 13, fontWeight: 700 }}>{t.title}</span>}
                <span style={{ fontSize: t.title ? 12 : 13, fontWeight: t.title ? 600 : 700, opacity: t.title ? 0.92 : 1 }}>
                  {t.message}
                </span>
                {t.action && <span style={{ fontSize: 11.5, fontWeight: 600, color: accent }}>{t.action}</span>}
              </div>
            </div>
            <button
              className="btn-icon"
              onClick={() => removeToast(t.id)}
              style={{ width: 22, height: 22, padding: 0 }}
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>,
    document.body
  );
};

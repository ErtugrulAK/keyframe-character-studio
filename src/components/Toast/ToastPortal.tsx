import React from 'react';
import ReactDOM from 'react-dom';
import { CheckCircle2, AlertCircle, Sparkles, X } from 'lucide-react';
import type { ToastItem } from '../../context/AnimatorContext';

interface ToastPortalProps {
  toasts: ToastItem[];
  removeToast: (id: string) => void;
}

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
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            pointerEvents: 'auto',
            minWidth: 280,
            maxWidth: 420,
            padding: '12px 18px',
            borderRadius: 12,
            background: 'var(--bg-panel)',
            border: `1px solid ${
              t.type === 'success'
                ? 'var(--accent-teal)'
                : t.type === 'error'
                ? '#f43f5e'
                : '#00d2ff'
            }`,
            boxShadow: `0 12px 35px rgba(0,0,0,0.7), 0 0 20px ${
              t.type === 'success'
                ? 'var(--accent-teal-glow)'
                : t.type === 'error'
                ? 'rgba(244, 63, 94, 0.3)'
                : 'rgba(0, 210, 255, 0.3)'
            }`,
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {t.type === 'success' && <CheckCircle2 size={18} className="text-teal" />}
            {t.type === 'error' && <AlertCircle size={18} className="text-red" />}
            {t.type === 'info' && <Sparkles size={18} className="text-cyan" />}
            <span style={{ fontSize: 13, fontWeight: 700 }}>{t.message}</span>
          </div>
          <button
            className="btn-icon"
            onClick={() => removeToast(t.id)}
            style={{ width: 22, height: 22, padding: 0 }}
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
};

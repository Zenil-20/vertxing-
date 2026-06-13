/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/lib/toast-context.tsx
 * Layer:   Web / Client state (feedback)
 * Purpose: App-wide toasts so EVERY async action gives feedback (the gap the
 *          product was missing). `useToast().show(msg, 'success' | 'error')`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Check } from 'lucide-react';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type ToastKind = 'success' | 'error' | 'info';
interface Toast {
  id: string;
  message: string;
  kind: ToastKind;
}
interface ToastContextValue {
  show: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((t) => [...t, { id, message, kind }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        style={{
          position: 'fixed',
          bottom: 22,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 120,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          alignItems: 'center',
          pointerEvents: 'none',
        }}
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 14 }}
              className="glass"
              style={{
                padding: '10px 16px',
                borderRadius: 999,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14,
                maxWidth: '90vw',
                borderColor:
                  t.kind === 'error'
                    ? 'rgba(255,93,115,0.4)'
                    : t.kind === 'success'
                      ? 'rgba(52,224,168,0.4)'
                      : 'var(--border)',
              }}
            >
              {t.kind === 'success' && <Check size={15} color="var(--success)" />}
              {t.kind === 'error' && <AlertCircle size={15} color="var(--danger)" />}
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/lib/dialog-context.tsx
 * Layer:   Web / Client state (feedback)
 * Purpose: A clean, in-app confirm dialog that REPLACES browser-native
 *          `window.confirm` ("localhost:3000 says…"). Rendered as a single
 *          position:fixed overlay, so it NEVER shifts layout or bleeds its
 *          shadow onto other components. `useDialog().confirm(opts)` returns a
 *          Promise<boolean>. Esc cancels, Enter confirms, backdrop-click cancels.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface DialogContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextValue | undefined>(undefined);

interface DialogState extends ConfirmOptions {
  id: number;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);
  const counter = useRef(0);

  const close = useCallback((result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setDialog(null);
  }, []);

  const confirm = useCallback((opts: ConfirmOptions) => {
    counter.current += 1;
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setDialog({ ...opts, id: counter.current });
    });
  }, []);

  useEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter') close(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, close]);

  return (
    <DialogContext.Provider value={{ confirm }}>
      {children}
      <AnimatePresence>
        {dialog && (
          <motion.div
            key={dialog.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => close(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
              background: 'rgba(3,4,9,0.6)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.97, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="card"
              style={{ width: 384, maxWidth: '92vw', padding: 24 }}
            >
              <h3 style={{ marginBottom: dialog.message ? 8 : 18 }}>{dialog.title}</h3>
              {dialog.message && (
                <p className="muted" style={{ marginBottom: 20, fontSize: 14 }}>{dialog.message}</p>
              )}
              <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => close(false)}>
                  {dialog.cancelLabel ?? 'Cancel'}
                </button>
                <button
                  className={`btn btn-sm ${dialog.danger ? 'btn-danger' : ''}`}
                  onClick={() => close(true)}
                  autoFocus
                >
                  {dialog.confirmLabel ?? 'Confirm'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used within a DialogProvider');
  return ctx;
}

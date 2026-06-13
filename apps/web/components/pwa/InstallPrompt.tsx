/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/components/pwa/InstallPrompt.tsx
 * Layer:   Web / PWA
 * Purpose: A floating "Install app" button. Captures the browser's
 *          `beforeinstallprompt` event and surfaces a one-tap install, so users
 *          add Vertxing to their home screen without hunting through the menu.
 *          Renders nothing on platforms that don't offer the event (e.g. iOS
 *          Safari, where install is via the Share sheet → Add to Home Screen).
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setDeferred(null));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!deferred) return null;

  return (
    <button
      className="btn btn-sm"
      style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 80 }}
      onClick={async () => {
        await deferred.prompt();
        setDeferred(null);
      }}
    >
      <Download size={15} /> Install app
    </button>
  );
}

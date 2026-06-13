/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/components/call/ReactionsOverlay.tsx
 * Layer:   Web / Call UI
 * Purpose: The floating-emoji layer. Pointer-events-none so it never blocks the
 *          call; each reaction drifts up and fades, then `useReactions` removes
 *          it from state. Purely presentational.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { FloatingReaction } from './useReactions';

export function ReactionsOverlay({ reactions }: { reactions: FloatingReaction[] }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 25 }}>
      <AnimatePresence>
        {reactions.map((r) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 0, scale: 0.5 }}
            animate={{ opacity: 1, y: -240, scale: 1.25 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 3.1, ease: 'easeOut' }}
            style={{ position: 'absolute', bottom: 24, left: `${r.x}%`, fontSize: 36 }}
          >
            {r.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

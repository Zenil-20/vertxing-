/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/components/call/useReactions.ts
 * Layer:   Web / Call UI (hook)
 * Purpose: Emoji reactions over LiveKit's data channel. Encapsulates the topic,
 *          encode/decode, the ephemeral floating-reaction state, and a
 *          `sendReaction` that BOTH broadcasts and shows locally (LiveKit doesn't
 *          echo your own data messages back to you). Reactions auto-expire.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import { useDataChannel } from '@livekit/components-react';
import { useCallback, useState } from 'react';

const REACTIONS_TOPIC = 'reactions';
const LIFETIME_MS = 3200;

export interface FloatingReaction {
  id: string;
  emoji: string;
  /** Horizontal start position as a viewport-relative percentage. */
  x: number;
}

export function useReactions() {
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);

  const spawn = useCallback((emoji: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const x = 12 + Math.random() * 76;
    setReactions((prev) => [...prev, { id, emoji, x }]);
    window.setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, LIFETIME_MS);
  }, []);

  const { send } = useDataChannel(REACTIONS_TOPIC, (msg) => {
    try {
      const parsed: unknown = JSON.parse(new TextDecoder().decode(msg.payload));
      const emoji = (parsed as { emoji?: unknown })?.emoji;
      // Validate: a short string only — never trust the wire.
      if (typeof emoji === 'string' && emoji.length > 0 && emoji.length <= 8) {
        spawn(emoji);
      }
    } catch {
      // Ignore malformed payloads.
    }
  });

  const sendReaction = useCallback(
    (emoji: string) => {
      spawn(emoji);
      // Unreliable delivery is fine for ephemeral reactions (lower latency).
      send(new TextEncoder().encode(JSON.stringify({ emoji })), { reliable: false });
    },
    [send, spawn],
  );

  return { reactions, sendReaction };
}

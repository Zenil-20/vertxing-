/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/components/brand/Logo.tsx
 * Layer:   Web / Brand
 * Purpose: The wordmark — a gradient orb + "Vertxing". One component so the
 *          brand is identical on every surface (auth, dashboard, call header).
 * ─────────────────────────────────────────────────────────────────────────────
 */

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
      <span
        aria-hidden
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.32,
          background: 'var(--grad-brand)',
          boxShadow: '0 4px 14px -2px rgba(124, 92, 255, 0.7)',
        }}
      />
      <span style={{ fontWeight: 800, fontSize: size * 0.86, letterSpacing: '-0.02em' }}>
        Vert<span className="gradient-text">xing</span>
      </span>
    </span>
  );
}

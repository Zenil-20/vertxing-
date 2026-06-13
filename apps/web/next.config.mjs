// Vertxing — Real-Time Video Meeting Platform
// ─────────────────────────────────────────────────────────────────────────────
// File:    apps/web/next.config.mjs
// Layer:   Build / Tooling
// Purpose: Next.js configuration. `transpilePackages` tells Next to compile the
//          workspace `@vertxing/shared` package from source, so the web client
//          and API share one typed contract with no separate prebuild step.
// ─────────────────────────────────────────────────────────────────────────────

/** @type {import('next').NextConfig} */
const nextConfig = {
  // StrictMode double-invokes effects in dev, which races LiveKit's room/track
  // lifecycle (the `updatePages()` "element not part of the array" error). The
  // SFU connection is a single long-lived side effect, so we opt out here.
  reactStrictMode: false,
  transpilePackages: ['@vertxing/shared'],
};

export default nextConfig;

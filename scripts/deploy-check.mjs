/**
 * Vertxing — live-services connectivity check (run with the prod env vars set).
 * Verifies the deployed backend's dependencies are reachable & credentials valid:
 * Upstash Redis (PING), LiveKit Cloud (auth + token mint). Reads from process.env.
 */
import Redis from 'ioredis';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

const ok = (l, d = '') => console.log(`  ✓ ${l}${d ? ` — ${d}` : ''}`);

try {
  // ── Upstash Redis ──
  const r = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 8000 });
  const pong = await r.ping();
  if (pong !== 'PONG') throw new Error('Redis PING returned ' + pong);
  ok('Upstash Redis reachable (PING → PONG)');
  await r.quit();

  // ── LiveKit Cloud ──
  const httpUrl = process.env.LIVEKIT_URL.replace(/^ws/, 'http');
  const svc = new RoomServiceClient(httpUrl, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
  const rooms = await svc.listRooms();
  ok('LiveKit Cloud key/secret valid', `${rooms.length} active room(s)`);

  const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, { identity: 'connectivity-test' });
  at.addGrant({ room: 'connectivity-test', roomJoin: true });
  const jwt = await at.toJwt();
  ok('LiveKit token minting works', `${jwt.length} chars`);

  console.log('\nLIVE SERVICES OK ✅');
  process.exit(0);
} catch (e) {
  console.error('\nCONNECTIVITY CHECK FAILED ❌\n  ' + e.message);
  process.exit(1);
}

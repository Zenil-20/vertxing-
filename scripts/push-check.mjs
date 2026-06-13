/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    scripts/push-check.mjs
 * Layer:   Tooling / Web Push wiring check (safe on a USED db)
 * Purpose: Prove the background-call wiring WITHOUT a real device: confirm the
 *          server exposes a VAPID public key, register a (fake) push subscription
 *          for an OFFLINE callee, then have an online caller invite them — and
 *          assert the call RINGS (push path) instead of failing "offline". The
 *          actual notification delivery needs a real Android device + HTTPS.
 *          Run:  node scripts/push-check.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { spawnSync } from 'node:child_process';
import { io } from 'socket.io-client';

const BASE = 'http://localhost:4000/api';
const ORIGIN = 'http://localhost:4000';
const ok = (l, d = '') => console.log(`  ✓ ${l}${d ? ` — ${d}` : ''}`);

function sql(q) {
  const r = spawnSync('docker', ['exec', 'vertxing-postgres', 'psql', '-U', 'vertxing', '-d', 'vertxing', '-c', q], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('psql failed: ' + (r.stderr || r.stdout));
}

async function http(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = res.status === 204 ? { success: true, data: null } : await res.json();
  return { ok: json.success, status: res.status, data: json.data, error: json.error };
}

async function reg(label) {
  const r = await http('/auth/register', { method: 'POST', body: { email: `${label}+${Date.now()}-${Math.random().toString(36).slice(2, 6)}@vx.dev`, password: 'supersecret123', displayName: label } });
  if (!r.ok) throw new Error(`${label} register failed (seat full?): ` + JSON.stringify(r.error));
  return { id: r.data.user.id, token: r.data.tokens.accessToken };
}

const sock = (t) => io(ORIGIN, { auth: { token: t }, transports: ['websocket'], forceNew: true });
const connected = (s) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('connect timeout')), 6000); s.once('connect', () => { clearTimeout(t); res(); }); });

async function main() {
  console.log('Vertxing Web Push wiring check against', ORIGIN);

  const caller = await reg('PushCaller');
  const callee = await reg('PushCallee'); // stays OFFLINE (no socket)

  try {
    // 1) Server exposes a VAPID public key (push is configured).
    const key = await http('/push/public-key', { token: caller.token });
    if (!key.ok || !key.data.publicKey) throw new Error('no VAPID public key — push not configured');
    ok('server exposes a VAPID public key (push enabled)', `${key.data.publicKey.slice(0, 12)}…`);

    // 2) Register a (fake) push subscription for the offline callee.
    const sub = await http('/push/subscribe', {
      method: 'POST',
      token: callee.token,
      body: {
        endpoint: `https://fcm.googleapis.com/fcm/send/vertxing-test-${Date.now()}`,
        keys: { p256dh: 'BJx? '.repeat(0) + 'BNcRGZ1xQ2k7l3mD8fVpQwErTyUiOpAsDfGhJkLzXcVbNm1234567890abcdEFGHijklMNOpqrstUVWXyz09', auth: 'k9Xq2wErTyUiOpAsDf12' },
      },
    });
    if (sub.status !== 204) throw new Error('subscribe failed: ' + JSON.stringify(sub.error));
    ok('offline callee has a push subscription registered');

    // 3) Caller (granted) invites the OFFLINE callee → should RING (push path),
    //    not fail "offline".
    sql(`UPDATE "users" SET "callsEnabled" = true WHERE id = '${caller.id}'`);
    const s = sock(caller.token);
    await connected(s);

    const outcome = await new Promise((resolve) => {
      const t = setTimeout(() => resolve({ kind: 'timeout' }), 6000);
      s.once('call:ringing', () => { clearTimeout(t); resolve({ kind: 'ringing' }); });
      s.once('call:failed', (p) => { clearTimeout(t); resolve({ kind: 'failed', reason: p.reason }); });
      s.emit('call:invite', { calleeId: callee.id, mode: 'AUDIO' });
    });
    s.close();

    if (outcome.kind !== 'ringing') {
      throw new Error(`expected the call to RING via push, got: ${JSON.stringify(outcome)}`);
    }
    ok('invite to an OFFLINE-but-subscribed callee RINGS (push path, not "offline")');
  } finally {
    sql(`DELETE FROM users WHERE id IN ('${caller.id}', '${callee.id}')`);
    ok('cleaned up temp users (cascades push subscriptions)');
  }

  console.log('\nWEB PUSH WIRING CHECK PASSED ✅  (device delivery needs a real Android phone over HTTPS)');
  process.exit(0);
}

main().catch((e) => {
  console.error('\nPUSH CHECK FAILED ❌\n  ' + e.message);
  process.exit(1);
});

/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    scripts/call-signaling-check.mjs
 * Layer:   Tooling / Call signaling + token-lifetime check (safe on a USED db)
 * Purpose: After the "calls die at 15s" report, prove the signaling is intact AND
 *          that nothing in the SERVER expires the session early: register 2 temp
 *          users, invite → accept → both get a LiveKit token, and decode the token
 *          to confirm its lifetime is HOURS (not 15s). Hang up, then delete the
 *          temp users. Uses 2 seats transiently and cleans up.
 *          Run:  node scripts/call-signaling-check.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { spawnSync } from 'node:child_process';
import { io } from 'socket.io-client';

const BASE = 'http://localhost:4000/api';
const ORIGIN = 'http://localhost:4000';
const ok = (l, d = '') => console.log(`  ✓ ${l}${d ? ` — ${d}` : ''}`);

function sql(q) {
  const r = spawnSync(
    'docker',
    ['exec', 'vertxing-postgres', 'psql', '-U', 'vertxing', '-d', 'vertxing', '-c', q],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) throw new Error('psql failed: ' + (r.stderr || r.stdout));
}

async function reg(label) {
  const r = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `${label}+${Date.now()}-${Math.random().toString(36).slice(2, 6)}@vx.dev`, password: 'supersecret123', displayName: label }),
  });
  const j = await r.json();
  if (!j.success) throw new Error(`${label} register failed (seat full?): ` + JSON.stringify(j.error));
  sql(`UPDATE "users" SET "callsEnabled" = true WHERE id = '${j.data.user.id}'`);
  return { id: j.data.user.id, token: j.data.tokens.accessToken };
}

const sock = (t) => io(ORIGIN, { auth: { token: t }, transports: ['websocket'], forceNew: true });
const connected = (s) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('connect timeout')), 6000); s.once('connect', () => { clearTimeout(t); res(); }); });
const once = (s, ev, ms = 6000) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error(`timeout ${ev}`)), ms); s.once(ev, (p) => { clearTimeout(t); res(p); }); });

function tokenLifetimeSeconds(jwt) {
  const p = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
  const start = p.nbf ?? p.iat;
  return p.exp && start ? p.exp - start : 0;
}

async function main() {
  console.log('Vertxing call signaling + token-lifetime check against', ORIGIN);
  const A = await reg('SigA');
  const B = await reg('SigB');
  const sA = sock(A.token);
  const sB = sock(B.token);

  try {
    await Promise.all([connected(sA), connected(sB)]);

    const incomingP = once(sB, 'call:incoming');
    const ringingP = once(sA, 'call:ringing');
    sA.emit('call:invite', { calleeId: B.id, mode: 'AUDIO' });
    const [incoming] = await Promise.all([incomingP, ringingP]);
    ok('invite → callee rings, caller gets ringback');

    const accA = once(sA, 'call:accepted');
    const accB = once(sB, 'call:accepted');
    sB.emit('call:accept', { callId: incoming.callId });
    const [aA, aB] = await Promise.all([accA, accB]);
    if (!aA.livekit?.token || !aB.livekit?.token) throw new Error('missing LiveKit token on accept');
    ok('accept → both sides receive a LiveKit token');

    const life = tokenLifetimeSeconds(aA.livekit.token);
    if (life < 600) throw new Error(`token lifetime too short: ${life}s (would drop the call early)`);
    ok('LiveKit token lifetime is long — no early server-side expiry', `${Math.round(life / 3600)}h`);

    const endedP = once(sB, 'call:ended');
    sA.emit('call:hangup', { callId: incoming.callId });
    const ended = await endedP;
    if (ended.reason !== 'ENDED') throw new Error(`expected ENDED on hangup, got ${ended.reason}`);
    ok('hangup → the other side is cleanly notified (ENDED)');
  } finally {
    sA.close();
    sB.close();
    sql(`DELETE FROM users WHERE id IN ('${A.id}', '${B.id}')`);
    ok('cleaned up temp users');
  }

  console.log('\nCALL SIGNALING + TOKEN-LIFETIME CHECK PASSED ✅');
  process.exit(0);
}

main().catch((e) => {
  console.error('\nSIGNALING CHECK FAILED ❌\n  ' + e.message);
  process.exit(1);
});

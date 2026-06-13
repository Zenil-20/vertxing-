/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    scripts/call-auth-check.mjs
 * Layer:   Tooling / Authorization live-enforcement check (safe on a USED db)
 * Purpose: Prove the LOCKED-BY-DEFAULT call gate end-to-end without disturbing
 *          real data: register ONE temp user, confirm they're locked (no
 *          calls.start, /admin/users → 403, invite → "unauthorized"), grant call
 *          access IN THE DB, confirm the SAME socket can now place a call (it gets
 *          past auth and fails later at "offline"), then DELETE the temp user.
 *          Run:  node scripts/call-auth-check.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { spawnSync } from 'node:child_process';
import { io } from 'socket.io-client';

const BASE = 'http://localhost:4000/api';
const ORIGIN = 'http://localhost:4000';
const FAKE_CALLEE = '00000000-0000-0000-0000-000000000000'; // never online

const ok = (l, d = '') => console.log(`  ✓ ${l}${d ? ` — ${d}` : ''}`);

function sql(q) {
  const r = spawnSync(
    'docker',
    ['exec', 'vertxing-postgres', 'psql', '-U', 'vertxing', '-d', 'vertxing', '-c', q],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) throw new Error('psql failed: ' + (r.stderr || r.stdout));
  return r.stdout;
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

function sock(token) {
  return io(ORIGIN, { auth: { token }, transports: ['websocket'], forceNew: true });
}
function connected(s) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('connect timeout')), 6000);
    s.once('connect', () => { clearTimeout(t); res(); });
  });
}
function once(s, event, ms = 6000) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(`timeout waiting for ${event}`)), ms);
    s.once(event, (p) => { clearTimeout(t); res(p); });
  });
}

async function main() {
  console.log('Vertxing call-authorization live check against', BASE);

  const email = `tmpcall+${Date.now()}@vx.dev`;
  const reg = await http('/auth/register', {
    method: 'POST',
    body: { email, password: 'supersecret123', displayName: 'TmpCall' },
  });
  if (!reg.ok) throw new Error('temp register failed (seat full?): ' + JSON.stringify(reg.error));
  const token = reg.data.tokens.accessToken;
  const id = reg.data.user.id;

  try {
    // 1) A fresh account is LOCKED.
    if (reg.data.user.callsEnabled !== false) throw new Error('new user should be callsEnabled=false');
    if ((reg.data.user.permissions || []).includes('calls.start')) {
      throw new Error('new user must NOT have calls.start');
    }
    ok('new account is locked (callsEnabled=false, no calls.start)');

    // 2) The HTTP permission guard denies a non-manager.
    const adminList = await http('/admin/users', { token });
    if (adminList.status !== 403) throw new Error(`expected 403 on /admin/users, got ${adminList.status}`);
    ok('PermissionGuard denies /admin/users for a USER (403)');

    // 3) The socket invite is refused with "unauthorized".
    const s = sock(token);
    await connected(s);
    const failedP = once(s, 'call:failed');
    s.emit('call:invite', { calleeId: FAKE_CALLEE, mode: 'AUDIO' });
    const failed = await failedP;
    if (failed.reason !== 'unauthorized') {
      s.close();
      throw new Error(`expected "unauthorized", got "${failed.reason}"`);
    }
    ok('locked user invite → "unauthorized"');

    // 4) Grant call access in the DB; the SAME socket now passes the gate.
    sql(`UPDATE "users" SET "callsEnabled" = true WHERE id = '${id}'`);
    const failed2P = once(s, 'call:failed');
    s.emit('call:invite', { calleeId: FAKE_CALLEE, mode: 'AUDIO' });
    const failed2 = await failed2P;
    s.close();
    if (failed2.reason !== 'offline') {
      throw new Error(`after grant, expected to pass auth and fail at "offline", got "${failed2.reason}"`);
    }
    ok('granted user passes auth (now fails at "offline" — live re-read, no token refresh)');
  } finally {
    sql(`DELETE FROM users WHERE id = '${id}'`);
    ok('cleaned up the temp user');
  }

  console.log('\nCALL-AUTHORIZATION LIVE CHECK PASSED ✅');
  process.exit(0);
}

main().catch((e) => {
  console.error('\nCALL-AUTH CHECK FAILED ❌\n  ' + e.message);
  process.exit(1);
});

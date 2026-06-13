/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    scripts/smoke.mjs
 * Layer:   Tooling / End-to-end smoke test
 * Purpose: Exercise the full happy path against a running API to prove the
 *          backend works end-to-end: register → /users/me → create meeting →
 *          join (which mints a LiveKit SFU token). Run with:  node scripts/smoke.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { io } from 'socket.io-client';

const BASE = process.env.SMOKE_API_URL ?? 'http://localhost:4000/api';
const ORIGIN = BASE.replace(/\/api$/, '');

async function call(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = res.status === 204 ? { success: true, data: null } : await res.json();
  if (!json.success) {
    throw new Error(`${method} ${path} → ${res.status} ${json.error?.code}: ${json.error?.message}`);
  }
  return json.data;
}

function ok(label, detail = '') {
  console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  console.log('Vertxing smoke test against', BASE);

  const health = await call('/health');
  ok('health', health.status);

  const email = `smoke+${Date.now()}@vertxing.dev`;
  const reg = await call('/auth/register', {
    method: 'POST',
    body: { email, password: 'supersecret123', displayName: 'Smoke Tester' },
  });
  ok('register', `${reg.user.email} (role ${reg.user.role})`);
  const token = reg.tokens.accessToken;

  const me = await call('/users/me', { token });
  ok('GET /users/me', me.displayName);

  const meeting = await call('/meetings', {
    method: 'POST',
    token,
    body: { title: 'Smoke Test Meeting' },
  });
  ok('create meeting', meeting.roomName);

  const joined = await call(`/meetings/${meeting.roomName}/join`, { method: 'POST', token });
  ok('join → SFU token', `role ${joined.role}, lk url ${joined.livekit.url}, token ${joined.livekit.accessToken.slice(0, 12)}…`);

  // Scheduling + host controls (RBAC-guarded)
  const scheduled = await call('/meetings', {
    method: 'POST',
    token,
    body: { title: 'Scheduled Standup', scheduledStartAt: new Date(Date.now() + 3600_000).toISOString() },
  });
  ok('schedule meeting', scheduled.scheduledStartAt);

  const rescheduled = await call(`/meetings/${scheduled.roomName}`, {
    method: 'PATCH',
    token,
    body: { scheduledStartAt: new Date(Date.now() + 7200_000).toISOString() },
  });
  ok('reschedule', rescheduled.scheduledStartAt);

  const cancelled = await call(`/meetings/${scheduled.roomName}/cancel`, { method: 'POST', token });
  ok('cancel', cancelled.status);

  // ── Waiting room: gate a guest, then admit over the WebSocket gateway ──────
  const gated = await call('/meetings', {
    method: 'POST',
    token,
    body: { title: 'Gated Room', waitingRoomEnabled: true },
  });
  ok('create waiting-room meeting', `waitingRoom=${gated.waitingRoomEnabled}`);

  const guest = await call('/auth/register', {
    method: 'POST',
    body: { email: `guest+${Date.now()}@vertxing.dev`, password: 'supersecret123', displayName: 'Guest User' },
  });
  const guestToken = guest.tokens.accessToken;

  const guestWaiting = await call(`/meetings/${gated.roomName}/join`, { method: 'POST', token: guestToken });
  if (guestWaiting.status !== 'WAITING') throw new Error(`expected WAITING, got ${guestWaiting.status}`);
  ok('guest join → WAITING', guestWaiting.status);

  const hostBypass = await call(`/meetings/${gated.roomName}/join`, { method: 'POST', token });
  if (hostBypass.status !== 'ADMITTED') throw new Error('host should bypass the waiting room');
  ok('host join → ADMITTED (bypass)', hostBypass.status);

  // Drive the realtime admission handshake.
  await new Promise((resolve, reject) => {
    const hostSocket = io(ORIGIN, { auth: { token }, transports: ['websocket'] });
    const guestSocket = io(ORIGIN, { auth: { token: guestToken }, transports: ['websocket'] });
    const timer = setTimeout(() => {
      hostSocket.close();
      guestSocket.close();
      reject(new Error('waiting-room admit handshake timed out'));
    }, 8000);

    guestSocket.on('meeting:admitted', () => {
      clearTimeout(timer);
      hostSocket.close();
      guestSocket.close();
      resolve();
    });
    hostSocket.on('connect', () => hostSocket.emit('meeting:host-watch', { roomName: gated.roomName }));
    hostSocket.on('meeting:waiting-list', (p) => {
      const knocker = p.waiting.find((w) => w.identity === guest.user.id);
      if (knocker) hostSocket.emit('meeting:admit', { roomName: gated.roomName, identity: knocker.identity });
    });
    guestSocket.on('connect', () => guestSocket.emit('meeting:knock', { roomName: gated.roomName }));
  });
  ok('WS knock → host admit → guest admitted');

  const guestAdmitted = await call(`/meetings/${gated.roomName}/join`, { method: 'POST', token: guestToken });
  if (guestAdmitted.status !== 'ADMITTED') throw new Error('admitted guest should now get a token');
  ok('guest re-join → ADMITTED', guestAdmitted.status);

  // SECURITY: a removed guest must NOT be able to silently re-join.
  await call(`/meetings/${gated.roomName}/participants/remove`, {
    method: 'POST',
    token,
    body: { identity: guest.user.id },
  });
  let blocked = false;
  try {
    await call(`/meetings/${gated.roomName}/join`, { method: 'POST', token: guestToken });
  } catch (e) {
    blocked = /removed|forbidden/i.test(e.message);
  }
  if (!blocked) throw new Error('SECURITY: removed guest was able to re-join');
  ok('removed guest blocked from re-join');

  console.log('\nALL CHECKS PASSED ✅');
}

main().catch((err) => {
  console.error('\nSMOKE TEST FAILED ❌\n ', err.message);
  process.exit(1);
});

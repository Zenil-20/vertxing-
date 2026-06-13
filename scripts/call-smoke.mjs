/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    scripts/call-smoke.mjs
 * Layer:   Tooling / Direct-Call race test
 * Purpose: Exercise the call signaling state machine against a running API,
 *          focusing on the RACE-CRITICAL paths the design promised to handle:
 *            • invite → accept → both sides get a token
 *            • decline
 *            • double-accept (only one wins; the other is "gone")
 *            • glare (A↔B at once → exactly one "busy")
 *            • caller drop while ringing → callee told it ended
 *            • offline callee → "offline"
 *          Run with:  node scripts/call-smoke.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { spawnSync } from 'node:child_process';
import { io } from 'socket.io-client';

const BASE = 'http://localhost:4000/api';
const ORIGIN = 'http://localhost:4000';

// Calls are LOCKED by default now (authorization gate). These throwaway test
// users need call access granted before they can place a call — set it straight
// in the DB (args array avoids shell-quoting the mixed-case "callsEnabled").
function grantCalls(id) {
  const r = spawnSync(
    'docker',
    ['exec', 'vertxing-postgres', 'psql', '-U', 'vertxing', '-d', 'vertxing', '-c',
      `UPDATE "users" SET "callsEnabled" = true WHERE id = '${id}'`],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) throw new Error('grantCalls psql failed: ' + (r.stderr || r.stdout));
}

let nonce = 0;
async function reg(label) {
  nonce += 1;
  const r = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `${label}+${Date.now()}-${nonce}@vertxing.dev`,
      password: 'supersecret123',
      displayName: label,
    }),
  });
  const j = await r.json();
  if (!j.success) throw new Error(`register failed: ${JSON.stringify(j.error)}`);
  grantCalls(j.data.user.id);
  return { id: j.data.user.id, token: j.data.tokens.accessToken };
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
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (label, detail = '') => console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);

/** Decode the LiveKit JWT's room claim to prove which room a token is for. */
function roomOf(token) {
  const json = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  return json.video?.room;
}

async function testAcceptFlow() {
  const A = await reg('Alice');
  const B = await reg('Bob');
  const sA = sock(A.token);
  const sB = sock(B.token);
  await Promise.all([connected(sA), connected(sB)]);

  const incomingP = once(sB, 'call:incoming');
  const ringingP = once(sA, 'call:ringing');
  sA.emit('call:invite', { calleeId: B.id, mode: 'AUDIO' });
  const [incoming] = await Promise.all([incomingP, ringingP]);
  if (incoming.from.id !== A.id) throw new Error('incoming.from.id mismatch');

  const accA = once(sA, 'call:accepted');
  const accB = once(sB, 'call:accepted');
  sB.emit('call:accept', { callId: incoming.callId });
  const [aA, aB] = await Promise.all([accA, accB]);
  if (!aA.livekit?.token || !aB.livekit?.token) throw new Error('missing tokens on accept');
  if (aA.callId !== incoming.callId) throw new Error('callId mismatch');

  ok('invite → accept → both sides get a LiveKit token');
  sA.close(); sB.close();
}

async function testDecline() {
  const A = await reg('Alice');
  const B = await reg('Bob');
  const sA = sock(A.token);
  const sB = sock(B.token);
  await Promise.all([connected(sA), connected(sB)]);

  const incomingP = once(sB, 'call:incoming');
  sA.emit('call:invite', { calleeId: B.id, mode: 'AUDIO' });
  const incoming = await incomingP;

  const endedP = once(sA, 'call:ended');
  sB.emit('call:decline', { callId: incoming.callId });
  const ended = await endedP;
  if (ended.reason !== 'DECLINED') throw new Error(`expected DECLINED, got ${ended.reason}`);

  ok('decline → caller notified (DECLINED)');
  sA.close(); sB.close();
}

async function testDoubleAccept() {
  const A = await reg('Alice');
  const B = await reg('Bob');
  const sA = sock(A.token);
  const sB = sock(B.token);
  await Promise.all([connected(sA), connected(sB)]);

  const incomingP = once(sB, 'call:incoming');
  sA.emit('call:invite', { calleeId: B.id, mode: 'AUDIO' });
  const incoming = await incomingP;

  const acceptedP = once(sB, 'call:accepted');
  const failedP = once(sB, 'call:failed');
  // Fire two accepts back-to-back — exactly one must win.
  sB.emit('call:accept', { callId: incoming.callId });
  sB.emit('call:accept', { callId: incoming.callId });
  const [, fail] = await Promise.all([acceptedP, failedP]);
  if (fail.reason !== 'gone') throw new Error(`expected second accept 'gone', got ${fail.reason}`);

  ok('double-accept → exactly one wins, other is "gone"');
  sA.close(); sB.close();
}

async function testGlare() {
  const A = await reg('Alice');
  const B = await reg('Bob');
  const sA = sock(A.token);
  const sB = sock(B.token);
  await Promise.all([connected(sA), connected(sB)]);

  const failures = [];
  sA.on('call:failed', (p) => failures.push(p));
  sB.on('call:failed', (p) => failures.push(p));

  // A calls B and B calls A at the same instant.
  sA.emit('call:invite', { calleeId: B.id, mode: 'AUDIO' });
  sB.emit('call:invite', { calleeId: A.id, mode: 'AUDIO' });
  await wait(900);

  const busy = failures.filter((f) => f.reason === 'busy');
  if (busy.length !== 1) throw new Error(`glare: expected exactly 1 busy, got ${busy.length}`);

  ok('glare (A↔B at once) → exactly one "busy", one call survives');
  sA.close(); sB.close();
}

async function testCallerDrop() {
  const A = await reg('Alice');
  const B = await reg('Bob');
  const sA = sock(A.token);
  const sB = sock(B.token);
  await Promise.all([connected(sA), connected(sB)]);

  const incomingP = once(sB, 'call:incoming');
  sA.emit('call:invite', { calleeId: B.id, mode: 'AUDIO' });
  await incomingP;

  const endedP = once(sB, 'call:ended');
  sA.close(); // caller drops while ringing
  const ended = await endedP;
  if (ended.reason !== 'CANCELLED') throw new Error(`expected CANCELLED on caller drop, got ${ended.reason}`);

  ok('caller drops while ringing → callee told it ended (CANCELLED)');
  sB.close();
}

async function testOffline() {
  const A = await reg('Alice');
  const C = await reg('Carol'); // never connects a socket
  const sA = sock(A.token);
  await connected(sA);

  const failedP = once(sA, 'call:failed');
  sA.emit('call:invite', { calleeId: C.id, mode: 'AUDIO' });
  const fail = await failedP;
  if (fail.reason !== 'offline') throw new Error(`expected offline, got ${fail.reason}`);

  ok('invite to an offline user → "offline"');
  sA.close();
}

async function testAddPerson() {
  const A = await reg('Alice');
  const B = await reg('Bob');
  const C = await reg('Carol');
  const sA = sock(A.token);
  const sB = sock(B.token);
  const sC = sock(C.token);
  await Promise.all([connected(sA), connected(sB), connected(sC)]);

  // Establish the A↔B call.
  const incomingB = once(sB, 'call:incoming');
  sA.emit('call:invite', { calleeId: B.id, mode: 'AUDIO' });
  const ib = await incomingB;
  const accA = once(sA, 'call:accepted');
  const accB = once(sB, 'call:accepted');
  sB.emit('call:accept', { callId: ib.callId });
  const [aA] = await Promise.all([accA, accB]);
  const roomAB = roomOf(aA.livekit.token);

  // A rings C into the call.
  const incomingC = once(sC, 'call:incoming');
  sA.emit('call:add', { callId: ib.callId, calleeId: C.id });
  const ic = await incomingC;
  const accC = once(sC, 'call:accepted');
  sC.emit('call:accept', { callId: ic.callId });
  const ac = await accC;
  const roomC = roomOf(ac.livekit.token);

  if (!roomC || roomC !== roomAB) {
    throw new Error(`add-person: C joined "${roomC}", expected the A↔B room "${roomAB}"`);
  }
  ok('add person → C rings, accepts, joins the SAME room (1:1 → group)', roomC);
  sA.close(); sB.close(); sC.close();
}

async function main() {
  console.log('Vertxing Direct-Call race test against', ORIGIN);
  await testAcceptFlow();
  await testDecline();
  await testDoubleAccept();
  await testGlare();
  await testCallerDrop();
  await testOffline();
  await testAddPerson();
  console.log('\nALL CALL CHECKS PASSED ✅');
  process.exit(0);
}

main().catch((err) => {
  console.error('\nCALL SMOKE FAILED ❌\n ', err.message);
  process.exit(1);
});

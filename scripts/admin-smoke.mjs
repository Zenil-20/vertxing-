/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    scripts/admin-smoke.mjs
 * Layer:   Tooling / RBAC test (run on a FRESH db)
 * Purpose: Prove the privilege model:
 *            • first account = SUPER_ADMIN
 *            • /admin/users is super-admin only (403 for a regular user)
 *            • promote/demote works
 *            • LIVE enforcement: a promoted user's OLD token gains access
 *              immediately (the guard reads the DB, not the stale JWT)
 *            • the LAST super-admin can't be demoted (no lock-out)
 *          Run:  node scripts/admin-smoke.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 */

const BASE = 'http://localhost:4000/api';

async function call(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = res.status === 204 ? { success: true, data: null } : await res.json();
  return { ok: json.success, status: res.status, data: json.data, error: json.error };
}
const ok = (l, d = '') => console.log(`  ✓ ${l}${d ? ` — ${d}` : ''}`);
const reg = (label) =>
  call('/auth/register', {
    method: 'POST',
    body: {
      email: `${label}+${Date.now()}-${Math.random().toString(36).slice(2, 6)}@vx.dev`,
      password: 'supersecret123',
      displayName: label,
    },
  });

async function main() {
  console.log('Vertxing admin/RBAC smoke (fresh DB) against', BASE);

  const owner = await reg('Owner');
  if (!owner.ok) throw new Error('owner register failed: ' + JSON.stringify(owner.error));
  const ownerTok = owner.data.tokens.accessToken;
  const ownerId = owner.data.user.id;
  if ((await call('/users/me', { token: ownerTok })).data.role !== 'SUPER_ADMIN') {
    throw new Error('first account should be SUPER_ADMIN');
  }
  ok('first account is SUPER_ADMIN');

  const u1 = await reg('User1');
  const u1Tok = u1.data.tokens.accessToken;
  const u1Id = u1.data.user.id;
  ok('regular user registered', u1.data.user.role);

  const list = await call('/admin/users', { token: ownerTok });
  if (!list.ok || list.data.length < 2) throw new Error('admin list failed');
  ok('super-admin lists users', `${list.data.length} accounts`);

  const forbidden = await call('/admin/users', { token: u1Tok });
  if (forbidden.status !== 403) throw new Error('regular user must be 403 on /admin/users');
  ok('regular user blocked from /admin/users (403)');

  const promote = await call(`/admin/users/${u1Id}`, { method: 'PATCH', token: ownerTok, body: { role: 'SUPER_ADMIN' } });
  if (!promote.ok || promote.data.role !== 'SUPER_ADMIN') throw new Error('promote failed: ' + JSON.stringify(promote.error));
  ok('promote User1 → SUPER_ADMIN');

  // The KEY test: U1's token still says USER, but the guard reads the DB.
  const live = await call('/admin/users', { token: u1Tok });
  if (!live.ok) throw new Error('LIVE enforcement failed — stale USER token should now pass (DB = SUPER_ADMIN)');
  ok('LIVE enforcement: promoted user gains access with old token');

  const demote = await call(`/admin/users/${u1Id}`, { method: 'PATCH', token: ownerTok, body: { role: 'USER' } });
  if (!demote.ok || demote.data.role !== 'USER') throw new Error('demote failed');
  ok('demote User1 → USER');

  const lastGuard = await call(`/admin/users/${ownerId}`, { method: 'PATCH', token: ownerTok, body: { role: 'USER' } });
  if (lastGuard.ok || !/last super-admin/i.test(lastGuard.error?.message || '')) {
    throw new Error('should refuse to demote the last super-admin: ' + JSON.stringify(lastGuard.error));
  }
  ok('cannot remove the last super-admin', `"${lastGuard.error.message}"`);

  console.log('\nALL ADMIN/RBAC CHECKS PASSED ✅');
  process.exit(0);
}

main().catch((e) => {
  console.error('\nADMIN SMOKE FAILED ❌\n  ' + e.message);
  process.exit(1);
});

/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    scripts/admin-live-check.mjs
 * Layer:   Tooling / RBAC live-enforcement check (safe on a USED db)
 * Purpose: Prove the SuperAdminGuard reads the role LIVE from the DB (not the
 *          JWT) without disturbing real data: register a temp user, confirm it's
 *          denied, promote it IN THE DB ONLY (token stays "USER"), confirm the
 *          same stale token now passes, then delete the temp user.
 *          Run:  node scripts/admin-live-check.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { execSync } from 'node:child_process';

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
const sql = (q) =>
  execSync(`docker exec vertxing-postgres psql -U vertxing -d vertxing -c "${q}"`, { stdio: 'pipe' }).toString();

async function main() {
  console.log('Vertxing RBAC live-enforcement check against', BASE);

  const email = `tmp+${Date.now()}@vx.dev`;
  const reg = await call('/auth/register', { method: 'POST', body: { email, password: 'supersecret123', displayName: 'Tmp' } });
  if (!reg.ok) throw new Error('temp register failed (license seat full?): ' + JSON.stringify(reg.error));
  const token = reg.data.tokens.accessToken;
  const id = reg.data.user.id;
  ok('temp user registered', reg.data.user.role);

  const denied = await call('/admin/users', { token });
  if (denied.status !== 403) throw new Error(`regular user must be 403 on /admin/users, got ${denied.status}`);
  ok('regular user denied /admin/users (403)');

  // Promote in the DB only — the JWT still says USER.
  sql(`UPDATE users SET role='SUPER_ADMIN' WHERE id='${id}'`);
  const live = await call('/admin/users', { token });
  if (!live.ok) {
    sql(`DELETE FROM users WHERE id='${id}'`);
    throw new Error('LIVE enforcement failed: a stale USER token should pass after a DB promotion');
  }
  ok('LIVE enforcement: same stale token now passes', `${live.data.length} users listed`);

  sql(`DELETE FROM users WHERE id='${id}'`);
  ok('cleaned up the temp user');

  console.log('\nRBAC LIVE-ENFORCEMENT VERIFIED ✅');
  process.exit(0);
}

main().catch((e) => {
  console.error('\nCHECK FAILED ❌\n  ' + e.message);
  process.exit(1);
});

/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    scripts/license-smoke.mjs
 * Layer:   Tooling / Licensing test (run on a FRESH db)
 * Purpose: Prove the license gate end-to-end:
 *            • first account becomes SUPER_ADMIN
 *            • default (free) tier status
 *            • generate → activate a key (tier + seats update live)
 *            • seat-full → registration blocked with LICENSE_LIMIT_REACHED
 *            • super-admin-only access to /license
 *          Run:  node scripts/license-smoke.mjs
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

const ok = (label, detail = '') => console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);

async function reg(label) {
  return call('/auth/register', {
    method: 'POST',
    body: {
      email: `${label}+${Date.now()}-${Math.random().toString(36).slice(2, 6)}@vx.dev`,
      password: 'supersecret123',
      displayName: label,
    },
  });
}

async function main() {
  console.log('Vertxing licensing smoke (fresh DB) against', BASE);

  const owner = await reg('Owner');
  if (!owner.ok) throw new Error('owner register failed: ' + JSON.stringify(owner.error));
  const ownerToken = owner.data.tokens.accessToken;

  const me = await call('/users/me', { token: ownerToken });
  if (me.data.role !== 'SUPER_ADMIN') throw new Error(`first user should be SUPER_ADMIN, got ${me.data.role}`);
  ok('first account is SUPER_ADMIN', me.data.role);

  const s1 = await call('/license/status', { token: ownerToken });
  if (!s1.ok) throw new Error('status failed: ' + JSON.stringify(s1.error));
  ok('default tier', `${s1.data.plan} seats=${s1.data.seats} used=${s1.data.used} default=${s1.data.isDefault}`);

  const gen = await call('/license/generate', { method: 'POST', token: ownerToken, body: { plan: 'BUSINESS' } });
  if (!gen.ok) throw new Error('generate failed: ' + JSON.stringify(gen.error));
  const act = await call('/license/activate', { method: 'POST', token: ownerToken, body: { key: gen.data.key } });
  if (!act.ok || act.data.plan !== 'BUSINESS') throw new Error('activate failed: ' + JSON.stringify(act.error));
  ok('activate BUSINESS key', `plan=${act.data.plan} seats=${act.data.seats} default=${act.data.isDefault}`);

  // Drop to a 1-seat license; the owner already fills it, so the next sign-up fails.
  const gen1 = await call('/license/generate', { method: 'POST', token: ownerToken, body: { plan: 'STARTER', seats: 1 } });
  await call('/license/activate', { method: 'POST', token: ownerToken, body: { key: gen1.data.key } });
  const blocked = await reg('Blocked');
  if (blocked.ok) throw new Error('registration should have been blocked at the seat limit');
  if (blocked.error?.code !== 'LICENSE_LIMIT_REACHED') {
    throw new Error(`expected LICENSE_LIMIT_REACHED, got ${blocked.error?.code}`);
  }
  ok('seat full → sign-up blocked', `"${blocked.error.message}"`);

  // Re-activate BUSINESS so the system is usable again.
  const gen2 = await call('/license/generate', { method: 'POST', token: ownerToken, body: { plan: 'BUSINESS' } });
  const reAct = await call('/license/activate', { method: 'POST', token: ownerToken, body: { key: gen2.data.key } });
  if (!reAct.ok || reAct.data.plan !== 'BUSINESS' || reAct.data.seats !== 250 || reAct.data.isDefault) {
    throw new Error('re-activate must yield active BUSINESS/250: ' + JSON.stringify(reAct.data ?? reAct.error));
  }
  const user2 = await reg('User2');
  if (!user2.ok) throw new Error('register after re-activate failed: ' + JSON.stringify(user2.error));
  ok('re-activate BUSINESS (250) → sign-up works again', `seats=${reAct.data.seats}`);

  const forbidden = await call('/license/status', { token: user2.data.tokens.accessToken });
  if (forbidden.ok || forbidden.status !== 403) throw new Error('regular user must be forbidden from /license');
  ok('regular user blocked from /license (super-admin only)');

  console.log('\nALL LICENSE CHECKS PASSED ✅');
  process.exit(0);
}

main().catch((e) => {
  console.error('\nLICENSE SMOKE FAILED ❌\n  ' + e.message);
  process.exit(1);
});

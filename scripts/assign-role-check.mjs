/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    scripts/assign-role-check.mjs
 * Layer:   Tooling / Role-assignment endpoint check (safe on a USED db)
 * Purpose: Reproduce the real admin flow that 400'd: PATCH /admin/users/:id with
 *          { customRoleId }. Promote a temp actor to ADMIN in the DB, create a
 *          custom role in the DB, then assign / clear / switch via the HTTP
 *          endpoint and confirm each succeeds. Cleans up everything.
 *          Run:  node scripts/assign-role-check.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const BASE = 'http://localhost:4000/api';
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

async function reg(label) {
  const r = await http('/auth/register', {
    method: 'POST',
    body: { email: `${label}+${Date.now()}-${Math.random().toString(36).slice(2, 6)}@vx.dev`, password: 'supersecret123', displayName: label },
  });
  if (!r.ok) throw new Error(`${label} register failed (seat full?): ` + JSON.stringify(r.error));
  return { id: r.data.user.id, token: r.data.tokens.accessToken };
}

async function main() {
  console.log('Vertxing role-assignment endpoint check against', BASE);

  const actor = await reg('Actor');
  const target = await reg('Target');
  const roleId = randomUUID();

  try {
    // Promote the actor to ADMIN in the DB (its token still says USER; guard reads live).
    sql(`UPDATE users SET role = 'ADMIN' WHERE id = '${actor.id}'`);
    sql(
      `INSERT INTO roles (id, name, key, permissions, "defaultLanding", "createdAt", "updatedAt") ` +
        `VALUES ('${roleId}', 'Assign Check', 'assign-check-${Date.now()}', '{"calls.start"}', '/app', now(), now())`,
    );

    // 1) Assign the custom role via the HTTP endpoint (the call that used to 400).
    const assign = await http(`/admin/users/${target.id}`, { method: 'PATCH', token: actor.token, body: { customRoleId: roleId } });
    if (!assign.ok) throw new Error('assign custom role failed: ' + JSON.stringify(assign.error));
    if (assign.data.customRole?.id !== roleId) throw new Error('response missing the assigned customRole');
    if (assign.data.role !== 'USER') throw new Error('assigned user should drop to USER tier, got ' + assign.data.role);
    ok('PATCH { customRoleId } assigns the custom role (200)');

    // 2) Clear it back to the built-in role with null.
    const clear = await http(`/admin/users/${target.id}`, { method: 'PATCH', token: actor.token, body: { customRoleId: null } });
    if (!clear.ok) throw new Error('clear custom role failed: ' + JSON.stringify(clear.error));
    if (clear.data.customRole !== null) throw new Error('customRole should be null after clear');
    ok('PATCH { customRoleId: null } reverts to the built-in role (200)');

    // 3) A built-in role change still works (and clears any overlay).
    const builtin = await http(`/admin/users/${target.id}`, { method: 'PATCH', token: actor.token, body: { role: 'ADMIN' } });
    if (!builtin.ok || builtin.data.role !== 'ADMIN') throw new Error('built-in role change failed: ' + JSON.stringify(builtin.error));
    ok('PATCH { role } still works (200)');
  } finally {
    sql(`DELETE FROM users WHERE id IN ('${actor.id}', '${target.id}')`);
    sql(`DELETE FROM roles WHERE id = '${roleId}'`);
    ok('cleaned up temp users + role');
  }

  console.log('\nROLE-ASSIGNMENT ENDPOINT CHECK PASSED ✅');
  process.exit(0);
}

main().catch((e) => {
  console.error('\nASSIGN CHECK FAILED ❌\n  ' + e.message);
  process.exit(1);
});

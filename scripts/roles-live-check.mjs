/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    scripts/roles-live-check.mjs
 * Layer:   Tooling / Dynamic-roles live check (safe on a USED db)
 * Purpose: Prove a CUSTOM role overlays a user's authority end-to-end without a
 *          super-admin password: register a temp USER, confirm they can't see
 *          /admin/roles, create a role + assign it IN THE DB, then confirm
 *          /users/me reflects the role's permissions + landing AND the live
 *          PermissionGuard now lets the SAME token into /admin/roles. Cleans up.
 *          Run:  node scripts/roles-live-check.mjs
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

async function main() {
  console.log('Vertxing dynamic-roles live check against', BASE);

  const email = `tmprole+${Date.now()}@vx.dev`;
  const reg = await http('/auth/register', {
    method: 'POST',
    body: { email, password: 'supersecret123', displayName: 'TmpRole' },
  });
  if (!reg.ok) throw new Error('temp register failed (seat full?): ' + JSON.stringify(reg.error));
  const token = reg.data.tokens.accessToken;
  const userId = reg.data.user.id;
  const roleId = randomUUID();

  try {
    // 1) A plain USER can't list roles (lacks users.manage).
    const denied = await http('/admin/roles', { token });
    if (denied.status !== 403) throw new Error(`expected 403 on /admin/roles, got ${denied.status}`);
    ok('plain USER denied /admin/roles (403)');

    // 2) Create a custom role and assign it — all in the DB (no super-admin token).
    sql(
      `INSERT INTO roles (id, name, key, permissions, "defaultLanding", "createdAt", "updatedAt") ` +
        `VALUES ('${roleId}', 'LiveCheck Lead', 'livecheck-${Date.now()}', ` +
        `'{"calls.start","users.manage"}', '/app/admin/users', now(), now())`,
    );
    sql(`UPDATE users SET "customRoleId" = '${roleId}', role = 'USER' WHERE id = '${userId}'`);
    ok('created a custom role and assigned it (calls.start + users.manage)');

    // 3) /users/me reflects the overlay: permissions, role name, landing.
    const me = await http('/users/me', { token });
    const perms = me.data.permissions || [];
    if (!perms.includes('calls.start') || !perms.includes('users.manage')) {
      throw new Error('me.permissions missing overlay perms: ' + JSON.stringify(perms));
    }
    if (me.data.role !== 'USER') throw new Error('built-in tier should stay USER, got ' + me.data.role);
    if (me.data.roleName !== 'LiveCheck Lead') throw new Error('roleName not the custom role: ' + me.data.roleName);
    if (me.data.landingPath !== '/app/admin/users') throw new Error('landingPath wrong: ' + me.data.landingPath);
    ok('/users/me reflects the overlay (perms + roleName + landingPath)');

    // 4) The SAME token now passes the live PermissionGuard (resolves the overlay).
    const allowed = await http('/admin/roles', { token });
    if (!allowed.ok) throw new Error('overlay users.manage should pass /admin/roles now: ' + JSON.stringify(allowed.error));
    ok('live PermissionGuard lets the overlay through /admin/roles (200)');
  } finally {
    sql(`DELETE FROM users WHERE id = '${userId}'`);
    sql(`DELETE FROM roles WHERE id = '${roleId}'`);
    ok('cleaned up temp user + role');
  }

  console.log('\nDYNAMIC-ROLES LIVE CHECK PASSED ✅');
  process.exit(0);
}

main().catch((e) => {
  console.error('\nROLES LIVE CHECK FAILED ❌\n  ' + e.message);
  process.exit(1);
});

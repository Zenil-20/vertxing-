/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/app/app/admin/roles/page.tsx
 * Layer:   Web / Route — Roles & Access (Permission.UsersManage)
 * Purpose: The DYNAMIC authorization surface. The top half previews the built-in
 *          roles (read-only). The bottom half is the live editor: a super-admin
 *          creates/edits/deletes custom roles — pick permissions, a default
 *          landing, and watch the sidebar preview update — then assigns them to
 *          users on the Users page. Everything renders from the SAME shared config
 *          the running app enforces, so the preview can never lie.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import {
  Check,
  Home,
  type LucideIcon,
  Minus,
  Pencil,
  Phone,
  Plus,
  Settings,
  Trash2,
  Users,
  Video,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ALL_PERMISSIONS,
  ASSIGNABLE_PERMISSIONS,
  type CustomRole,
  hasPermission,
  Permission,
  permissionsForUser,
  PERMISSION_META,
  roleAlwaysHasCalls,
  ROLE_META,
  ROLE_PERMISSIONS,
  UserRole,
  visibleNav,
} from '@vertxing/shared';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useDialog } from '@/lib/dialog-context';
import { useToast } from '@/lib/toast-context';

const ROLES: UserRole[] = [UserRole.USER, UserRole.ADMIN, UserRole.SUPER_ADMIN];

const NAV_ICONS: Record<string, LucideIcon> = {
  home: Home,
  meetings: Video,
  contacts: Users,
  calls: Phone,
  settings: Settings,
};

function roleHas(role: UserRole, perm: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(perm);
}

/** A mini sidebar mock for a given permission set (used by previews). */
function SidebarPreview({ permissions }: { permissions: Permission[] }) {
  return (
    <div style={{ background: 'var(--surface-hi)', border: '1px solid var(--border)', borderRadius: 12, padding: 8 }}>
      {visibleNav(permissions).map((item) => {
        const Icon = NAV_ICONS[item.key] ?? Home;
        return (
          <div key={item.key} className="row" style={{ gap: 10, padding: '8px 10px', fontSize: 14 }}>
            <Icon size={17} style={{ color: 'var(--text-dim)' }} />
            {item.label}
          </div>
        );
      })}
    </div>
  );
}

export default function RolesPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { show } = useToast();
  const { confirm } = useDialog();

  const canManageUsers = !!user && hasPermission(user.permissions, Permission.UsersManage);
  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;

  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [editing, setEditing] = useState<CustomRole | 'new' | null>(null);

  useEffect(() => {
    if (!loading && user && !canManageUsers) router.replace('/app');
  }, [loading, user, canManageUsers, router]);

  useEffect(() => {
    if (canManageUsers) api.getRoles().then(setRoles).catch(() => undefined);
  }, [canManageUsers]);

  if (loading || !user) return <div className="container">Loading…</div>;
  if (!canManageUsers) {
    return (
      <div className="container">
        <p className="muted">Not authorized.</p>
      </div>
    );
  }

  async function removeRole(role: CustomRole) {
    const ok = await confirm({
      title: `Delete the “${role.name}” role?`,
      message:
        role.memberCount > 0
          ? `${role.memberCount} ${role.memberCount === 1 ? 'person reverts' : 'people revert'} to the base User role.`
          : 'This role isn’t assigned to anyone.',
      confirmLabel: 'Delete role',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteRole(role.id);
      setRoles((list) => list.filter((r) => r.id !== role.id));
      show(`Deleted “${role.name}”`, 'success');
    } catch (e) {
      show(e instanceof ApiClientError ? e.message : 'Could not delete role', 'error');
    }
  }

  function onSaved(saved: CustomRole) {
    setRoles((list) => {
      const exists = list.some((r) => r.id === saved.id);
      return exists ? list.map((r) => (r.id === saved.id ? saved : r)) : [...list, saved];
    });
    setEditing(null);
  }

  return (
    <div className="container fade-up" style={{ maxWidth: 920 }}>
      <h1 style={{ marginBottom: 6 }}>Roles &amp; Access</h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        The three built-in roles are fixed. Create custom roles below to tailor access, then assign them on the Users page.
      </p>

      {/* ── Built-in access matrix ────────────────────────────────────────── */}
      <section className="card" style={{ marginBottom: 24, overflowX: 'auto' }}>
        <h3 style={{ marginBottom: 14 }}>Built-in roles</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 460 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 13, color: 'var(--text-dim)' }}>
                Permission
              </th>
              {ROLES.map((r) => (
                <th key={r} style={{ padding: '8px 10px', fontSize: 13, width: 130 }}>{ROLE_META[r].label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALL_PERMISSIONS.map((perm) => (
              <tr key={perm} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '10px' }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{PERMISSION_META[perm].label}</div>
                  <div className="faint" style={{ fontSize: 12 }}>{PERMISSION_META[perm].description}</div>
                </td>
                {ROLES.map((role) => (
                  <td key={role} style={{ padding: '10px', textAlign: 'center' }}>
                    {roleHas(role, perm) ? (
                      <Check size={18} style={{ color: 'var(--success)' }} />
                    ) : perm === Permission.CallsStart && role === UserRole.USER ? (
                      <span className="badge badge-muted-meta" style={{ fontSize: 11 }}>Per user</span>
                    ) : (
                      <Minus size={16} style={{ color: 'var(--text-faint)' }} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ── Custom (dynamic) roles ────────────────────────────────────────── */}
      <div className="between" style={{ marginBottom: 14 }}>
        <h3 style={{ margin: 0 }}>Custom roles</h3>
        {isSuperAdmin && editing === null && (
          <button className="btn btn-sm" onClick={() => setEditing('new')}>
            <Plus size={15} /> New role
          </button>
        )}
      </div>

      {!isSuperAdmin && (
        <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
          Only a super-admin can create or edit roles. You can assign existing roles on the Users page.
        </p>
      )}

      {editing !== null && (
        <RoleEditor
          key={editing === 'new' ? 'new' : editing.id}
          role={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={onSaved}
          onError={(m) => show(m, 'error')}
        />
      )}

      {roles.length === 0 && editing === null ? (
        <p className="muted">No custom roles yet{isSuperAdmin ? ' — create one to tailor access.' : '.'}</p>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          {roles.map((role) => (
            <div key={role.id} className="card" style={{ padding: 16 }}>
              <div className="between" style={{ gap: 12, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <strong>{role.name}</strong>
                    <span className="badge badge-muted-meta" style={{ fontSize: 11 }}>
                      {role.memberCount} {role.memberCount === 1 ? 'member' : 'members'}
                    </span>
                  </div>
                  <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
                    {role.permissions.length === 0 ? (
                      <span className="faint" style={{ fontSize: 12 }}>No permissions</span>
                    ) : (
                      role.permissions.map((p) => (
                        <span key={p} className="badge badge-muted-meta" style={{ fontSize: 11 }}>
                          {PERMISSION_META[p].label}
                        </span>
                      ))
                    )}
                  </div>
                  <div className="faint" style={{ fontSize: 12, marginTop: 8 }}>
                    Lands on <code style={{ fontFamily: 'ui-monospace, monospace' }}>{role.defaultLanding}</code>
                  </div>
                </div>
                {isSuperAdmin && (
                  <div className="row" style={{ gap: 6 }}>
                    <button className="ctrl" style={{ width: 36, height: 36 }} title="Edit" onClick={() => setEditing(role)}>
                      <Pencil size={15} />
                    </button>
                    <button className="ctrl off" style={{ width: 36, height: 36 }} title="Delete" onClick={() => removeRole(role)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Built-in landing preview ──────────────────────────────────────── */}
      <h3 style={{ margin: '28px 0 14px' }}>What built-in roles land on</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {ROLES.map((role) => (
          <div key={role} className="card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>{ROLE_META[role].label}</div>
            <div className="faint" style={{ fontSize: 12, marginBottom: 14, minHeight: 32 }}>
              {ROLE_META[role].description}
            </div>
            <SidebarPreview permissions={permissionsForUser(role, { callsEnabled: false })} />
            {!roleAlwaysHasCalls(role) && (
              <div className="faint" style={{ fontSize: 12, marginTop: 10 }}>
                <Phone size={11} style={{ verticalAlign: -1 }} /> “Calls” appears once call access is granted.
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── The create/edit form ──────────────────────────────────────────────────────

function RoleEditor({
  role,
  onCancel,
  onSaved,
  onError,
}: {
  role: CustomRole | null;
  onCancel: () => void;
  onSaved: (r: CustomRole) => void;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState(role?.name ?? '');
  const [perms, setPerms] = useState<Set<Permission>>(new Set(role?.permissions ?? []));
  const [landing, setLanding] = useState(role?.defaultLanding ?? '/app');
  const [busy, setBusy] = useState(false);

  const selected = useMemo(() => [...perms], [perms]);

  // Landing options = what this permission set can see (+ admin pages).
  const landingOptions = useMemo(() => {
    const opts = visibleNav(selected).map((n) => ({ href: n.href, label: n.label }));
    if (perms.has(Permission.UsersManage)) {
      opts.push({ href: '/app/admin/users', label: 'Users & Roles' });
      opts.push({ href: '/app/admin/roles', label: 'Roles & Access' });
    }
    return opts;
  }, [selected, perms]);

  // Keep the landing valid as permissions change.
  useEffect(() => {
    if (!landingOptions.some((o) => o.href === landing)) setLanding('/app');
  }, [landingOptions, landing]);

  function togglePerm(p: Permission) {
    setPerms((s) => {
      const next = new Set(s);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });
  }

  async function save() {
    if (!name.trim()) {
      onError('Give the role a name');
      return;
    }
    if (perms.size === 0) {
      onError('Pick at least one permission');
      return;
    }
    setBusy(true);
    try {
      const payload = { name: name.trim(), permissions: selected, defaultLanding: landing };
      const saved = role ? await api.updateRole(role.id, payload) : await api.createRole(payload);
      onSaved(saved);
    } catch (e) {
      onError(e instanceof ApiClientError ? e.message : 'Could not save role');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ padding: 18, marginBottom: 16, border: '1px solid var(--brand-3)' }}>
      <div className="between" style={{ marginBottom: 16 }}>
        <strong style={{ fontSize: 16 }}>{role ? `Edit “${role.name}”` : 'New role'}</strong>
        <button className="ctrl" style={{ width: 32, height: 32 }} onClick={onCancel}>
          <X size={16} />
        </button>
      </div>

      <div className="field">
        <label>Role name</label>
        <input
          className="input"
          placeholder="e.g. Team Lead"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="field">
        <label>Permissions</label>
        <div className="stack" style={{ gap: 8 }}>
          {ASSIGNABLE_PERMISSIONS.map((p) => (
            <label
              key={p}
              className="row"
              style={{
                gap: 10,
                cursor: 'pointer',
                padding: '10px 12px',
                borderRadius: 10,
                background: 'var(--surface-hi)',
                border: '1px solid var(--border)',
              }}
            >
              <input
                type="checkbox"
                checked={perms.has(p)}
                onChange={() => togglePerm(p)}
                style={{ width: 18, height: 18, accentColor: 'var(--brand-1)' }}
              />
              <span>
                <span style={{ fontWeight: 600, display: 'block' }}>{PERMISSION_META[p].label}</span>
                <span className="faint" style={{ fontSize: 12 }}>{PERMISSION_META[p].description}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Lands on after sign-in</label>
        <select className="input" value={landing} onChange={(e) => setLanding(e.target.value)}>
          {landingOptions.map((o) => (
            <option key={o.href} value={o.href}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="field" style={{ marginBottom: 18 }}>
        <label>Sidebar preview</label>
        <SidebarPreview permissions={selected} />
      </div>

      <div className="row" style={{ gap: 8 }}>
        <button className="btn" disabled={busy} onClick={save}>
          {role ? 'Save changes' : 'Create role'}
        </button>
        <button className="btn btn-ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

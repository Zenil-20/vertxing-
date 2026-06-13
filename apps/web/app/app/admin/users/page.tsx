/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/app/app/admin/users/page.tsx
 * Layer:   Web / Route — Users & Roles (Permission.UsersManage)
 * Purpose: Govern privileges. Anyone with "manage users" assigns a built-in OR a
 *          custom role, grants/revokes call access, deletes, and bulk-applies —
 *          with a PREVIEW of what a role grants before a bulk assignment lands.
 *          The UI mirrors the server hierarchy so disallowed actions don't appear;
 *          the API is the real gate.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import { Phone, PhoneOff, Trash2, UserCog } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  type AdminUser,
  type CustomRole,
  hasPermission,
  Permission,
  permissionsForUser,
  PERMISSION_META,
  roleAlwaysHasCalls,
  ROLE_META,
  UserRole,
  visibleNav,
} from '@vertxing/shared';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useDialog } from '@/lib/dialog-context';
import { useToast } from '@/lib/toast-context';

const CUSTOM_PREFIX = 'custom:';

function initials(name: string): string {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { show } = useToast();
  const { confirm } = useDialog();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const canManageUsers = !!user && hasPermission(user.permissions, Permission.UsersManage);
  const actorIsSuper = user?.role === UserRole.SUPER_ADMIN;
  const builtinOptions = actorIsSuper
    ? [UserRole.USER, UserRole.ADMIN, UserRole.SUPER_ADMIN]
    : [UserRole.USER, UserRole.ADMIN];

  useEffect(() => {
    if (!loading && user && !canManageUsers) router.replace('/app');
  }, [loading, user, canManageUsers, router]);

  useEffect(() => {
    if (canManageUsers) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageUsers]);

  function refresh() {
    api.getUsers().then(setUsers).catch(() => undefined);
    api.getRoles().then(setRoles).catch(() => undefined);
  }

  function canManage(row: AdminUser): boolean {
    if (!user) return false;
    if (row.id === user.id) return false;
    if (row.role === UserRole.SUPER_ADMIN && !actorIsSuper) return false;
    return true;
  }

  const manageableIds = useMemo(
    () => users.filter((u) => canManage(u)).map((u) => u.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [users, user],
  );

  // The permissions a chosen assignment grants — for the preview-before-assign.
  function permsForValue(value: string): Permission[] {
    if (value.startsWith(CUSTOM_PREFIX)) {
      const id = value.slice(CUSTOM_PREFIX.length);
      return roles.find((r) => r.id === id)?.permissions ?? [];
    }
    return permissionsForUser(value as UserRole, { callsEnabled: false });
  }

  function labelForValue(value: string): string {
    if (value.startsWith(CUSTOM_PREFIX)) {
      const id = value.slice(CUSTOM_PREFIX.length);
      return roles.find((r) => r.id === id)?.name ?? 'role';
    }
    return ROLE_META[value as UserRole].label;
  }

  function valueOf(u: AdminUser): string {
    return u.customRole ? `${CUSTOM_PREFIX}${u.customRole.id}` : u.role;
  }

  function changesForValue(value: string) {
    return value.startsWith(CUSTOM_PREFIX)
      ? { customRoleId: value.slice(CUSTOM_PREFIX.length) }
      : { role: value as UserRole };
  }

  if (loading || !user) return <div className="container">Loading…</div>;
  if (!canManageUsers) {
    return (
      <div className="container">
        <p className="muted">Not authorized.</p>
      </div>
    );
  }

  function replace(updated: AdminUser) {
    setUsers((list) => list.map((u) => (u.id === updated.id ? updated : u)));
  }

  async function changeAssignment(target: AdminUser, value: string) {
    if (value === valueOf(target)) return;
    setBusyId(target.id);
    try {
      replace(await api.updateUser(target.id, changesForValue(value)));
      show(`${target.displayName} → ${labelForValue(value)}`, 'success');
    } catch (e) {
      show(e instanceof ApiClientError ? e.message : 'Could not change role', 'error');
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function toggleCalls(target: AdminUser, next: boolean) {
    setBusyId(target.id);
    try {
      replace(await api.updateUser(target.id, { callsEnabled: next }));
      show(next ? `${target.displayName} can now call` : `${target.displayName}’s call access removed`, 'success');
    } catch (e) {
      show(e instanceof ApiClientError ? e.message : 'Could not update call access', 'error');
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function removeUser(target: AdminUser) {
    const ok = await confirm({
      title: `Delete ${target.displayName}?`,
      message: 'This permanently removes the account and the meetings they host. It can’t be undone.',
      confirmLabel: 'Delete account',
      danger: true,
    });
    if (!ok) return;
    setBusyId(target.id);
    try {
      await api.deleteUser(target.id);
      setUsers((list) => list.filter((u) => u.id !== target.id));
      setSelected((s) => {
        const next = new Set(s);
        next.delete(target.id);
        return next;
      });
      show(`${target.displayName} deleted`, 'success');
    } catch (e) {
      show(e instanceof ApiClientError ? e.message : 'Could not delete account', 'error');
    } finally {
      setBusyId(null);
    }
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((s) => (s.size === manageableIds.length ? new Set() : new Set(manageableIds)));
  }

  async function applyBulk(changes: { role?: UserRole; customRoleId?: string; callsEnabled?: boolean }) {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      const updated = await api.bulkUpdateUsers({ userIds: ids, ...changes });
      const byId = new Map(updated.map((u) => [u.id, u]));
      setUsers((list) => list.map((u) => byId.get(u.id) ?? u));
      show(`Updated ${updated.length} ${updated.length === 1 ? 'account' : 'accounts'}`, 'success');
      setSelected(new Set());
    } catch (e) {
      show(e instanceof ApiClientError ? e.message : 'Could not apply changes', 'error');
      refresh();
    } finally {
      setBulkBusy(false);
    }
  }

  /** Preview what a role grants, then apply it to the selection. */
  async function bulkAssign(value: string) {
    if (!value) return;
    const perms = permsForValue(value);
    const can = perms.length ? perms.map((p) => PERMISSION_META[p].label).join(', ') : 'nothing extra';
    const sees = visibleNav(perms).map((n) => n.label).join(' · ');
    const ok = await confirm({
      title: `Assign “${labelForValue(value)}” to ${selected.size} ${selected.size === 1 ? 'user' : 'users'}?`,
      message: `They’ll be able to: ${can}.  Sidebar: ${sees}.`,
      confirmLabel: 'Assign',
    });
    if (!ok) return;
    await applyBulk(changesForValue(value));
  }

  const selectedCount = selected.size;

  return (
    <div className="container fade-up" style={{ maxWidth: 920 }}>
      <div className="row" style={{ gap: 10, marginBottom: 6 }}>
        <UserCog size={24} style={{ color: 'var(--brand-3)' }} />
        <h1>Users &amp; Roles</h1>
      </div>
      <p className="muted" style={{ marginBottom: 20 }}>
        {users.length} account{users.length === 1 ? '' : 's'} · assign built-in or custom roles and control call access.
      </p>

      {manageableIds.length > 0 && (
        <label className="row" style={{ gap: 8, marginBottom: 12, cursor: 'pointer', fontSize: 13 }}>
          <input
            type="checkbox"
            checked={selectedCount > 0 && selectedCount === manageableIds.length}
            ref={(el) => {
              if (el) el.indeterminate = selectedCount > 0 && selectedCount < manageableIds.length;
            }}
            onChange={toggleSelectAll}
            style={{ width: 16, height: 16 }}
          />
          <span className="muted">Select all manageable</span>
        </label>
      )}

      {/* Bulk action toolbar — sticky to the top of the list so it reserves its
          own space and never floats over (clashes with) the rows below. */}
      {selectedCount > 0 && (
        <div
          className="glass fade-up"
          style={{
            position: 'sticky',
            top: 8,
            zIndex: 20,
            marginBottom: 12,
            padding: '12px 14px',
            borderRadius: 14,
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <strong style={{ fontSize: 14 }}>{selectedCount} selected</strong>
          <select
            className="input"
            style={{ width: 168 }}
            value=""
            disabled={bulkBusy}
            onChange={(e) => bulkAssign(e.target.value)}
          >
            <option value="">Assign role…</option>
            <optgroup label="Built-in">
              {builtinOptions.map((r) => (
                <option key={r} value={r}>{ROLE_META[r].label}</option>
              ))}
            </optgroup>
            {roles.length > 0 && (
              <optgroup label="Custom roles">
                {roles.map((r) => (
                  <option key={r.id} value={`${CUSTOM_PREFIX}${r.id}`}>{r.name}</option>
                ))}
              </optgroup>
            )}
          </select>
          <button className="btn btn-sm btn-ghost" disabled={bulkBusy} onClick={() => applyBulk({ callsEnabled: true })}>
            <Phone size={14} /> Allow calls
          </button>
          <button className="btn btn-sm btn-ghost" disabled={bulkBusy} onClick={() => applyBulk({ callsEnabled: false })}>
            <PhoneOff size={14} /> Block calls
          </button>
          <button className="btn btn-sm btn-ghost" disabled={bulkBusy} onClick={() => setSelected(new Set())} style={{ marginLeft: 'auto' }}>
            Clear
          </button>
        </div>
      )}

      <div className="stack" style={{ gap: 8 }}>
        {users.map((u) => {
          const manageable = canManage(u);
          const roleHasCalls = roleAlwaysHasCalls(u.role);
          const isSelf = u.id === user.id;
          const currentValue = valueOf(u);
          // Build the per-row option list, guaranteeing the current value renders.
          const builtin = builtinOptions.map((r) => ({ value: r as string, label: ROLE_META[r].label }));
          if (!builtin.some((o) => o.value === u.role) && !u.customRole) {
            builtin.push({ value: u.role, label: ROLE_META[u.role].label });
          }
          const customOpts = roles.map((r) => ({ value: `${CUSTOM_PREFIX}${r.id}`, label: r.name }));
          return (
            <div key={u.id} className="card between" style={{ padding: 14, flexWrap: 'wrap', gap: 12 }}>
              <div className="row" style={{ gap: 12, minWidth: 0 }}>
                <input
                  type="checkbox"
                  checked={selected.has(u.id)}
                  disabled={!manageable}
                  onChange={() => toggleSelect(u.id)}
                  style={{ width: 16, height: 16, accentColor: 'var(--brand-1)', visibility: manageable ? 'visible' : 'hidden' }}
                />
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: 'var(--grad-brand)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {initials(u.displayName)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <span style={{ fontWeight: 600 }}>{u.displayName}</span>
                    {isSelf && <span className="badge badge-muted-meta">You</span>}
                    {u.customRole && <span className="badge badge-host" style={{ fontSize: 11 }}>{u.customRole.name}</span>}
                  </div>
                  <div className="faint" style={{ fontSize: 13 }}>{u.email}</div>
                </div>
              </div>

              <div className="row wrap" style={{ gap: 8, alignItems: 'center' }}>
                {roleHasCalls ? (
                  <span className="badge badge-muted-meta" title="This role always has call access">
                    <Phone size={12} /> Calls: role
                  </span>
                ) : (
                  <button
                    className="btn btn-sm btn-ghost"
                    title={u.callsEnabled ? 'Calls allowed — click to block' : 'Calls blocked — click to allow'}
                    disabled={!manageable || busyId === u.id}
                    onClick={() => toggleCalls(u, !u.callsEnabled)}
                    style={{ color: u.callsEnabled ? 'var(--success)' : 'var(--text-dim)' }}
                  >
                    {u.callsEnabled ? <Phone size={14} /> : <PhoneOff size={14} />}
                    {u.callsEnabled ? 'Can call' : 'No calls'}
                  </button>
                )}

                <select
                  className="input"
                  style={{ width: 168 }}
                  value={currentValue}
                  disabled={!manageable || busyId === u.id}
                  onChange={(e) => changeAssignment(u, e.target.value)}
                >
                  <optgroup label="Built-in">
                    {builtin.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </optgroup>
                  {customOpts.length > 0 && (
                    <optgroup label="Custom roles">
                      {customOpts.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </optgroup>
                  )}
                </select>

                <button
                  className="ctrl off"
                  style={{ width: 36, height: 36, opacity: manageable ? 1 : 0.35 }}
                  title={manageable ? 'Delete account' : 'You can’t delete this account'}
                  disabled={!manageable || busyId === u.id}
                  onClick={() => removeUser(u)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}

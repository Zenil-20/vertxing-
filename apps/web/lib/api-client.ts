/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/lib/api-client.ts
 * Layer:   Web / Data access
 * Purpose: The ONE place the browser talks to the API. It:
 *            • unwraps the `ApiSuccess<T>` / `ApiError` envelope into plain data
 *              or a thrown Error (callers never see the envelope)
 *            • attaches the Bearer access token
 *            • TRANSPARENTLY refreshes once on a 401, then retries — so short-
 *              lived access tokens are invisible to the UI
 *          All endpoints are exposed as typed methods using @vertxing/shared
 *          contracts, so a backend change that breaks the shape fails to compile.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type {
  AdminUser,
  ApiResponse,
  AuthResult,
  AuthTokens,
  BulkUpdateUsersRequest,
  CreateMeetingRequest,
  CreateRoleRequest,
  CustomRole,
  DirectoryUser,
  GeneratedLicense,
  GenerateLicenseRequest,
  JoinMeetingResult,
  LicenseStatusDto,
  LoginRequest,
  Meeting,
  PublicUser,
  PushPublicKeyDto,
  RegisterRequest,
  RemovePushSubscriptionRequest,
  SaveFcmTokenRequest,
  SavePushSubscriptionRequest,
  UpdateMeetingRequest,
  UpdateProfileRequest,
  UpdateRoleRequest,
  UpdateUserRequest,
} from '@vertxing/shared';
import { session } from './session';

const API_BASE =
  (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000') + '/api';

/** Error carrying the API's machine code + message for the UI to branch on. */
export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Skip the auth header (used by login/register/refresh). */
  anonymous?: boolean;
  /** Internal: prevents infinite refresh recursion. */
  _isRetry?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, anonymous = false, _isRetry = false } = options;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!anonymous && session.accessToken) {
    headers.Authorization = `Bearer ${session.accessToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // 204 No Content (e.g. logout) — nothing to parse.
  if (res.status === 204) {
    return undefined as T;
  }

  const json = (await res.json()) as ApiResponse<T>;

  if (json.success) {
    return json.data;
  }

  // Transparent refresh-and-retry exactly once on an expired access token.
  if (
    res.status === 401 &&
    !anonymous &&
    !_isRetry &&
    session.refreshToken &&
    json.error.code !== 'UNAUTHORIZED_REFRESH'
  ) {
    try {
      const tokens = await refresh();
      session.saveTokens(tokens);
      return request<T>(path, { ...options, _isRetry: true });
    } catch {
      session.clear();
    }
  }

  throw new ApiClientError(json.error.message, json.error.code, json.error.statusCode);
}

async function refresh(): Promise<AuthTokens> {
  return request<AuthTokens>('/auth/refresh', {
    method: 'POST',
    anonymous: true,
    body: { refreshToken: session.refreshToken },
  });
}

/** Typed facade over every endpoint the client uses. */
export const api = {
  register: (payload: RegisterRequest): Promise<AuthResult> =>
    request('/auth/register', { method: 'POST', anonymous: true, body: payload }),

  login: (payload: LoginRequest): Promise<AuthResult> =>
    request('/auth/login', { method: 'POST', anonymous: true, body: payload }),

  logout: (refreshToken: string): Promise<void> =>
    request('/auth/logout', { method: 'POST', body: { refreshToken } }),

  getMe: (): Promise<PublicUser> => request('/users/me'),

  updateProfile: (payload: UpdateProfileRequest): Promise<PublicUser> =>
    request('/users/me', { method: 'PATCH', body: payload }),

  getDirectory: (): Promise<DirectoryUser[]> => request('/users'),

  // ── Licensing (super-admin) ───────────────────────────────────────────────
  getLicenseStatus: (): Promise<LicenseStatusDto> => request('/license/status'),

  activateLicense: (key: string): Promise<LicenseStatusDto> =>
    request('/license/activate', { method: 'POST', body: { key } }),

  generateLicense: (payload: GenerateLicenseRequest): Promise<GeneratedLicense> =>
    request('/license/generate', { method: 'POST', body: payload }),

  // ── User management (Permission.UsersManage) ──────────────────────────────
  getUsers: (): Promise<AdminUser[]> => request('/admin/users'),

  updateUser: (id: string, changes: UpdateUserRequest): Promise<AdminUser> =>
    request(`/admin/users/${id}`, { method: 'PATCH', body: changes }),

  deleteUser: (id: string): Promise<void> =>
    request(`/admin/users/${id}`, { method: 'DELETE' }),

  bulkUpdateUsers: (payload: BulkUpdateUsersRequest): Promise<AdminUser[]> =>
    request('/admin/users/bulk', { method: 'POST', body: payload }),

  // ── Dynamic roles (list: users.manage · mutate: super-admin) ──────────────
  getRoles: (): Promise<CustomRole[]> => request('/admin/roles'),

  createRole: (payload: CreateRoleRequest): Promise<CustomRole> =>
    request('/admin/roles', { method: 'POST', body: payload }),

  updateRole: (id: string, payload: UpdateRoleRequest): Promise<CustomRole> =>
    request(`/admin/roles/${id}`, { method: 'PATCH', body: payload }),

  deleteRole: (id: string): Promise<void> =>
    request(`/admin/roles/${id}`, { method: 'DELETE' }),

  // ── Web Push (background calls) ────────────────────────────────────────────
  getPushPublicKey: (): Promise<PushPublicKeyDto> => request('/push/public-key'),

  subscribePush: (payload: SavePushSubscriptionRequest): Promise<void> =>
    request('/push/subscribe', { method: 'POST', body: payload }),

  unsubscribePush: (payload: RemovePushSubscriptionRequest): Promise<void> =>
    request('/push/unsubscribe', { method: 'POST', body: payload }),

  registerFcmToken: (payload: SaveFcmTokenRequest): Promise<void> =>
    request('/push/fcm-token', { method: 'POST', body: payload }),

  createMeeting: (payload: CreateMeetingRequest): Promise<Meeting> =>
    request('/meetings', { method: 'POST', body: payload }),

  listMeetings: (): Promise<Meeting[]> => request('/meetings'),

  getMeeting: (roomName: string): Promise<Meeting> =>
    request(`/meetings/${roomName}`),

  joinMeeting: (roomName: string): Promise<JoinMeetingResult> =>
    request(`/meetings/${roomName}/join`, { method: 'POST' }),

  updateMeeting: (roomName: string, payload: UpdateMeetingRequest): Promise<Meeting> =>
    request(`/meetings/${roomName}`, { method: 'PATCH', body: payload }),

  cancelMeeting: (roomName: string): Promise<Meeting> =>
    request(`/meetings/${roomName}/cancel`, { method: 'POST' }),

  deleteMeeting: (roomName: string): Promise<void> =>
    request(`/meetings/${roomName}`, { method: 'DELETE' }),

  endMeeting: (roomName: string): Promise<Meeting> =>
    request(`/meetings/${roomName}/end`, { method: 'POST' }),

  muteParticipant: (roomName: string, identity: string, muted: boolean): Promise<void> =>
    request(`/meetings/${roomName}/participants/mute`, {
      method: 'POST',
      body: { identity, muted },
    }),

  removeParticipant: (roomName: string, identity: string): Promise<void> =>
    request(`/meetings/${roomName}/participants/remove`, {
      method: 'POST',
      body: { identity },
    }),
};

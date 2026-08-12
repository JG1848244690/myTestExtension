/**
 * 调后端 sync API 的薄客户端
 *
 * 每个调用都自动从本地读 sessionToken 加到 Authorization header
 * 401 时自动清本地登录态(让 UI 重新提示登录)
 */

import { SYNC_API_BASE_URL, SYNC_API, SYNC_LOCAL_KEYS } from './syncConfig';
import { createStorageCell } from '@/src/lib/storage';
import { clearLoginLocally } from './googleAuth';

const sessionTokenCell = createStorageCell<string>(SYNC_LOCAL_KEYS.SESSION_TOKEN);
const bookmarksVersionCell = createStorageCell<number>(SYNC_LOCAL_KEYS.BOOKMARKS_VERSION);
const sessionsVersionCell = createStorageCell<number>(SYNC_LOCAL_KEYS.SESSIONS_VERSION);

// ============================================================
// Types
// ============================================================

export interface SyncSnapshot<TPayload> {
  payload: TPayload;
  version: number;
  updatedAt: string;
}

export interface SyncConflict<TPayload> {
  error: 'version mismatch';
  currentVersion: number;
  currentPayload: TPayload;
}

export type DownloadResult<TPayload> =
  | { ok: true; snapshot: SyncSnapshot<TPayload> }
  | { ok: false; notFound: true };

export type UploadResult<TPayload> =
  | { ok: true; snapshot: SyncSnapshot<TPayload> }
  | { ok: false; conflict: SyncConflict<TPayload> }
  | { ok: false; error: string };

// ============================================================
// Helpers
// ============================================================

async function authHeader(): Promise<Record<string, string>> {
  const token = await sessionTokenCell.read();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** 收到 401 时清掉本地登录态(token + user),让 UI 回到未登录 */
async function handleUnauthorized(): Promise<never> {
  // clearLoginLocally 同时清 sessionToken 和 user cell(见 googleAuth.ts)
  await clearLoginLocally().catch(() => {});
  throw new SyncAuthError('登录已失效,请重新登录');
}

export class SyncAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncAuthError';
  }
}

// ============================================================
// Bookmarks
// ============================================================

export async function downloadBookmarks<TPayload = unknown>(): Promise<DownloadResult<TPayload>> {
  const res = await fetch(`${SYNC_API_BASE_URL}${SYNC_API.BOOKMARKS}`, {
    method: 'GET',
    headers: { ...(await authHeader()) },
  });

  if (res.status === 401) {
    await handleUnauthorized();
  }
  if (res.status === 404) {
    return { ok: false, notFound: true };
  }
  if (!res.ok) {
    throw new Error(`下载书签失败 (${res.status})`);
  }

  const snapshot = (await res.json()) as SyncSnapshot<TPayload>;
  await bookmarksVersionCell.write(snapshot.version);
  return { ok: true, snapshot };
}

export async function uploadBookmarks<TPayload = unknown>(
  payload: TPayload,
  expectedVersion?: number,
): Promise<UploadResult<TPayload>> {
  const ev = expectedVersion ?? (await bookmarksVersionCell.read()) ?? 0;

  const res = await fetch(`${SYNC_API_BASE_URL}${SYNC_API.BOOKMARKS}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeader()),
    },
    body: JSON.stringify({ payload, expectedVersion: ev }),
  });

  if (res.status === 401) {
    await handleUnauthorized();
  }

  if (res.status === 409) {
    const body = (await res.json()) as SyncConflict<TPayload>;
    return { ok: false, conflict: body };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, error: text || `上传失败 (${res.status})` };
  }

  const snapshot = (await res.json()) as SyncSnapshot<TPayload>;
  await bookmarksVersionCell.write(snapshot.version);
  return { ok: true, snapshot };
}

// ============================================================
// Tab Sessions
// ============================================================

export async function downloadSessions<TPayload = unknown>(): Promise<DownloadResult<TPayload>> {
  const res = await fetch(`${SYNC_API_BASE_URL}${SYNC_API.SESSIONS}`, {
    method: 'GET',
    headers: { ...(await authHeader()) },
  });

  if (res.status === 401) await handleUnauthorized();
  if (res.status === 404) return { ok: false, notFound: true };
  if (!res.ok) throw new Error(`下载会话失败 (${res.status})`);

  const snapshot = (await res.json()) as SyncSnapshot<TPayload>;
  await sessionsVersionCell.write(snapshot.version);
  return { ok: true, snapshot };
}

export async function uploadSessions<TPayload = unknown>(
  payload: TPayload,
  expectedVersion?: number,
): Promise<UploadResult<TPayload>> {
  const ev = expectedVersion ?? (await sessionsVersionCell.read()) ?? 0;

  const res = await fetch(`${SYNC_API_BASE_URL}${SYNC_API.SESSIONS}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeader()),
    },
    body: JSON.stringify({ payload, expectedVersion: ev }),
  });

  if (res.status === 401) await handleUnauthorized();

  if (res.status === 409) {
    const body = (await res.json()) as SyncConflict<TPayload>;
    return { ok: false, conflict: body };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, error: text || `上传失败 (${res.status})` };
  }

  const snapshot = (await res.json()) as SyncSnapshot<TPayload>;
  await sessionsVersionCell.write(snapshot.version);
  return { ok: true, snapshot };
}

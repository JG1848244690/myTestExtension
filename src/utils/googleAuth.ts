/**
 * Google 登录工具(授权码模式)
 *
 * 流程:
 *   1. chrome.identity.launchWebAuthFlow 弹出 Google 授权页
 *      - response_type=code
 *      - 用户同意后 Google 回调 https://<EXT_ID>.chromiumapp.org/?code=xxx
 *   2. 插件解析 code,POST { code, redirectUri } 给后端 /sync/auth/google
 *   3. 后端用 code + client_id + client_secret 调 Google /token 换 access_token
 *   4. 后端用 access_token 调 Google /userinfo 拿用户信息
 *   5. 后端 upsert users 表,颁发 sessionToken,返回 { sessionToken, user }
 *   6. 插件缓存 sessionToken + user 到 local storage
 *
 * 后续每次调用 sync 接口都带 Authorization: Bearer <sessionToken>
 *   (后端会用 sessionToken 查 user_sessions 表确认身份)
 */

import {
  GOOGLE_CLIENT_ID,
  GOOGLE_OAUTH_SCOPES,
  GOOGLE_OAUTH_URL,
  SYNC_API_BASE_URL,
  SYNC_API,
  SYNC_LOCAL_KEYS,
} from './syncConfig';
import { createStorageCell } from '@/src/lib/storage';

// ============================================================
// Types
// ============================================================

/** 后端 /sync/auth/google 返回的用户信息 */
export interface SyncUser {
  id: string;          // 后端 user.id(由 email 派生)
  email: string;
  name?: string;
  picture?: string;
  googleSub: string;   // Google 稳定用户 id
}

export interface GoogleLoginResult {
  sessionToken: string;
  user: SyncUser;
}

// ============================================================
// 持久化 cell
// ============================================================

const sessionTokenCell = createStorageCell<string>(SYNC_LOCAL_KEYS.SESSION_TOKEN);
const userCell = createStorageCell<SyncUser>(SYNC_LOCAL_KEYS.USER);

// ============================================================
// Helpers
// ============================================================

/** 拿到当前扩展 id(动态、重新加载后会变) */
function getExtensionId(): string {
  return browser.runtime.id;
}

/** 构造 redirect_uri,OAuth 必须严格匹配 */
function getRedirectUri(): string {
  return `https://${getExtensionId()}.chromiumapp.org/`;
}

/** 构造 OAuth 授权 URL — 授权码模式 */
function buildAuthUrl(): string {
  const url = new URL(GOOGLE_OAUTH_URL);
  url.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  url.searchParams.set('response_type', 'code');           // ← 授权码模式
  url.searchParams.set('scope', GOOGLE_OAUTH_SCOPES);
  url.searchParams.set('redirect_uri', getRedirectUri());
  url.searchParams.set('access_type', 'offline');           // ← 让 Google 返回 refresh_token
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('prompt', 'consent');                // ← 每次都让用户确认(refresh_token 必要)
  return url.toString();
}

/**
 * 从 launchWebAuthFlow 返回的 URL 里抽 code
 *
 * 成功: https://<EXT_ID>.chromiumapp.org/?code=4/0AVMBsJ...&scope=...
 * 失败: https://<EXT_ID>.chromiumapp.org/?error=access_denied&...
 */
function parseCode(responseUrl: string): string {
  let query: string;
  try {
    const u = new URL(responseUrl);
    query = u.search.startsWith('?') ? u.search.slice(1) : u.search;
  } catch {
    throw new Error(`Invalid response URL: ${responseUrl}`);
  }
  const params = new URLSearchParams(query);
  const error = params.get('error');
  if (error) {
    throw new Error(`Google OAuth error: ${error} ${params.get('error_description') || ''}`);
  }
  const code = params.get('code');
  if (!code) {
    throw new Error('No authorization code in OAuth response');
  }
  return code;
}

// ============================================================
// Public API
// ============================================================

/**
 * 启动 Google 登录流程
 * - 弹出 Google 授权窗口
 * - 用户同意后拿到 authorization code
 * - 发给后端 → 后端用 secret 换 token → 颁发 sessionToken
 */
export async function loginWithGoogle(): Promise<GoogleLoginResult> {
  if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.startsWith('YOUR_')) {
    throw new Error(
      'GOOGLE_CLIENT_ID 还没配置 — 请在 src/utils/syncConfig.ts 里填入你的 Client ID'
    );
  }

  // 1. 启动 OAuth flow
  const authUrl = buildAuthUrl();

  const responseUrl = await browser.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true,
  });

  if (!responseUrl) {
    throw new Error('User cancelled Google login');
  }

  // 2. 解析 code
  const code = parseCode(responseUrl);

  // 3. 发给后端,后端用 secret 换 token → 颁发 sessionToken
  const res = await fetch(`${SYNC_API_BASE_URL}${SYNC_API.GOOGLE_LOGIN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      redirectUri: getRedirectUri(),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Backend rejected login (${res.status}): ${text || res.statusText}`
    );
  }

  const data = (await res.json()) as GoogleLoginResult;
  return data;
}

/**
 * 缓存当前登录态到本地 storage
 * 由 background.ts 调用,UI 端通过 messaging 读取
 */
export async function saveLoginLocally(
  sessionToken: string,
  user: SyncUser
): Promise<void> {
  await Promise.all([
    sessionTokenCell.write(sessionToken),
    userCell.write(user),
  ]);
}

/** 读取 sessionToken(给其他模块用,如 sync API 调用的 header) */
export async function readSessionToken(): Promise<string | null> {
  return (await sessionTokenCell.read()) ?? null;
}

/** 读取当前登录的用户 */
export async function readCurrentUser(): Promise<SyncUser | null> {
  return (await userCell.read()) ?? null;
}

/** 清除本地登录态(同时调后端 /sync/auth/logout 删除 sessionToken) */
export async function clearLoginLocally(): Promise<void> {
  await Promise.all([sessionTokenCell.remove(), userCell.remove()]);
}

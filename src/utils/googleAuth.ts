/**
 * Google 登录工具(launchWebAuthFlow 隐式流 + 后端不验签模式)
 *
 * 流程:
 *   1. chrome.identity.launchWebAuthFlow 弹 Google 账号选择器
 *      - response_type=id_token (隐式流)
 *      - 用户同意后 Google 回调 https://<EXT_ID>.chromiumapp.org/#id_token=...
 *   2. 扩展从回调 URL 的 fragment 解析出 id_token
 *   3. 扩展 base64 解码 JWT payload 拿 email / name / picture
 *   4. 扩展 POST {email, name, picture} 给后端 /sync/auth/google
 *   5. 后端**完全不验证** id_token 签名、不调 Google API,只用 email
 *      派生 userId,upsert users,发 sessionToken
 *   6. 插件缓存 sessionToken + user 到 local storage
 *
 * ⚠️ 安全警告:后端不验签,任何能 POST 到 /sync/auth/google 的人
 * 加上 email 就能拿到对应用户的 sessionToken。仅适合个人/小范围。
 *
 * 后续每次调用 sync 接口都带 Authorization: Bearer <sessionToken>
 */

// 流程与 tiktok-analytics 的 googleLoginDirect.ts 一致(client_id 复用主站那个)。
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_OAUTH_URL,
  GOOGLE_OAUTH_SCOPES,
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
  googleSub: string;   // 简化模式下后端用 email 占位
}

export interface GoogleLoginResult {
  sessionToken: string;
  user: SyncUser;
}

/** id_token payload(只看用得到的几个字段) */
interface IdTokenPayload {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

// ============================================================
// 持久化 cell
// ============================================================

const sessionTokenCell = createStorageCell<string>(SYNC_LOCAL_KEYS.SESSION_TOKEN);
const userCell = createStorageCell<SyncUser>(SYNC_LOCAL_KEYS.USER);

// ============================================================
// Helpers
// ============================================================

/** 拿到当前扩展 id(动态、重新加载后会变 — 除非 manifest 加了 `key:` 字段) */
function getExtensionId(): string {
  return browser.runtime.id;
}

/** launchWebAuthFlow 要求的 redirect_uri,严格匹配 Google Console 配置 */
function getRedirectUri(): string {
  return `https://${getExtensionId()}.chromiumapp.org/`;
}

/** 构造 OAuth 授权 URL — 隐式流(id_token 直接在 fragment 里) */
function buildAuthUrl(nonce: string): string {
  const url = new URL(GOOGLE_OAUTH_URL);
  url.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  url.searchParams.set('response_type', 'id_token');
  url.searchParams.set('scope', GOOGLE_OAUTH_SCOPES);
  url.searchParams.set('redirect_uri', getRedirectUri());
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

/**
 * 从 launchWebAuthFlow 返回的 URL fragment 解析 id_token
 * 成功: https://<EXT_ID>.chromiumapp.org/#id_token=xxx&...
 * 失败: https://<EXT_ID>.chromiumapp.org/#error=access_denied&...
 */
function parseIdToken(responseUrl: string): string {
  let fragment: string;
  try {
    const u = new URL(responseUrl);
    fragment = u.hash.startsWith('#') ? u.hash.slice(1) : u.hash;
  } catch {
    throw new Error(`Invalid response URL: ${responseUrl}`);
  }
  const params = new URLSearchParams(fragment);
  const error = params.get('error');
  if (error) {
    throw new Error(`Google OAuth error: ${error} ${params.get('error_description') || ''}`);
  }
  const idToken = params.get('id_token');
  if (!idToken) {
    throw new Error('No id_token in OAuth response fragment');
  }
  return idToken;
}

/**
 * 解码 JWT payload(中间段 base64)— 不验签,只看 claim
 * 注意:Google 的 id_token payload 是 UTF-8 JSON,直接 atob 中文会乱码,
 * 需要按 UTF-8 解码
 */
function decodeJwtPayload(jwt: string): IdTokenPayload {
  const part = jwt.split('.')[1];
  const binary = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
  const utf8 = new TextDecoder('utf-8').decode(
    Uint8Array.from(binary, (c) => c.charCodeAt(0)),
  );
  return JSON.parse(utf8);
}

// ============================================================
// Public API
// ============================================================

/**
 * 启动 Google 登录流程
 * - launchWebAuthFlow 拿 id_token(隐式流,response_type=id_token)
 * - POST {idToken, nonce} 给后端,后端用 jose + 本地静态 JWKS 验签
 * - 后端零 HTTPS 出站,签名校验在服务器本地完成
 */
export async function loginWithGoogle(): Promise<GoogleLoginResult> {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('GOOGLE_CLIENT_ID 还没配置 — 请在 src/utils/syncConfig.ts 里填入');
  }

  // 1. 生成 nonce 用于 auth url + 后端二次校验(防 replay)
  const nonce = crypto.randomUUID();

  // 2. 弹 Google 账号选择器
  const authUrl = buildAuthUrl(nonce);
  const responseUrl = await browser.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true,
  });

  if (!responseUrl) {
    throw new Error('User cancelled Google login');
  }

  // 3. 从 fragment 解析 id_token
  const idToken = parseIdToken(responseUrl);

  // 4. 把 idToken + nonce 一起 POST 给后端,后端用 jose + 静态 JWKS 验签
  //    (iss / aud / 签名 / exp / nonce)
  const res = await fetch(`${SYNC_API_BASE_URL}${SYNC_API.GOOGLE_LOGIN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, nonce }),
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

/** 清除本地登录态 */
export async function clearLoginLocally(): Promise<void> {
  await Promise.all([sessionTokenCell.remove(), userCell.remove()]);
}
/**
 * 云同步相关配置(插件侧)
 *
 * 部署到生产前需要修改:
 *   1. SYNC_API_BASE_URL 改为实际后端地址
 *
 * Google OAuth 配置(launchWebAuthFlow 隐式流):
 *   - GOOGLE_CLIENT_ID 必须在 Google Cloud Console 创建 Web application OAuth client
 *   - Authorized redirect URIs 加 https://<固定扩展ID>.chromiumapp.org/
 *   - 客户端 ID 不是 secret,公开标识符,可以硬编码在扩展代码里
 *   - 当前跟 tiktok-analytics 共用同一个 client(主站 OAuth 复用)
 */

// 后端 API 基础地址
// - 生产:https://kskbl.com.cn/api  (走 nginx /api/* 反代 → 容器内 :9999)
// - 开发:http://localhost:9999  (无 /api 前缀,直接打本地后端)
export const SYNC_API_BASE_URL = 'https://kskbl.com.cn/api';

// Google OAuth Web application client(xy-newtab 项目自己的)
export const GOOGLE_CLIENT_ID = '1063346324199-bhi8p362ns5i9mbecl81d345pogn2ul6.apps.googleusercontent.com';

// Google OAuth 授权端点
export const GOOGLE_OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

// Google OAuth scope:openid email profile 让我们能拿到 email 和名字
export const GOOGLE_OAUTH_SCOPES = 'openid email profile';

// 后端 API 端点
export const SYNC_API = {
  GOOGLE_LOGIN: '/sync/auth/google',
  GOOGLE_LOGOUT: '/sync/auth/logout',
  ME: '/sync/auth/me',
  BOOKMARKS: '/sync/bookmarks',
  SESSIONS: '/sync/sessions',
} as const;

// 本地存储 key
export const SYNC_LOCAL_KEYS = {
  SESSION_TOKEN: 'local:sync.sessionToken',
  USER: 'local:sync.user',
  BOOKMARKS_VERSION: 'local:sync.bookmarksVersion',
  SESSIONS_VERSION: 'local:sync.sessionsVersion',
  BOOKMARKS_DIRTY: 'local:sync.bookmarksDirty',
  SESSIONS_DIRTY: 'local:sync.sessionsDirty',
  LAST_PULL_AT: 'local:sync.lastPullAt',
} as const;

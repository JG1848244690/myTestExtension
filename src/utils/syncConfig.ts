/**
 * 云同步相关配置(插件侧)
 *
 * 部署到生产前需要修改:
 *   1. SYNC_API_BASE_URL 改为实际后端地址
 *
 * Google Cloud Console 配置步骤:
 *   1. https://console.cloud.google.com/ 创建项目(或选已有项目)
 *   2. 启用 "Google Identity" 或 "Google+ API"
 *   3. 凭据 → 创建凭据 → OAuth 2.0 客户端 ID
 *      - 应用类型: Web 应用(因为 redirect 是 chromiumapp.org)
 *      - 已授权的重定向 URI: https://<EXTENSION_ID>.chromiumapp.org/
 *        <EXTENSION_ID> 在 chrome://extensions 开发者模式加载后查看
 *   4. 把得到的 Client ID 填到下面的 GOOGLE_CLIENT_ID
 *      ⚠️ Client Secret 只配置在后端 .env,永远不要放进插件代码或前端任何文件
 */

// 后端 API 基础地址(开发默认本地,生产改成部署地址)
export const SYNC_API_BASE_URL = 'http://localhost:9999';

// Google OAuth 2.0 Client ID(公开信息,可以放进插件代码)
export const GOOGLE_CLIENT_ID = '1063346324199-bhi8p362ns5i9mbecl81d345pogn2ul6.apps.googleusercontent.com';

// Google OAuth scope:openid email profile 让我们能拿到 email 和名字
export const GOOGLE_OAUTH_SCOPES = 'openid email profile';

// Google OAuth authorize 端点
export const GOOGLE_OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

// Google OAuth token 端点(后端用)
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Google userinfo 端点(后端用)
export const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

// 后端 API 端点
export const SYNC_API = {
  GOOGLE_LOGIN: '/sync/auth/google',
  GOOGLE_LOGOUT: '/sync/auth/logout',
  ME: '/sync/auth/me',
  BOOKMARKS: '/sync/bookmarks',
  SESSIONS: '/sync/sessions',
} as const;

// 本地存储 key
// 注意:createStorageCell 会自动补 local: 前缀,这里保持 local: 前缀是为了
// 与既存 version cell 的取值方式一致(见 googleAuth.ts / syncApi.ts 用法)。
export const SYNC_LOCAL_KEYS = {
  SESSION_TOKEN: 'local:sync.sessionToken',  // 后端颁发的 session token
  USER: 'local:sync.user',                  // 当前登录用户
  BOOKMARKS_VERSION: 'local:sync.bookmarksVersion',  // 上次同步的书签版本号
  SESSIONS_VERSION: 'local:sync.sessionsVersion',
  BOOKMARKS_DIRTY: 'local:sync.bookmarksDirty',   // 本地书签是否有未同步的变更(红点)
  SESSIONS_DIRTY: 'local:sync.sessionsDirty',     // 本地会话是否有未同步的变更(红点)
  LAST_PULL_AT: 'local:sync.lastPullAt',          // 上次首次拉取的时间戳(节流用)
} as const;

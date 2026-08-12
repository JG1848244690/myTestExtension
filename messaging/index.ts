import { defineExtensionMessaging } from '@webext-core/messaging';
import type { Shortcut, TabSession } from '@/src/utils/types';
import type { SyncUser } from '@/src/utils/googleAuth';
import type { SyncScope } from '@/src/utils/syncDirty';

/** 手动同步操作的统一返回结构 */
export type SyncOpResult = { success: boolean; error?: string };

// 消息协议: 函数名 => 参数类型 => 返回值类型
interface ProtocolMap {
  // 快捷方式相关
  'shortcuts/get-all': () => Shortcut[];
  'shortcuts/add': (shortcut: Omit<Shortcut, 'id'>) => Shortcut;
  'shortcuts/add-batch': (items: Omit<Shortcut, 'id'>[]) => Shortcut[];
  'shortcuts/remove': (id: string) => boolean;

  // 设置相关
  'settings/get': () => Record<string, unknown>;
  'settings/set': (settings: Record<string, unknown>) => boolean;

  // Favicon 获取(通过 background 绕过 CORS)
  'favicon/fetch': (url: string) => string | null;

  // 从 Chrome 新标签页导入书签
  'shortcuts/import-from-newtab': () => { shortcuts: { name: string; url: string }[]; success: boolean; error?: string };

  // 标签页会话管理
  'tab-sessions/save': () => { success: boolean; session?: TabSession; error?: string };
  'tab-sessions/list': () => TabSession[];
  'tab-sessions/restore': (sessionId: string) => { success: boolean; error?: string };
  'tab-sessions/delete': (sessionId: string) => { success: boolean; error?: string };

  // === 云同步(手动模型) ===
  // 新标签页打开时:首次/距上次拉取超 30min → 拉取云端 + merge 到本地(由 newtab/App.tsx 节流)
  'sync/on-new-tab': () => SyncOpResult;
  // 手动上传:本地整包 → 云端(覆盖云)
  'sync/upload': (scope: SyncScope) => SyncOpResult;
  // 手动下载:云端 → 本地(覆盖本地)
  'sync/download': (scope: SyncScope) => SyncOpResult;

  // === 云同步登录相关 ===
  // 读取当前登录的用户(从本地缓存读,不调网络)
  'auth/get-user': () => SyncUser | null;
  // 登录: 弹出 Google 授权窗口 → 后端验签建用户 → 本地同步
  'auth/login': () => { success: boolean; user?: SyncUser; error?: string };
  // 登出: 清除本地 sessionToken + user(同时通知后端注销)
  'auth/logout': () => { success: boolean; error?: string };
}

// 创建 messenger
export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();

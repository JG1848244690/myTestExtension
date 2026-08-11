import { defineExtensionMessaging } from '@webext-core/messaging';
import type { Shortcut, TabSession, SyncResult } from '@/src/utils/types';

// 定义消息协议：函数签名 = 参数类型 => 返回值类型
interface ProtocolMap {
  // 快捷方式相关
  'shortcuts/get-all': () => Shortcut[];
  'shortcuts/add': (shortcut: Omit<Shortcut, 'id'>) => Shortcut;
  'shortcuts/add-batch': (shortcuts: Omit<Shortcut, 'id'>[]) => Shortcut[];
  'shortcuts/remove': (id: string) => boolean;

  // 设置相关
  'settings/get': () => Record<string, unknown>;
  'settings/set': (settings: Record<string, unknown>) => boolean;

  // Favicon 获取（通过 background 绕过 CORS）
  'favicon/fetch': (url: string) => string | null;

  // 从 Chrome 新标签页导入书签
  'shortcuts/import-from-newtab': () => { shortcuts: { name: string; url: string }[]; success: boolean; error?: string };

  // 标签页会话管理
  'tab-sessions/save': () => { success: boolean; session?: TabSession; error?: string };
  'tab-sessions/list': () => TabSession[];
  'tab-sessions/restore': (sessionId: string) => { success: boolean; error?: string };
  'tab-sessions/delete': (sessionId: string) => { success: boolean; error?: string };

  // 标签页会话云同步（只同步 sessions）
  // ⚠️ 临时不可用 — 等接入后端后启用；详见 docs/2026-06-02-cloud-sync-fix-plan.md
  // 后端就绪前，调用会通过 background 的 stub handler 收到 success: false 错误
  'tab-sessions/sync-upload': () => SyncResult;
  'tab-sessions/sync-download': () => SyncResult;

  // 书签 + 分组云同步（shortcuts + groups，不含 sessions）
  // ⚠️ 临时不可用 — 同上
  'bookmarks/sync-upload': () => SyncResult;
  'bookmarks/sync-download': () => SyncResult;
}

// 创建 messenger
export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();

import { onMessage } from '@/messaging';
import { storage } from '@wxt-dev/storage';
import { setupSyncInit, pullAndMerge, uploadLocal, downloadCloud } from '@/src/utils/syncAuto';
import { markDirty } from '@/src/utils/syncDirty';
import {
  loginWithGoogle,
  saveLoginLocally,
  readSessionToken,
  readCurrentUser,
  clearLoginLocally,
} from '@/src/utils/googleAuth';
import { SYNC_API_BASE_URL, SYNC_API } from '@/src/utils/syncConfig';
import { LOCAL_STORAGE_KEY, SESSION_LIMITS } from '@/src/utils/constants';
import type { Shortcut, TabSession, TabInfo } from '@/src/utils/types';

// 存储键（带 local: 前缀，详见 LOCAL_STORAGE_KEY）
const SHORTCUTS_KEY = LOCAL_STORAGE_KEY.SHORTCUTS;
const GROUPS_KEY = LOCAL_STORAGE_KEY.GROUPS;
const TAB_SESSIONS_KEY = LOCAL_STORAGE_KEY.TAB_SESSIONS;

/*
 * ============================================================================
 * 云同步说明(手动同步模型)
 * ============================================================================
 *
 * 当前方案:独立后端 (SYNC_API_BASE_URL) + Google OAuth 授权码模式。
 *   - setupSyncInit() 只初始化 deviceId,不再订阅自动 push
 *   - 'sync/on-new-tab'  首次/距上次>30min 时 pullAndMerge(由 newtab 节流)
 *   - 'sync/upload'      手动上传(本地→云)
 *   - 'sync/download'    手动下载(云→本地)
 *   - 用户改书签/会话 → markDirty → UI 红点;上传/下载成功 → clearDirty
 *   - 详细逻辑在 src/utils/syncAuto.ts,脏标记在 src/utils/syncDirty.ts,
 *     鉴权在 src/utils/googleAuth.ts
 *
 * 文件下方 (CLOUD SYNC DISABLED 注释块) 是旧的 chrome.storage.sync 实现,
 * 已废弃,仅留作参考。新的后端方案不依赖 chrome.storage.sync。
 * ============================================================================
 */

export default defineBackground(() => {
  console.log('[Extension] Background script loaded', { id: browser.runtime.id });

  // init: 只初始化 deviceId(不再订阅自动 push)
  setupSyncInit().catch((e) => console.warn('[sync] init failed:', e));

  // ===== 手动同步 =====

  // 新标签页打开时(newtab/App.tsx 节流:距上次>30min 才发)→ 拉取云端 + merge
  onMessage('sync/on-new-tab', async () => {
    const [bm, ss] = await Promise.all([
      pullAndMerge('bookmarks'),
      pullAndMerge('sessions'),
    ]);
    return { success: bm.success && ss.success, error: bm.error || ss.error };
  });

  // 手动上传:本地 → 云
  onMessage('sync/upload', async ({ data: scope }) => {
    return await uploadLocal(scope);
  });

  // 手动下载:云 → 本地
  onMessage('sync/download', async ({ data: scope }) => {
    return await downloadCloud(scope);
  });

  // ===== Auth =====

  onMessage('auth/get-user', async () => {
    return await readCurrentUser();
  });

  onMessage('auth/login', async () => {
    try {
      const { sessionToken, user } = await loginWithGoogle();
      await saveLoginLocally(sessionToken, user);
      // 登录后立即拉取云端 merge(把别的设备的数据拉下来)
      void pullAndMerge('bookmarks').catch((e) => console.warn('[sync] post-login bookmarks pull failed:', e));
      void pullAndMerge('sessions').catch((e) => console.warn('[sync] post-login sessions pull failed:', e));
      return { success: true, user };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[Auth] login failed:', message);
      return { success: false, error: message };
    }
  });

  onMessage('auth/logout', async () => {
    try {
      const token = await readSessionToken();
      if (token) {
        try {
          await fetch(`${SYNC_API_BASE_URL}${SYNC_API.GOOGLE_LOGOUT}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch (e) {
          console.warn('[Auth] backend logout failed (continuing):', e);
        }
      }
      await clearLoginLocally();
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  // ===== 快捷方式 / 书签 =====

  onMessage('shortcuts/get-all', async () => {
    const shortcuts = await storage.getItem<Shortcut[]>(SHORTCUTS_KEY);
    return shortcuts || [];
  });

  onMessage('shortcuts/add', async ({ data }) => {
    const shortcuts = await storage.getItem<Shortcut[]>(SHORTCUTS_KEY) || [];
    const newShortcut: Shortcut = {
      ...data,
      id: Date.now().toString(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await storage.setItem(SHORTCUTS_KEY, [...shortcuts, newShortcut]);
    return newShortcut;
  });

  onMessage('shortcuts/remove', async ({ data: id }) => {
    const shortcuts = await storage.getItem<Shortcut[]>(SHORTCUTS_KEY) || [];
    const filtered = shortcuts.filter(s => s.id !== id);
    await storage.setItem(SHORTCUTS_KEY, filtered);
    return true;
  });

  // 注册消息处理器 - Favicon fetch（绕过 CORS）
  onMessage('favicon/fetch', async ({ data: url }) => {
    try {
      const response = await fetch(url, {
        credentials: 'omit',
      });

      if (!response.ok) {
        return null;
      }

      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.onerror = () => {
          resolve('');
        };
        reader.readAsDataURL(blob);
      });

      return base64 || null;
    } catch (error) {
        console.error('[Background] Failed to fetch favicon:', error);
        return null;
    }
  });

  // 注册消息处理器 - 从 Chrome 书签导入快捷方式
  onMessage('shortcuts/import-from-newtab', async () => {
    try {
      // 使用 Chrome Bookmarks API 读取书签
      const bookmarks = await browser.bookmarks.getTree();

      const shortcuts: { name: string; url: string }[] = [];

      // 递归遍历书签树
      const traverseBookmarks = (nodes: typeof bookmarks) => {
        for (const node of nodes) {
          if (node.url && node.title) {
            // 只导入 http/https 链接
            if (node.url.startsWith('http://') || node.url.startsWith('https://')) {
              shortcuts.push({
                name: node.title,
                url: node.url,
              });
            }
          }
          if (node.children) {
            traverseBookmarks(node.children);
          }
        }
      };

      traverseBookmarks(bookmarks);

      return {
        shortcuts,
        success: true,
      };
    } catch (error) {
      console.error('[Background] Failed to import bookmarks:', error);
      return {
        shortcuts: [],
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  });

  // 注册消息处理器 - 标签页会话管理
  onMessage('tab-sessions/save', async () => {
    try {
      // 获取所有窗口的所有标签页
      const allTabs = await browser.tabs.query({});

      // 过滤掉浏览器内部页面
      const validTabs: TabInfo[] = allTabs
        .filter(tab => {
          if (!tab.url) return false;
          // 只保存 http/https 协议的标签页
          return tab.url.startsWith('http://') || tab.url.startsWith('https://');
        })
        .map(tab => ({
          url: tab.url!,
          title: tab.title || tab.url!,
        }));

      // 限制每个存档最多 30 个标签页
      const tabs = validTabs.slice(0, SESSION_LIMITS.MAX_TABS_PER_SESSION);

      const now = Date.now();
      const newSession: TabSession = {
        id: now.toString(),
        title: `会话 - ${new Date(now).toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
        createdAt: now,
        tabCount: tabs.length,
        tabs,
      };

      // 读取现有会话
      const sessions = await storage.getItem<TabSession[]>(TAB_SESSIONS_KEY) || [];

      // 队列机制：新存档插入头部，超出 5 个则淘汰末尾
      const updatedSessions = [newSession, ...sessions].slice(0, SESSION_LIMITS.MAX_SESSIONS);

      await storage.setItem(TAB_SESSIONS_KEY, updatedSessions);

      // 用户保存了新会话 → 标脏(红点提示去手动同步)
      void markDirty('sessions');

      return { success: true, session: newSession };
    } catch (error) {
      console.error('[Background] Failed to save session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  });

  onMessage('tab-sessions/list', async () => {
    const sessions = await storage.getItem<TabSession[]>(TAB_SESSIONS_KEY);
    return sessions || [];
  });

  onMessage('tab-sessions/restore', async ({ data: sessionId }) => {
    try {
      const sessions = await storage.getItem<TabSession[]>(TAB_SESSIONS_KEY) || [];
      const session = sessions.find(s => s.id === sessionId);

      if (!session) {
        return { success: false, error: '会话未找到' };
      }

      // 批量打开标签页（最后一个标签页激活，其他在后台打开）
      for (let i = 0; i < session.tabs.length; i++) {
        const tab = session.tabs[i];
        await browser.tabs.create({
          url: tab.url,
          active: i === session.tabs.length - 1, // 最后一个标签页激活
        });
      }

      return { success: true };
    } catch (error) {
      console.error('[Background] Failed to restore session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  });

  onMessage('tab-sessions/delete', async ({ data: sessionId }) => {
    try {
      const sessions = await storage.getItem<TabSession[]>(TAB_SESSIONS_KEY) || [];
      const filtered = sessions.filter(s => s.id !== sessionId);

      if (filtered.length === sessions.length) {
        return { success: false, error: '会话未找到' };
      }

      await storage.setItem(TAB_SESSIONS_KEY, filtered);

      // 用户删除了会话 → 标脏
      void markDirty('sessions');

      return { success: true };
    } catch (error) {
      console.error('[Background] Failed to delete session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  });

  /* CLOUD SYNC DISABLED — 等待接入后端（详见文件顶部说明）
  // ─── 云同步辅助函数 ───

  // 获取 JSON 序列化后的 UTF-8 字节长度
  const jsonByteSize = (obj: unknown): number => {
    return new TextEncoder().encode(JSON.stringify(obj)).length;
  };

  // 按字节长度安全地切分字符串（避免在 multi-byte 字符中间断开）
  // 实现要点：
  // 1. 一次性 encode 为 Uint8Array,O(n) 单次遍历
  // 2. 切分点如果是 UTF-8 续字节（0x80-0xBF），向前回退到字符首字节
  // 3. 假设 limit 远大于任何单字符（limit=7000,UTF-8 单字符最多 4 字节）
  const splitStringByBytes = (str: string, limit: number): string[] => {
    if (str.length === 0) return [];

    const bytes = new TextEncoder().encode(str);
    const chunks: string[] = [];
    const decoder = new TextDecoder(); // 默认 fatal=false,对残余字节容错
    let offset = 0;

    while (offset < bytes.length) {
      let end = Math.min(offset + limit, bytes.length);

      // 切分点如果在多字节字符中间,向前回退到字符首字节
      if (end < bytes.length) {
        while (end > offset && (bytes[end] & 0xc0) === 0x80) {
          end--;
        }
      }

      chunks.push(decoder.decode(bytes.subarray(offset, end)));
      offset = end;
    }

    return chunks;
  };

  // 将数据分块存储到 chrome.storage.sync
  const storeChunks = async (key: string, data: unknown): Promise<number> => {
    const json = JSON.stringify(data);
    const totalBytes = jsonByteSize(data);

    if (totalBytes === 0) return 0;

    if (totalBytes <= CHUNK_BYTE_LIMIT) {
      await trackSet({ [`${CLOUD_DATA_PREFIX}${key}_0`]: json });
      return 1;
    }

    // 按字节分多块
    const chunks = splitStringByBytes(json, CHUNK_BYTE_LIMIT);
    for (let i = 0; i < chunks.length; i++) {
      await trackSet({ [`${CLOUD_DATA_PREFIX}${key}_${i}`]: chunks[i] });
    }
    return chunks.length;
  };

  // 从 chrome.storage.sync 读取分块数据并还原
  const readChunks = async (key: string, chunkCount: number): Promise<string | null> => {
    const syncData = browser.storage.sync;
    const keys = Array.from({ length: chunkCount }, (_, i) => `${CLOUD_DATA_PREFIX}${key}_${i}`);
    const result = await syncData.get(keys);

    let json = '';
    for (let i = 0; i < chunkCount; i++) {
      const chunk = result[`${CLOUD_DATA_PREFIX}${key}_${i}`];
      if (typeof chunk !== 'string') return null;
      json += chunk;
    }
    return json || null;
  };

  // 清理云端孤儿 key（已经不在新数据中的旧 session）
  const cleanupOrphanSessions = async (oldSessionIds: string[], newSessionIds: string[]) => {
    if (oldSessionIds.length === 0) return;
    const orphanIds = oldSessionIds.filter(id => !newSessionIds.includes(id));
    if (orphanIds.length === 0) return;

    const syncData = browser.storage.sync;
    await syncData.remove(orphanIds.map(id => `${SYNC_SESSION_PREFIX}${id}`));
  };

  // 清理云端所有不在 meta.sessionIds 中的 tabSession_* 孤儿
  // 用于 sync-download 后（云端可能残留其他设备删除后未清理的 session）
  const cleanupAllOrphanSessions = async (validSessionIds: string[]) => {
    const syncData = browser.storage.sync;
    // 列出云端所有 key
    const allCloudData = await syncData.get(null);
    const allSessionKeys = Object.keys(allCloudData).filter(k =>
      k.startsWith(SYNC_SESSION_PREFIX)
    );
    const validKeys = new Set(
      validSessionIds.map(id => `${SYNC_SESSION_PREFIX}${id}`)
    );
    const orphanKeys = allSessionKeys.filter(k => !validKeys.has(k));
    if (orphanKeys.length > 0) {
      await syncData.remove(orphanKeys);
    }
    return orphanKeys.length;
  };

  // ===== 共享同步内部函数 =====
  // scope: 'bookmark' 同步 shortcuts+groups; 'session' 同步 tab sessions
  // 两个 scope 用独立的 meta key(CLOUD_META_BOOKMARK_KEY / CLOUD_META_SESSION_KEY)
  // 避免跨 scope 互相覆盖

  type SyncScope = 'bookmark' | 'session';

  // 提取对应 scope 的 meta key
  const getMetaKey = (scope: SyncScope) =>
    scope === 'bookmark' ? CLOUD_META_BOOKMARK_KEY : CLOUD_META_SESSION_KEY;

  const doSyncUpload = async (scope: SyncScope): Promise<SyncResult> => {
    resetTrackedKeys();
    const syncData = browser.storage.sync;
    const metaKey = getMetaKey(scope);

    try {
      // ===== 读本地数据(scope 决定范围)=====
      const [sessions, shortcuts, groups] = await Promise.all([
        storage.getItem<TabSession[]>(TAB_SESSIONS_KEY),
        storage.getItem<Shortcut[]>(SHORTCUTS_KEY),
        storage.getItem<ShortcutGroup[]>(GROUPS_KEY),
      ]);

      const hasData =
        scope === 'bookmark'
          ? Boolean((shortcuts && shortcuts.length) || (groups && groups.length))
          : Boolean(sessions && sessions.length);

      if (!hasData) {
        return {
          success: false,
          error: scope === 'bookmark' ? '没有可同步的书签或分组' : '没有可同步的会话',
        };
      }

      // ===== 多设备冲突检测 =====
      const localLastSync = await storage.getItem<number>(LAST_SYNC_KEY);
      const cloudMetaForCheck = (await syncData.get(metaKey))[metaKey] as
        | { updatedAt: number }
        | undefined;
      if (
        cloudMetaForCheck?.updatedAt &&
        localLastSync &&
        cloudMetaForCheck.updatedAt > localLastSync
      ) {
        return {
          success: false,
          error: '云端数据比本地新，请先下载再上传（避免覆盖其他设备的更新）',
        };
      }

      // ===== 总配额预检 =====
      const META_BYTES_ESTIMATE = 200;
      const newBytesEstimate =
        scope === 'bookmark'
          ? new TextEncoder().encode(JSON.stringify({ shortcuts: shortcuts ?? [], groups: groups ?? [] })).length + META_BYTES_ESTIMATE
          : (sessions || []).reduce(
              (sum, s) => sum + (s.tabs.length === 0 ? 0 : jsonByteSize(s)),
              0
            ) + META_BYTES_ESTIMATE;

      const currentBytes = await syncData.getBytesInUse();
      const estimatedTotal = currentBytes + newBytesEstimate;
      if (estimatedTotal > SYNC_TOTAL_BYTE_LIMIT) {
        return {
          success: false,
          error: `云端空间不足（预估需要 ${Math.round(
            estimatedTotal / 1024
          )}KB，限制 ${SYNC_TOTAL_BYTE_LIMIT / 1024}KB），请删除部分数据后再试`,
        };
      }

      // ===== 写数据(scope 决定范围)=====
      const now = Date.now();

      if (scope === 'bookmark') {
        // 写一个 main chunk(覆盖)
        const mainData = {
          shortcuts: shortcuts ?? [],
          groups: groups ?? [],
        };
        const chunkCount = await storeChunks('main', mainData);
        await trackSet({
          [metaKey]: { version: 1, chunkCount, updatedAt: now },
        });
      } else {
        // session-scope: 写每条 session + meta
        const oldMeta = (await syncData.get(metaKey))[metaKey] as
          | { sessionIds: string[] }
          | undefined;
        const oldSessionIds = oldMeta?.sessionIds || [];

        const syncedSessionIds: string[] = [];
        for (const session of sessions!) {
          if (session.tabs.length === 0) continue;
          if (jsonByteSize(session) > CHUNK_BYTE_LIMIT) {
            const truncated = { ...session, tabs: [...session.tabs] };
            while (
              truncated.tabs.length > 0 &&
              jsonByteSize(truncated) > CHUNK_BYTE_LIMIT
            ) {
              truncated.tabs = truncated.tabs.slice(0, -1);
            }
            if (truncated.tabs.length === 0) continue;
            await trackSet({
              [`${SYNC_SESSION_PREFIX}${truncated.id}`]: {
                ...truncated,
                tabCount: truncated.tabs.length,
              },
            });
          } else {
            await trackSet({ [`${SYNC_SESSION_PREFIX}${session.id}`]: session });
          }
          syncedSessionIds.push(session.id);
        }

        await trackSet({
          [metaKey]: { version: 1, sessionIds: syncedSessionIds, updatedAt: now },
        });

        // 清理孤儿 session
        await cleanupOrphanSessions(oldSessionIds, syncedSessionIds);
      }

      await storage.setItem(LAST_SYNC_KEY, now);

      return { success: true, lastSyncAt: now };
    } catch (error) {
      console.error(`[Background] Failed to sync upload (${scope}):`, error);
      // 回滚
      if (trackedWriteKeys.size > 0) {
        try {
          await browser.storage.sync.remove([...trackedWriteKeys]);
          console.warn(`[Background] Rolled back ${trackedWriteKeys.size} keys (${scope})`);
        } catch (rollbackErr) {
          console.error('[Background] Rollback failed:', rollbackErr);
        }
      }
      const msg = error instanceof Error ? error.message : '未知错误';
      if (msg.includes('QUOTA_BYTES_PER_ITEM')) {
        return { success: false, error: '单条数据超过 8KB，请减少数据量' };
      }
      if (msg.includes('QUOTA_BYTES')) {
        return {
          success: false,
          error: `云存储总空间不足（限制 ${SYNC_TOTAL_BYTE_LIMIT / 1024}KB），请删除部分数据后再试`,
        };
      }
      return { success: false, error: `上传失败: ${msg}` };
    }
  };

  const doSyncDownload = async (scope: SyncScope): Promise<SyncResult> => {
    const syncData = browser.storage.sync;
    const metaKey = getMetaKey(scope);

    try {
      const raw = await syncData.get(metaKey);
      const meta = raw[metaKey] as
        | { version: number; chunkCount?: number; sessionIds?: string[]; updatedAt: number }
        | undefined;

      if (!meta) {
        return {
          success: false,
          error: scope === 'bookmark'
            ? '云端没有保存的书签，请先在任意设备上传'
            : '云端没有保存的会话，请先在任意设备上传',
        };
      }

      if (scope === 'bookmark') {
        // 读 main chunk
        let shortcuts: Shortcut[] = [];
        let groups: ShortcutGroup[] = [];
        if (meta.chunkCount && meta.chunkCount > 0) {
          const mainJson = await readChunks('main', meta.chunkCount);
          if (mainJson) {
            try {
              const parsed = JSON.parse(mainJson);
              shortcuts = parsed.shortcuts || [];
              groups = parsed.groups || [];
            } catch {
              return { success: false, error: '云端数据损坏，解析失败' };
            }
          }
        }

        // 清理 ghost reference：groups.shortcutIds 中引用了不存在快捷方式 ID 的项
        const validShortcutIds = new Set(shortcuts.map(s => s.id));
        const cleanedGroups = groups.map(g => {
          const filtered = g.shortcutIds.filter(id => validShortcutIds.has(id));
          if (filtered.length === g.shortcutIds.length) return g;
          return { ...g, shortcutIds: filtered, updatedAt: Date.now() };
        });
        const hadGhostRefs = cleanedGroups.some(
          (g, i) => g.shortcutIds.length !== groups[i].shortcutIds.length
        );

        await Promise.all([
          storage.setItem(SHORTCUTS_KEY, shortcuts),
          storage.setItem(GROUPS_KEY, hadGhostRefs ? cleanedGroups : groups),
        ]);
      } else {
        // session-scope: 读所有 session
        const sessionIds = meta.sessionIds || [];
        if (sessionIds.length === 0) {
          // 云端没有任何 session
          await storage.setItem(TAB_SESSIONS_KEY, []);
        } else {
          const sessionKeys = sessionIds.map(id => `${SYNC_SESSION_PREFIX}${id}`);
          const sessionResult = await syncData.get(sessionKeys);

          const cloudSessions: TabSession[] = [];
          for (const id of sessionIds) {
            const session = sessionResult[`${SYNC_SESSION_PREFIX}${id}`] as
              | TabSession
              | undefined;
            if (session) cloudSessions.push(session);
          }

          cloudSessions.sort((a, b) => b.createdAt - a.createdAt);
          const trimmedSessions = cloudSessions.slice(0, SESSION_LIMITS.MAX_SESSIONS);
          await storage.setItem(TAB_SESSIONS_KEY, trimmedSessions);
        }

        // 清理云端 tabSession_* 孤儿
        try {
          await cleanupAllOrphanSessions(sessionIds);
        } catch (cleanupErr) {
          console.warn('[Background] Failed to cleanup orphan sessions:', cleanupErr);
        }
      }

      const now = Date.now();
      await storage.setItem(LAST_SYNC_KEY, now);
      return { success: true, lastSyncAt: now };
    } catch (error) {
      console.error(`[Background] Failed to sync download (${scope}):`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  };

  // ===== 4 个 message handler 全部走 withSyncLock 保护 =====

  // 会话同步（popup SessionTab 用）

  */


});

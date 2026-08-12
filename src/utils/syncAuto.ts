/**
 * 手动云同步 —— 「首次合并拉取 + 手动覆盖按钮 + 红点提示」
 *
 * 模型(改造自旧的"自动无感 push",去掉了后台自动推送,接口量降一个数量级):
 *   1. 首次拉取 pullAndMerge:newtab 挂载且距上次 >30min → GET 云端 →
 *      与本地 merge → 写本地。不丢本地数据。
 *   2. 手动上传 uploadLocal:本地整包 PUT 云端(覆盖云)。409 → merge 重试一次。
 *   3. 手动下载 downloadCloud:云端整包覆盖本地。
 *   4. 红点:任何用户 mutation → markDirty;上传/下载成功 → clearDirty。
 *
 * 关键不变量:
 *   - dirty ⟺ 本地与云端不一致(用户改了没传 / 拉取后本地比云多)。
 *   - 同步写入直接走 storage.setItem,绕过 store action,不会触发 markDirty;
 *     store 的 cell.watch 会自动把新值回灌内存,UI 照常刷新。
 *   - 401 → 清登录态(handleUnauthorized 已处理),UI 回到未登录。
 */

import { storage } from '@wxt-dev/storage';
import { createStorageCell } from '@/src/lib/storage';
import {
  downloadBookmarks,
  uploadBookmarks,
  downloadSessions,
  uploadSessions,
  SyncAuthError,
} from './syncApi';
import { readSessionToken, clearLoginLocally } from './googleAuth';
import { LOCAL_STORAGE_KEY, SESSION_LIMITS } from '@/src/utils/constants';
import {
  markDirty,
  clearDirty,
  writePullAt,
  type SyncScope,
} from './syncDirty';
import type { Shortcut, ShortcutGroup, TabSession } from '@/src/utils/types';

// ============================================================
// Types
// ============================================================

export type { SyncScope };

export interface SyncOpResult {
  success: boolean;
  error?: string;
}

interface DeviceIdCell {
  read(): Promise<string | undefined>;
  write(v: string): Promise<void>;
}
const deviceIdCell: DeviceIdCell = createStorageCell<string>('local:sync.deviceId');

interface BookmarksPayload {
  shortcuts: Shortcut[];
  groups: ShortcutGroup[];
}

// ============================================================
// Device ID(每设备唯一)
// ============================================================

let cachedDeviceId: string | null = null;

async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  let id = await deviceIdCell.read();
  if (!id) {
    id = crypto.randomUUID();
    await deviceIdCell.write(id);
  }
  cachedDeviceId = id;
  return id;
}

/**
 * background 启动时调一次:只初始化 deviceId。
 * 不再订阅 storage.watch 自动 push(那是旧模型,已移除)。
 */
export async function setupSyncInit(): Promise<void> {
  await getDeviceId();
  console.log('[sync] init done, deviceId:', cachedDeviceId);
}

// ============================================================
// 合并:bookmarks(per-item last-write-wins by updatedAt)
// ============================================================

export function mergeBookmarks(
  local: BookmarksPayload,
  server: BookmarksPayload | null,
): BookmarksPayload {
  if (!server) return local;

  // shortcuts: 按 updatedAt last-write-wins
  const shortcutById = new Map<string, Shortcut>();
  for (const s of local.shortcuts) shortcutById.set(s.id, s);
  for (const s of server.shortcuts ?? []) {
    const ex = shortcutById.get(s.id);
    if (!ex || s.updatedAt > ex.updatedAt) {
      shortcutById.set(s.id, s);
    }
  }
  const mergedShortcuts = [...shortcutById.values()];

  // groups: 同样逻辑
  const groupById = new Map<string, ShortcutGroup>();
  for (const g of local.groups) groupById.set(g.id, g);
  for (const g of server.groups ?? []) {
    const ex = groupById.get(g.id);
    if (!ex || g.updatedAt > ex.updatedAt) {
      groupById.set(g.id, g);
    }
  }
  const mergedGroups = [...groupById.values()];

  // 清理孤儿引用(groups.shortcutIds 中引用了不存在的 shortcut)
  const validIds = new Set(mergedShortcuts.map((s) => s.id));
  const cleanedGroups = mergedGroups.map((g) => {
    const filtered = g.shortcutIds.filter((id) => validIds.has(id));
    if (filtered.length === g.shortcutIds.length) return g;
    return { ...g, shortcutIds: filtered, updatedAt: Date.now() };
  });

  return { shortcuts: mergedShortcuts, groups: cleanedGroups };
}

// ============================================================
// 合并:sessions(per-item last-write-wins by createdAt,截断 MAX_SESSIONS)
// ============================================================

export function mergeSessions(local: TabSession[], server: TabSession[] | null): TabSession[] {
  const byId = new Map<string, TabSession>();
  for (const s of local) byId.set(s.id, s);
  for (const s of server ?? []) {
    const ex = byId.get(s.id);
    if (!ex || s.createdAt > ex.createdAt) {
      byId.set(s.id, s);
    }
  }
  const sorted = [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
  return sorted.slice(0, SESSION_LIMITS.MAX_SESSIONS);
}

// ============================================================
// 本地读写(直接 storage,绕过 store action → 不触发 markDirty)
// ============================================================

async function readLocalBookmarks(): Promise<BookmarksPayload> {
  const [shortcuts, groups] = await Promise.all([
    storage.getItem<Shortcut[]>(LOCAL_STORAGE_KEY.SHORTCUTS),
    storage.getItem<ShortcutGroup[]>(LOCAL_STORAGE_KEY.GROUPS),
  ]);
  // ?? 必须在 await 之后做 null 合并:对 Promise 取值永远是 truthy,无效。
  return { shortcuts: shortcuts ?? [], groups: groups ?? [] };
}

async function writeLocalBookmarks(payload: BookmarksPayload): Promise<void> {
  await Promise.all([
    storage.setItem(LOCAL_STORAGE_KEY.SHORTCUTS, payload.shortcuts),
    storage.setItem(LOCAL_STORAGE_KEY.GROUPS, payload.groups),
  ]);
}

async function readLocalSessions(): Promise<TabSession[]> {
  return (await storage.getItem<TabSession[]>(LOCAL_STORAGE_KEY.TAB_SESSIONS)) ?? [];
}

async function writeLocalSessions(sessions: TabSession[]): Promise<void> {
  await storage.setItem(LOCAL_STORAGE_KEY.TAB_SESSIONS, sessions);
}

const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

// ============================================================
// 1. 首次拉取:GET → merge → 写本地 → 更新 dirty
// ============================================================

async function pullAndMergeBookmarks(): Promise<SyncOpResult> {
  const local = await readLocalBookmarks();

  const dl = await downloadBookmarks<BookmarksPayload>();
  // 404(云端尚无数据)→ serverPayload=null,merge 退化为返回 local 本身
  const serverPayload = dl.ok ? dl.snapshot.payload : null;

  const merged = mergeBookmarks(local, serverPayload);

  // 云端有本地没有的 → 写本地(吸收云端新增)
  if (!sameJson(merged, local)) {
    await writeLocalBookmarks(merged);
  }

  // dirty 语义:本地是否与云端一致
  if (serverPayload === null) {
    // 云端空:本地也空 → 一致;本地非空 → 本地领先,标脏提示上传
    if (merged.shortcuts.length === 0 && merged.groups.length === 0) {
      await clearDirty('bookmarks');
    } else {
      await markDirty('bookmarks');
    }
  } else {
    if (sameJson(merged, serverPayload)) {
      await clearDirty('bookmarks');
    } else {
      await markDirty('bookmarks');
    }
  }

  return { success: true };
}

async function pullAndMergeSessions(): Promise<SyncOpResult> {
  const local = await readLocalSessions();

  const dl = await downloadSessions<{ sessions: TabSession[] }>();
  const serverSessions = dl.ok ? (dl.snapshot.payload?.sessions ?? []) : null;

  const merged = mergeSessions(local, serverSessions);

  if (!sameJson(merged, local)) {
    await writeLocalSessions(merged);
  }

  if (serverSessions === null) {
    if (merged.length === 0) await clearDirty('sessions');
    else await markDirty('sessions');
  } else {
    if (sameJson(merged, serverSessions)) await clearDirty('sessions');
    else await markDirty('sessions');
  }

  return { success: true };
}

export async function pullAndMerge(scope: SyncScope): Promise<SyncOpResult> {
  if (!(await readSessionToken())) return { success: false, error: '未登录' };
  try {
    const r =
      scope === 'bookmarks' ? await pullAndMergeBookmarks() : await pullAndMergeSessions();
    // 无论 merge 结果如何,这次"尝试拉取"都算发生过了 → 刷新节流时间戳
    await writePullAt(Date.now());
    return r;
  } catch (err) {
    if (err instanceof SyncAuthError) {
      await clearLoginLocally().catch(() => {});
      return { success: false, error: '登录已失效,请重新登录' };
    }
    console.warn(`[sync] pullAndMerge(${scope}) error:`, err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ============================================================
// 2. 手动上传:本地 → 云(409 冲突 → merge 重试一次)
// ============================================================

async function uploadLocalBookmarks(): Promise<SyncOpResult> {
  const local = await readLocalBookmarks();
  const result = await uploadBookmarks<BookmarksPayload>(local);

  if (result.ok) {
    await clearDirty('bookmarks');
    return { success: true };
  }

  // 409:云端在此期间被别的设备更新了 → 拿云端当前值 merge 后重试一次
  if ('conflict' in result) {
    const serverPayload = (result.conflict.currentPayload ?? {
      shortcuts: [],
      groups: [],
    }) as BookmarksPayload;
    const merged = mergeBookmarks(local, serverPayload);
    if (!sameJson(merged, local)) await writeLocalBookmarks(merged);
    const retry = await uploadBookmarks<BookmarksPayload>(merged, result.conflict.currentVersion);
    if (retry.ok) {
      await clearDirty('bookmarks');
      return { success: true };
    }
    return { success: false, error: '云端有更新,请先下载再上传' };
  }

  return { success: false, error: result.error };
}

async function uploadLocalSessions(): Promise<SyncOpResult> {
  const local = await readLocalSessions();
  const result = await uploadSessions<{ sessions: TabSession[] }>({ sessions: local });

  if (result.ok) {
    await clearDirty('sessions');
    return { success: true };
  }

  if ('conflict' in result) {
    const serverSessions =
      ((result.conflict.currentPayload as { sessions?: TabSession[] } | null)?.sessions) ?? [];
    const merged = mergeSessions(local, serverSessions);
    if (!sameJson(merged, local)) await writeLocalSessions(merged);
    const retry = await uploadSessions<{ sessions: TabSession[] }>(
      { sessions: merged },
      result.conflict.currentVersion,
    );
    if (retry.ok) {
      await clearDirty('sessions');
      return { success: true };
    }
    return { success: false, error: '云端有更新,请先下载再上传' };
  }

  return { success: false, error: result.error };
}

export async function uploadLocal(scope: SyncScope): Promise<SyncOpResult> {
  if (!(await readSessionToken())) return { success: false, error: '未登录' };
  try {
    return scope === 'bookmarks' ? await uploadLocalBookmarks() : await uploadLocalSessions();
  } catch (err) {
    if (err instanceof SyncAuthError) {
      await clearLoginLocally().catch(() => {});
      return { success: false, error: '登录已失效,请重新登录' };
    }
    console.warn(`[sync] uploadLocal(${scope}) error:`, err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ============================================================
// 3. 手动下载:云 → 本地(整包覆盖)
// ============================================================

async function downloadCloudBookmarks(): Promise<SyncOpResult> {
  const dl = await downloadBookmarks<BookmarksPayload>();
  if (!dl.ok) {
    return { success: false, error: '云端还没有书签数据,请先上传' };
  }
  const payload = dl.snapshot.payload;
  await writeLocalBookmarks({
    shortcuts: payload?.shortcuts ?? [],
    groups: payload?.groups ?? [],
  });
  await clearDirty('bookmarks');
  return { success: true };
}

async function downloadCloudSessions(): Promise<SyncOpResult> {
  const dl = await downloadSessions<{ sessions: TabSession[] }>();
  if (!dl.ok) {
    return { success: false, error: '云端还没有会话数据,请先上传' };
  }
  await writeLocalSessions(dl.snapshot.payload?.sessions ?? []);
  await clearDirty('sessions');
  return { success: true };
}

export async function downloadCloud(scope: SyncScope): Promise<SyncOpResult> {
  if (!(await readSessionToken())) return { success: false, error: '未登录' };
  try {
    return scope === 'bookmarks' ? await downloadCloudBookmarks() : await downloadCloudSessions();
  } catch (err) {
    if (err instanceof SyncAuthError) {
      await clearLoginLocally().catch(() => {});
      return { success: false, error: '登录已失效,请重新登录' };
    }
    console.warn(`[sync] downloadCloud(${scope}) error:`, err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

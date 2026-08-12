/**
 * 脏标记(Dirty flag)+ 首次拉取时间戳
 *
 * 作用:
 *   - bookmarksDirty / sessionsDirty:本地是否有未同步到云端的变更。
 *     UI 订阅后显示「红点」提示用户去手动同步;同步成功后清掉。
 *   - lastPullAt:首次拉取的节流时间戳。newtab 每次挂载都读它,
 *     距上次拉取不足 30min 就跳过,避免接口被打爆。
 *
 * 为什么独立成一个模块:
 *   - store(shortcuts/groups)需要 markDirty,background 需要清脏,
 *     UI 需要订阅 —— 三方共享,放这里避免循环依赖(syncAuto 也不依赖 store)。
 *
 * 跨 context 共享:local: 存储对所有扩展上下文(background/newtab/popup)可见,
 *   cell.watch 底层是 storage.onChanged,会在所有上下文触发。
 */

import { createStorageCell } from '@/src/lib/storage';
import { SYNC_LOCAL_KEYS } from './syncConfig';

export type SyncScope = 'bookmarks' | 'sessions';

const bookmarksDirtyCell = createStorageCell<boolean>(SYNC_LOCAL_KEYS.BOOKMARKS_DIRTY);
const sessionsDirtyCell = createStorageCell<boolean>(SYNC_LOCAL_KEYS.SESSIONS_DIRTY);
const lastPullAtCell = createStorageCell<number>(SYNC_LOCAL_KEYS.LAST_PULL_AT);

const dirtyCell = (scope: SyncScope) =>
  scope === 'bookmarks' ? bookmarksDirtyCell : sessionsDirtyCell;

/** 标脏:本地有未同步变更(用户增删改后调用) */
export async function markDirty(scope: SyncScope): Promise<void> {
  await dirtyCell(scope).write(true).catch(() => {});
}

/** 清脏:本地与云端已一致(上传/下载成功后调用) */
export async function clearDirty(scope: SyncScope): Promise<void> {
  await dirtyCell(scope).write(false).catch(() => {});
}

/** 读当前脏标记 */
export async function readDirty(scope: SyncScope): Promise<boolean> {
  return (await dirtyCell(scope).read()) ?? false;
}

/**
 * 订阅脏标记变化(UI 红点用)。返回取消订阅函数。
 * 底层 storage.onChanged 跨 context 触发:background 清脏 → newtab/popup 红点立即灭。
 */
export function watchDirty(scope: SyncScope, cb: (dirty: boolean) => void): () => void {
  return dirtyCell(scope).watch((next) => cb(next ?? false));
}

/** 读上次首次拉取的时间戳(ms),没有则 undefined */
export async function readLastPullAt(): Promise<number | undefined> {
  return await lastPullAtCell.read();
}

/** 写首次拉取时间戳(每次 pullAndMerge 完成后调) */
export async function writePullAt(ts: number): Promise<void> {
  await lastPullAtCell.write(ts).catch(() => {});
}

/**
 * Shortcuts store
 *
 * 关键修复：
 * 1. watch 先注册，再读 storage（防止 read 和 watch 之间的更新丢失）
 * 2. watch 内部用 id + updatedAt 比较，避免无限循环
 * 3. useStoreState 用 useCallback 锁定 getSnapshot 引用
 */

import { createStore } from '@/src/lib/store';
import { createStorageCell } from '@/src/lib/storage';
import { safeRead, v } from '@/src/schemas';
import { shortcutSchema } from '@/src/schemas';
import { DEFAULT_SHORTCUTS } from '@/src/utils/constants';
import {
  addShortcut as svcAdd,
  addShortcuts as svcAddMany,
  removeShortcut as svcRemove,
  removeShortcuts as svcRemoveMany,
  updateShortcut as svcUpdate,
  reorderShortcuts as svcReorder,
} from '@/src/services/shortcuts';
import type { Shortcut } from '@/src/utils/types';
import { STORAGE_KEYS } from './keys';

interface ShortcutsState {
  list: Shortcut[];
  loaded: boolean;
}

const cell = createStorageCell<Shortcut[]>(STORAGE_KEYS.shortcuts);
export const shortcutsStore = createStore<ShortcutsState>({ list: [], loaded: false });

/** 防抖写：50ms 内多次 setItem 只触发最后一次 */
let writeTimer: ReturnType<typeof setTimeout> | null = null;
let pendingValue: Shortcut[] | null = null;
const scheduleWrite = (value: Shortcut[]): void => {
  pendingValue = value;
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    const v = pendingValue;
    writeTimer = null;
    pendingValue = null;
    if (v) {
      cell.write(v).catch((e) => console.error('[shortcuts] persist failed:', e));
    }
  }, 50);
};

let initialized = false;
export async function initShortcutsStore(): Promise<void> {
  if (initialized) return;
  initialized = true;
  try {
    // 1) 先注册 watch（防止 read 和 watch 之间的更新丢失）
    cell.watch((next) => {
      if (next === undefined) return;
      const current = shortcutsStore.get().list;
      // 用 id + updatedAt 内容比较，避免反序列化导致的引用差异
      if (
        current.length === next.length &&
        current.every(
          (s, i) =>
            s === next[i] ||
            (s.id === next[i]?.id && s.updatedAt === next[i]?.updatedAt)
        )
      ) {
        return;
      }
      shortcutsStore.set({ list: next });
    });

    // 2) 再读 storage
    const raw = await cell.read();
    const list = safeRead(v.array(shortcutSchema), raw, []);
    const initial = list.length > 0 ? list : DEFAULT_SHORTCUTS;

    // 3) 如果是空，写入默认（watch 已经注册，但 storage.onChanged 只在变化时触发，初次写入只会同步触发一次回调，已被内容比较过滤）
    if (list.length === 0) {
      await cell.write(initial);
    }

    // 4) 最后 set state（触发一次 notify，让 UI 拿到数据）
    shortcutsStore.replace({ list: initial, loaded: true });
  } catch (e) {
    console.error('[shortcuts] init failed:', e);
    shortcutsStore.replace({ list: DEFAULT_SHORTCUTS, loaded: true });
  }
}

export const shortcutsActions = {
  add(input: { name: string; url: string; icon?: string }): Shortcut {
    const { list, created } = svcAdd(shortcutsStore.get().list, input);
    shortcutsStore.set({ list });
    scheduleWrite(list);
    return created;
  },

  addMany(items: { name: string; url: string }[]) {
    const { list, added, skipped } = svcAddMany(shortcutsStore.get().list, items);
    if (added.length > 0) {
      shortcutsStore.set({ list });
      scheduleWrite(list);
    }
    return { added: added.length, skipped };
  },

  remove(id: string): void {
    const list = svcRemove(shortcutsStore.get().list, id);
    shortcutsStore.set({ list });
    scheduleWrite(list);
  },

  removeMany(ids: string[]): void {
    const list = svcRemoveMany(shortcutsStore.get().list, ids);
    shortcutsStore.set({ list });
    scheduleWrite(list);
  },

  update(id: string, patch: Partial<Omit<Shortcut, 'id' | 'createdAt' | 'updatedAt'>>): void {
    const list = svcUpdate(shortcutsStore.get().list, id, patch);
    shortcutsStore.set({ list });
    scheduleWrite(list);
  },

  reorder(fromId: string, toId: string): void {
    const list = svcReorder(shortcutsStore.get().list, fromId, toId);
    shortcutsStore.set({ list });
    scheduleWrite(list);
  },

  replace(next: Shortcut[]): void {
    shortcutsStore.set({ list: next });
    scheduleWrite(next);
  },
};
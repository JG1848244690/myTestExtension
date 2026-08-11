/**
 * Shortcuts store
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
    if (pendingValue) {
      cell.write(pendingValue).catch((e) => console.error('[shortcuts] persist failed:', e));
    }
    writeTimer = null;
    pendingValue = null;
  }, 50);
};

let initialized = false;
export async function initShortcutsStore(): Promise<void> {
  if (initialized) return;
  initialized = true;
  const raw = await cell.read();
  const list = safeRead(v.array(shortcutSchema), raw, []);
  const initial = list.length > 0 ? list : DEFAULT_SHORTCUTS;
  shortcutsStore.replace({ list: initial, loaded: true });

  cell.watch((next) => {
    if (next === undefined) return;
    if (pendingValue && JSON.stringify(next) === JSON.stringify(pendingValue)) return;
    shortcutsStore.set({ list: next });
  });

  if (list.length === 0) {
    await cell.write(initial);
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
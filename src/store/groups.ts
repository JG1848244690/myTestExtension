/**
 * Groups store
 */

import { createStore } from '@/src/lib/store';
import { createStorageCell } from '@/src/lib/storage';
import { safeRead, v } from '@/src/schemas';
import { groupSchema } from '@/src/schemas';
import { DEFAULT_GROUPS } from '@/src/utils/constants';
import {
  addGroup,
  updateGroup,
  removeGroup,
  toggleGroupExpand,
  addShortcutToGroup,
  removeShortcutFromGroup,
  moveShortcuts,
  reorderGroups,
  reorderShortcutsInGroup,
} from '@/src/services/groups';
import type { ShortcutGroup } from '@/src/utils/types';
import { markDirty } from '@/src/utils/syncDirty';
import { STORAGE_KEYS } from './keys';

interface GroupsState {
  list: ShortcutGroup[];
  loaded: boolean;
}

const cell = createStorageCell<ShortcutGroup[]>(STORAGE_KEYS.groups);
export const groupsStore = createStore<GroupsState>({ list: [], loaded: false });

/** 防抖写：50ms 内多次 setItem 只触发最后一次
 *
 * silent=true: 同步模块(syncAuto)调用 replace() 时用,只写 storage 不标脏。
 * dirty 由 syncAuto 自己根据「本地 vs 云端是否一致」显式控制。
 */
let writeTimer: ReturnType<typeof setTimeout> | null = null;
let pendingValue: ShortcutGroup[] | null = null;
const scheduleWrite = (value: ShortcutGroup[], silent: boolean = false): void => {
  pendingValue = value;
  if (!silent) {
    void markDirty('bookmarks');
  }
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    const v = pendingValue;
    writeTimer = null;
    pendingValue = null;
    if (v) {
      cell.write(v).catch((e) => console.error('[groups] persist failed:', e));
    }
  }, 50);
};

let initialized = false;
export async function initGroupsStore(): Promise<void> {
  if (initialized) return;
  initialized = true;
  try {
    cell.watch((next) => {
      if (next === undefined) return;
      const current = groupsStore.get().list;
      if (
        current.length === next.length &&
        current.every(
          (g, i) =>
            g === next[i] ||
            (g.id === next[i]?.id && g.updatedAt === next[i]?.updatedAt)
        )
      ) {
        return;
      }
      groupsStore.set({ list: next });
    });

    const raw = await cell.read();
    const list = safeRead(v.array(groupSchema), raw, DEFAULT_GROUPS);
    groupsStore.replace({ list, loaded: true });
  } catch (e) {
    console.error('[groups] init failed:', e);
    groupsStore.replace({ list: DEFAULT_GROUPS, loaded: true });
  }
}

export const groupsActions = {
  add(input: { name: string; color?: string }) {
    const { list, created } = addGroup(groupsStore.get().list, input);
    groupsStore.set({ list });
    scheduleWrite(list);
    return created;
  },

  update(id: string, patch: Partial<Omit<ShortcutGroup, 'id' | 'createdAt' | 'updatedAt'>>) {
    const list = updateGroup(groupsStore.get().list, id, patch);
    groupsStore.set({ list });
    scheduleWrite(list);
  },

  remove(id: string) {
    const list = removeGroup(groupsStore.get().list, id);
    groupsStore.set({ list });
    scheduleWrite(list);
  },

  /**
   * toggleExpand: 展开/折叠纯 UI 状态,**不触发 markDirty**(silent 模式)。
   * 仍写 storage 让刷新后保留折叠状态,但不算「本地有未同步书签」。
   * 如果 syncAuto 后续 pullAndMerge 时发现 local.isExpanded ≠ server.isExpanded
   * 导致 merged ≠ serverPayload,会自己 markDirty(那是数据真实不一致)。
   */
  toggleExpand(id: string) {
    const list = toggleGroupExpand(groupsStore.get().list, id);
    groupsStore.set({ list });
    scheduleWrite(list, true);  // silent: 不调 markDirty
  },

  addShortcut(groupId: string, shortcutId: string) {
    const list = addShortcutToGroup(groupsStore.get().list, groupId, shortcutId);
    groupsStore.set({ list });
    scheduleWrite(list);
  },

  removeShortcut(groupId: string, shortcutId: string) {
    const list = removeShortcutFromGroup(groupsStore.get().list, groupId, shortcutId);
    groupsStore.set({ list });
    scheduleWrite(list);
  },

  move(shortcutIds: string[], sourceId: string | null, targetId: string | null) {
    const list = moveShortcuts(groupsStore.get().list, shortcutIds, sourceId, targetId);
    groupsStore.set({ list });
    scheduleWrite(list);
  },

  reorder(activeId: string, overId: string) {
    const list = reorderGroups(groupsStore.get().list, activeId, overId);
    groupsStore.set({ list });
    scheduleWrite(list);
  },

  reorderShortcuts(groupId: string, activeId: string, overId: string) {
    const list = reorderShortcutsInGroup(groupsStore.get().list, groupId, activeId, overId);
    groupsStore.set({ list });
    scheduleWrite(list);
  },

  /**
   * replace: 无条件覆盖本地数据,silent 模式不触发 markDirty(详见 shortcuts.ts 注释)
   */
  replace(next: ShortcutGroup[]) {
    groupsStore.set({ list: next });
    scheduleWrite(next, true);  // silent: 不调 markDirty
  },
};
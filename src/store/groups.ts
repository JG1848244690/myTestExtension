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
import { STORAGE_KEYS } from './keys';

interface GroupsState {
  list: ShortcutGroup[];
  loaded: boolean;
}

const cell = createStorageCell<ShortcutGroup[]>(STORAGE_KEYS.groups);
export const groupsStore = createStore<GroupsState>({ list: [], loaded: false });

let writeTimer: ReturnType<typeof setTimeout> | null = null;
let pendingValue: ShortcutGroup[] | null = null;
const scheduleWrite = (value: ShortcutGroup[]): void => {
  pendingValue = value;
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    if (pendingValue) {
      cell.write(pendingValue).catch((e) => console.error('[groups] persist failed:', e));
    }
    writeTimer = null;
    pendingValue = null;
  }, 50);
};

let initialized = false;
export async function initGroupsStore(): Promise<void> {
  if (initialized) return;
  initialized = true;
  const raw = await cell.read();
  const list = safeRead(v.array(groupSchema), raw, DEFAULT_GROUPS);
  groupsStore.replace({ list, loaded: true });

  cell.watch((next) => {
    if (next === undefined) return;
    if (pendingValue && JSON.stringify(next) === JSON.stringify(pendingValue)) return;
    groupsStore.set({ list: next });
  });
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

  toggleExpand(id: string) {
    const list = toggleGroupExpand(groupsStore.get().list, id);
    groupsStore.set({ list });
    scheduleWrite(list);
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

  replace(next: ShortcutGroup[]) {
    groupsStore.set({ list: next });
    scheduleWrite(next);
  },
};
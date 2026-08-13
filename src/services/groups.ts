/**
 * Group 业务逻辑（纯函数）
 */

import type { ShortcutGroup } from '@/src/utils/types';

const newId = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function addGroup(
  list: readonly ShortcutGroup[],
  input: { name: string; color?: string }
): { list: ShortcutGroup[]; created: ShortcutGroup } {
  const now = Date.now();
  const created: ShortcutGroup = {
    id: newId(),
    name: input.name,
    color: input.color,
    shortcutIds: [],
    isExpanded: true,
    order: list.length,
    createdAt: now,
    updatedAt: now,
  };
  return { list: [...list, created], created };
}

export function updateGroup(
  list: readonly ShortcutGroup[],
  id: string,
  patch: Partial<Omit<ShortcutGroup, 'id' | 'createdAt' | 'updatedAt'>>
): ShortcutGroup[] {
  const now = Date.now();
  return list.map((g) => (g.id === id ? { ...g, ...patch, updatedAt: now } : g));
}

export function removeGroup(list: readonly ShortcutGroup[], id: string): ShortcutGroup[] {
  return list.filter((g) => g.id !== id);
}

export function toggleGroupExpand(list: readonly ShortcutGroup[], id: string): ShortcutGroup[] {
  return list.map((g) => (g.id === id ? { ...g, isExpanded: !g.isExpanded } : g));
}

export function addShortcutToGroup(
  list: readonly ShortcutGroup[],
  groupId: string,
  shortcutId: string
): ShortcutGroup[] {
  const now = Date.now();
  return list.map((g) => {
    if (g.id !== groupId) return g;
    if (g.shortcutIds.includes(shortcutId)) return g;
    return { ...g, shortcutIds: [...g.shortcutIds, shortcutId], updatedAt: now };
  });
}

export function removeShortcutFromGroup(
  list: readonly ShortcutGroup[],
  groupId: string,
  shortcutId: string
): ShortcutGroup[] {
  const now = Date.now();
  return list.map((g) =>
    g.id === groupId
      ? { ...g, shortcutIds: g.shortcutIds.filter((id) => id !== shortcutId), updatedAt: now }
      : g
  );
}

/** 从 source 移动一批 shortcut 到 target；sourceId/targetId 都为 null 表示「未分组」 */
export function moveShortcuts(
  list: readonly ShortcutGroup[],
  shortcutIds: readonly string[],
  sourceId: string | null,
  targetId: string | null
): ShortcutGroup[] {
  const idSet = new Set(shortcutIds);
  const now = Date.now();
  return list.map((g) => {
    if (g.id === sourceId) {
      return {
        ...g,
        shortcutIds: g.shortcutIds.filter((id) => !idSet.has(id)),
        updatedAt: now,
      };
    }
    if (g.id === targetId) {
      const merged = [...new Set([...g.shortcutIds, ...shortcutIds])];
      return { ...g, shortcutIds: merged, updatedAt: now };
    }
    return g;
  });
}

/**
 * 复制一批 shortcut 到 target(保留 source 不变)
 * target=null 表示「未分组」
 * 已存在的 id 自动去重
 */
export function copyShortcuts(
  list: readonly ShortcutGroup[],
  shortcutIds: readonly string[],
  targetId: string | null
): ShortcutGroup[] {
  const now = Date.now();
  return list.map((g) => {
    if (g.id !== targetId) return g;
    const merged = [...new Set([...g.shortcutIds, ...shortcutIds])];
    return { ...g, shortcutIds: merged, updatedAt: now };
  });
}

export function reorderGroups(
  list: readonly ShortcutGroup[],
  activeId: string,
  overId: string
): ShortcutGroup[] {
  if (activeId === overId) return [...list];
  const oldIdx = list.findIndex((g) => g.id === activeId);
  const newIdx = list.findIndex((g) => g.id === overId);
  if (oldIdx === -1 || newIdx === -1) return [...list];
  const next = [...list];
  const [moved] = next.splice(oldIdx, 1);
  next.splice(newIdx, 0, moved);
  return next.map((g, idx) => ({ ...g, order: idx }));
}

export function reorderShortcutsInGroup(
  list: readonly ShortcutGroup[],
  groupId: string,
  activeShortcutId: string,
  overShortcutId: string
): ShortcutGroup[] {
  if (activeShortcutId === overShortcutId) return [...list];
  const groupIdx = list.findIndex((g) => g.id === groupId);
  if (groupIdx === -1) return [...list];
  const group = list[groupIdx];
  const oldIdx = group.shortcutIds.indexOf(activeShortcutId);
  const newIdx = group.shortcutIds.indexOf(overShortcutId);
  if (oldIdx === -1 || newIdx === -1) return [...list];

  const nextIds = [...group.shortcutIds];
  const [moved] = nextIds.splice(oldIdx, 1);
  nextIds.splice(newIdx, 0, moved);

  const next = [...list];
  next[groupIdx] = { ...group, shortcutIds: nextIds, updatedAt: Date.now() };
  return next;
}

export function getGroupByShortcutId(
  list: readonly ShortcutGroup[],
  shortcutId: string
): ShortcutGroup | undefined {
  return list.find((g) => g.shortcutIds.includes(shortcutId));
}

export function getUngroupedShortcutIds(
  groups: readonly ShortcutGroup[],
  shortcutIds: readonly string[]
): string[] {
  const grouped = new Set(groups.flatMap((g) => g.shortcutIds));
  return shortcutIds.filter((id) => !grouped.has(id));
}
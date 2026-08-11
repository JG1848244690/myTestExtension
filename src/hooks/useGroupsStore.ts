/**
 * 新的 groups hook：薄壳
 *
 * 保持旧的 async 接口，方便 GroupLayout 等组件无痛迁移
 */

import { useMemo, useCallback } from 'react';
import { useStoreState } from '@/src/lib/store';
import { groupsStore, groupsActions } from '@/src/store/groups';
import { getGroupByShortcutId as svcGetGroup, getUngroupedShortcutIds as svcGetUngrouped } from '@/src/services/groups';
import type { ShortcutGroup } from '@/src/utils/types';

export function useGroupsStore() {
  const groups = useStoreState(groupsStore, (s) => s.list);
  const loaded = useStoreState(groupsStore, (s) => s.loaded);

  // 派生：快捷方式 -> 分组 ID 映射
  const shortcutIdToGroupId = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of groups) {
      for (const id of g.shortcutIds) map.set(id, g.id);
    }
    return map;
  }, [groups]);

  const getGroupByShortcutId = useCallback(
    (shortcutId: string) => svcGetGroup(groups, shortcutId),
    [groups]
  );

  const getUngroupedShortcutIds = useCallback(
    (allIds: string[]) => svcGetUngrouped(groups, allIds),
    [groups]
  );

  const ok = <T,>(v: T): Promise<T> => Promise.resolve(v);

  return {
    groups,
    loaded,
    addGroup: (data: { name: string; color?: string }) => ok(groupsActions.add(data)),
    updateGroup: (
      id: string,
      data: Partial<Omit<ShortcutGroup, 'id' | 'createdAt' | 'updatedAt'>>
    ) => ok(groupsActions.update(id, data)),
    removeGroup: (id: string) => ok(groupsActions.remove(id)),
    toggleGroupExpand: (id: string) => ok(groupsActions.toggleExpand(id)),
    addShortcutToGroup: (groupId: string, shortcutId: string) =>
      ok(groupsActions.addShortcut(groupId, shortcutId)),
    removeShortcutFromGroup: (groupId: string, shortcutId: string) =>
      ok(groupsActions.removeShortcut(groupId, shortcutId)),
    // 旧签名：sourceGroupId 先，targetGroupId 次，shortcutIds 最后
    moveShortcutsToGroup: (
      sourceGroupId: string | null,
      targetGroupId: string | null,
      shortcutIds: string[]
    ) => ok(groupsActions.move(shortcutIds, sourceGroupId, targetGroupId)),
    importGroups: (next: ShortcutGroup[]) => ok(groupsActions.replace(next)),
    reorderGroups: (activeId: string, overId: string) => ok(groupsActions.reorder(activeId, overId)),
    reorderShortcutsInGroup: (groupId: string, activeId: string, overId: string) =>
      ok(groupsActions.reorderShortcuts(groupId, activeId, overId)),
    shortcutIdToGroupId,
    getGroupByShortcutId,
    getUngroupedShortcutIds,
  };
}
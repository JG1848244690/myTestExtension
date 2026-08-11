/**
 * 新的 shortcuts hook：薄壳，订阅 store
 *
 * 用法和旧的 useShortcuts 兼容（actions 返回 Promise 以保持 await 语义）
 */

import { useStoreState } from '@/src/lib/store';
import { shortcutsStore, shortcutsActions } from '@/src/store/shortcuts';
import type { Shortcut } from '@/src/utils/types';

export function useShortcutsStore() {
  const shortcuts = useStoreState(shortcutsStore, (s) => s.list);
  const loaded = useStoreState(shortcutsStore, (s) => s.loaded);

  return {
    shortcuts,
    loaded,
    addShortcut: (data: { name: string; url: string; icon?: string }): Promise<Shortcut> =>
      Promise.resolve(shortcutsActions.add(data)),
    addShortcuts: (items: { name: string; url: string }[]): Promise<number> =>
      Promise.resolve(shortcutsActions.addMany(items).added),
    removeShortcut: (id: string): Promise<boolean> =>
      Promise.resolve(shortcutsActions.remove(id) ?? true),
    removeShortcuts: (ids: string[]): Promise<boolean> =>
      Promise.resolve(shortcutsActions.removeMany(ids) ?? true),
    updateShortcut: (
      id: string,
      data: Partial<Omit<Shortcut, 'id' | 'createdAt' | 'updatedAt'>>
    ): Promise<boolean> => Promise.resolve(shortcutsActions.update(id, data) ?? true),
    reorderShortcuts: (fromId: string, toId: string): Promise<boolean> =>
      Promise.resolve(shortcutsActions.reorder(fromId, toId) ?? true),
    importShortcuts: (next: Shortcut[]): Promise<boolean> =>
      Promise.resolve(shortcutsActions.replace(next) ?? true),
  };
}
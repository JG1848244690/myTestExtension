/**
 * 等待 stores 初始化完成的 hook
 *
 * 在 App 入口用一次，确保 UI 不会在 store 还在读 storage 时误渲染空数据
 */

import { useEffect, useState } from 'react';
import { initAllStores } from '@/src/store/init';
import { useStoreState } from '@/src/lib/store';
import { shortcutsStore } from '@/src/store/shortcuts';
import { groupsStore } from '@/src/store/groups';

export function useStoresReady(): boolean {
  const shortcutsLoaded = useStoreState(shortcutsStore, (s) => s.loaded);
  const groupsLoaded = useStoreState(groupsStore, (s) => s.loaded);
  const [ready, setReady] = useState(
    shortcutsLoaded && groupsLoaded
  );

  useEffect(() => {
    let cancelled = false;
    initAllStores().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 即便 initAllStores 已经跑过，state loaded 信号也会让组件及时刷新
  useEffect(() => {
    if (shortcutsLoaded && groupsLoaded) setReady(true);
  }, [shortcutsLoaded, groupsLoaded]);

  return ready;
}
/**
 * 等待 stores 初始化完成的 hook
 *
 * 简化版：只依赖 initAllStores() 的 Promise，不订阅 store 状态，
 * 避免 selector 不稳定和 effect 双重触发问题
 */

import { useEffect, useState } from 'react';
import { initAllStores } from '@/src/store/init';

export function useStoresReady(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    initAllStores().then(
      () => {
        if (!cancelled) setReady(true);
      },
      (err) => {
        // 即使初始化失败，也让 UI 继续渲染（store 会用默认值）
        console.error('[useStoresReady] init failed:', err);
        if (!cancelled) setReady(true);
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return ready;
}
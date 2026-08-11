/**
 * 零依赖的轻量 store
 *
 * 关键设计：getSnapshot 必须引用稳定，否则 useSyncExternalStore 会无限循环
 */

import { useCallback, useRef, useSyncExternalStore } from 'react';

type Listener = () => void;
type Updater<T> = Partial<T> | ((state: T) => Partial<T>);

export interface Store<T> {
  get: () => T;
  set: (updater: Updater<T>) => void;
  replace: (next: T) => void;
  subscribe: (listener: Listener) => () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<Listener>();

  const notify = () => {
    // 复制一份避免回调里 subscribe/unsubscribe 引发的迭代问题
    listeners.forEach((l) => {
      try {
        l();
      } catch (e) {
        console.error('[store] listener threw:', e);
      }
    });
  };

  return {
    get: () => state,
    set: (updater) => {
      const patch = typeof updater === 'function' ? updater(state) : updater;
      const next = { ...state, ...patch };
      if (shallowEqual(state, next)) return;
      state = next;
      notify();
    },
    replace: (next) => {
      if (shallowEqual(state, next)) return;
      state = next;
      notify();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * 关键：getSnapshot 引用稳定，且返回值引用稳定（同 state 返回同引用）
 *
 * 模式参考 Zustand：
 * - selector 存到 ref，每次 render 更新（不必 stable）
 * - getSnapshot 用 useCallback 锁住（deps 只有 store）
 * - 内部缓存 selected 值，state 没变就返回缓存
 */
export function useStoreState<T, U>(store: Store<T>, selector: (state: T) => U): U {
  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  const cacheRef = useRef<{ state: T; selected: U } | null>(null);

  const getSnapshot = useCallback((): U => {
    const current = store.get();
    if (cacheRef.current && cacheRef.current.state === current) {
      return cacheRef.current.selected;
    }
    const selected = selectorRef.current(current);
    cacheRef.current = { state: current, selected };
    return selected;
  }, [store]);

  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  const ak = Object.keys(a as object);
  const bk = Object.keys(b as object);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (!Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) {
      return false;
    }
  }
  return true;
}
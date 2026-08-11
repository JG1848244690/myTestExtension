/**
 * 零依赖的轻量 store
 */

import { useSyncExternalStore } from 'react';

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
  const notify = () => listeners.forEach((l) => l());
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
      return () => listeners.delete(listener);
    },
  };
}

export function useStoreState<T, U>(store: Store<T>, selector: (state: T) => U): U {
  const getSnapshot = () => selector(store.get());
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
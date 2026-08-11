/**
 * Settings store（搜索引擎 / 布局 / 背景等）
 */

import { createStore } from '@/src/lib/store';
import { createStorageCell } from '@/src/lib/storage';
import { safeRead } from '@/src/schemas';
import { settingsSchema } from '@/src/schemas';
import { DEFAULT_SETTINGS } from '@/src/utils/constants';
import type { Settings } from '@/src/utils/types';
import { STORAGE_KEYS } from './keys';

const cell = createStorageCell<Settings>(STORAGE_KEYS.settings);
export const settingsStore = createStore<Settings>(DEFAULT_SETTINGS);

let writeTimer: ReturnType<typeof setTimeout> | null = null;
let pendingValue: Settings | null = null;
const scheduleWrite = (value: Settings): void => {
  pendingValue = value;
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    if (pendingValue) {
      cell.write(pendingValue).catch((e) => console.error('[settings] persist failed:', e));
    }
    writeTimer = null;
    pendingValue = null;
  }, 50);
};

let initialized = false;
export async function initSettingsStore(): Promise<void> {
  if (initialized) return;
  initialized = true;
  const raw = await cell.read();
  const settings = safeRead(settingsSchema, raw, DEFAULT_SETTINGS);
  settingsStore.replace(settings);

  cell.watch((next) => {
    if (next === undefined) return;
    if (pendingValue && JSON.stringify(next) === JSON.stringify(pendingValue)) return;
    settingsStore.replace(next);
  });
}

export const settingsActions = {
  patch(patch: Partial<Settings>): void {
    const next = { ...settingsStore.get(), ...patch };
    settingsStore.replace(next);
    scheduleWrite(next);
  },

  replace(next: Settings): void {
    settingsStore.replace(next);
    scheduleWrite(next);
  },
};
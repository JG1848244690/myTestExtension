/**
 * 搜索历史 store（独立以便 popup / newtab 共用）
 */

import { createStore } from '@/src/lib/store';
import { createStorageCell } from '@/src/lib/storage';
import { safeRead, v } from '@/src/schemas';
import { STORAGE_KEYS } from './keys';

export interface SearchHistoryItem {
  query: string;
  timestamp: number;
  count: number;
}

const MAX_HISTORY = 50;

const historySchema = v.array(
  v.object({
    query: v.string(),
    timestamp: v.number(),
    count: v.number(),
  })
);

const cell = createStorageCell<SearchHistoryItem[]>(STORAGE_KEYS.searchHistory);
export const historyStore = createStore<SearchHistoryItem[]>([]);

let writeTimer: ReturnType<typeof setTimeout> | null = null;
let pendingValue: SearchHistoryItem[] | null = null;
const scheduleWrite = (value: SearchHistoryItem[]): void => {
  pendingValue = value;
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    if (pendingValue) {
      cell.write(pendingValue).catch((e) => console.error('[history] persist failed:', e));
    }
    writeTimer = null;
    pendingValue = null;
  }, 50);
};

let initialized = false;
export async function initHistoryStore(): Promise<void> {
  if (initialized) return;
  initialized = true;
  const raw = await cell.read();
  const list = safeRead(historySchema, raw, []);
  historyStore.replace(list);

  cell.watch((next) => {
    if (next === undefined) return;
    if (pendingValue && JSON.stringify(next) === JSON.stringify(pendingValue)) return;
    historyStore.replace(next);
  });
}

export const historyActions = {
  add(query: string): void {
    const trimmed = query.trim();
    if (!trimmed) return;
    const current = historyStore.get();
    const now = Date.now();
    const idx = current.findIndex(
      (item) => item.query.toLowerCase() === trimmed.toLowerCase()
    );

    let next: SearchHistoryItem[];
    if (idx !== -1) {
      const updated = {
        ...current[idx],
        timestamp: now,
        count: current[idx].count + 1,
      };
      next = [updated, ...current.filter((_, i) => i !== idx)];
    } else {
      next = [{ query: trimmed, timestamp: now, count: 1 }, ...current].slice(0, MAX_HISTORY);
    }
    historyStore.replace(next);
    scheduleWrite(next);
  },

  clear(): void {
    historyStore.replace([]);
    scheduleWrite([]);
  },

  remove(query: string): void {
    const next = historyStore.get().filter(
      (item) => item.query.toLowerCase() !== query.toLowerCase()
    );
    historyStore.replace(next);
    scheduleWrite(next);
  },

  search(keyword: string, limit = 5): SearchHistoryItem[] {
    const current = historyStore.get();
    const q = keyword.trim().toLowerCase();
    if (!q) return current.slice(0, limit);
    return current.filter((item) => item.query.toLowerCase().includes(q)).slice(0, limit);
  },
};
/**
 * Shortcut 业务逻辑（纯函数）
 *
 * 所有函数都是 input → output，不读写 storage、不依赖 React。
 * 方便单测，也方便 background / popup / newtab 共用。
 */

import type { Shortcut } from '@/src/utils/types';

const newId = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** URL 规整：缺协议补 https:// */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  return /^https?:\/\//i.test(trimmed) ? trimmed : 'https://' + trimmed;
}

export function addShortcut(
  list: readonly Shortcut[],
  input: { name: string; url: string; icon?: string }
): { list: Shortcut[]; created: Shortcut } {
  const now = Date.now();
  const created: Shortcut = {
    id: newId(),
    name: input.name,
    url: normalizeUrl(input.url),
    icon: input.icon,
    createdAt: now,
    updatedAt: now,
  };
  return { list: [...list, created], created };
}

export function addShortcuts(
  list: readonly Shortcut[],
  items: readonly { name: string; url: string }[]
): { list: Shortcut[]; added: Shortcut[]; skipped: number } {
  const seen = new Set(list.map((s) => normalizeUrl(s.url).toLowerCase()));
  const added: Shortcut[] = [];
  const now = Date.now();
  let skipped = 0;

  for (const item of items) {
    const url = normalizeUrl(item.url);
    const key = url.toLowerCase();
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    added.push({
      id: newId(),
      name: item.name,
      url,
      createdAt: now,
      updatedAt: now,
    });
  }

  return { list: [...list, ...added], added, skipped };
}

export function removeShortcut(list: readonly Shortcut[], id: string): Shortcut[] {
  return list.filter((s) => s.id !== id);
}

export function removeShortcuts(list: readonly Shortcut[], ids: readonly string[]): Shortcut[] {
  const idSet = new Set(ids);
  return list.filter((s) => !idSet.has(s.id));
}

export function updateShortcut(
  list: readonly Shortcut[],
  id: string,
  patch: Partial<Omit<Shortcut, 'id' | 'createdAt' | 'updatedAt'>>
): Shortcut[] {
  const now = Date.now();
  return list.map((s) => {
    if (s.id !== id) return s;
    return {
      ...s,
      ...patch,
      url: patch.url !== undefined ? normalizeUrl(patch.url) : s.url,
      updatedAt: now,
    };
  });
}

export function reorderShortcuts(
  list: readonly Shortcut[],
  fromId: string,
  toId: string
): Shortcut[] {
  if (fromId === toId) return [...list];
  const fromIdx = list.findIndex((s) => s.id === fromId);
  const toIdx = list.findIndex((s) => s.id === toId);
  if (fromIdx === -1 || toIdx === -1) return [...list];
  const next = [...list];
  const [moved] = next.splice(fromIdx, 1);
  next.splice(toIdx, 0, moved);
  return next;
}

export function filterShortcuts(
  list: readonly Shortcut[],
  keyword: string
): Shortcut[] {
  const q = keyword.trim().toLowerCase();
  if (!q) return [...list];
  return list.filter(
    (s) => s.name.toLowerCase().includes(q) || s.url.toLowerCase().includes(q)
  );
}
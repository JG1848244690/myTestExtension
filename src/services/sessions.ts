/**
 * Session（标签页存档）业务逻辑（纯函数）
 */

import type { TabSession, TabInfo } from '@/src/utils/types';

const newId = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function createSession(tabs: readonly TabInfo[], title?: string): TabSession {
  const now = Date.now();
  return {
    id: newId(),
    title: title || '存档 ' + new Date(now).toLocaleString('zh-CN'),
    createdAt: now,
    tabCount: tabs.length,
    tabs: [...tabs],
  };
}

/** 加新 session 并按 FIFO 限流 */
export function appendSession(
  list: readonly TabSession[],
  session: TabSession,
  maxSessions: number
): TabSession[] {
  return [session, ...list].slice(0, maxSessions);
}

export function deleteSession(list: readonly TabSession[], id: string): TabSession[] {
  return list.filter((s) => s.id !== id);
}

/** 单 session 内 tab 数超限则裁剪 */
export function trimTabs(session: TabSession, maxTabs: number): TabSession {
  if (session.tabs.length <= maxTabs) return session;
  return {
    ...session,
    tabs: session.tabs.slice(0, maxTabs),
    tabCount: Math.min(session.tabs.length, maxTabs),
  };
}
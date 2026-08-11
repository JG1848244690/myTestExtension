/**
 * Storage keys 单点定义
 *
 * 旧版 constants.ts 同时有 STORAGE_KEY（裸名）和 LOCAL_STORAGE_KEY（带 local: 前缀），
 * 容易混用。重启后只剩这一处定义，存储 cell 自动加 local: 前缀。
 */

export const STORAGE_KEYS = {
  shortcuts: 'shortcuts',
  groups: 'groups',
  settings: 'settings',
  searchHistory: 'searchHistory',
  tabSessions: 'tabSessions',
  lastSync: 'tabSessions_lastSync',
} as const;
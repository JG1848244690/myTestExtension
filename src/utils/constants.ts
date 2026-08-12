/**
 * 常量定义
 * 所有可复用或可配置的值集中管理
 */

import type { SearchEngineOption, Settings, ShortcutGroup, BackgroundSize } from './types';

// 扩展名称
export const EXTENSION_NAME = '序言';

// Storage Keys
export const STORAGE_KEY = {
  SETTINGS: 'settings',
  SHORTCUTS: 'shortcuts',
  GROUPS: 'groups',
  SEARCH_HISTORY: 'searchHistory',
  TAB_SESSIONS: 'tabSessions',
  LAST_SYNC: 'tabSessions_lastSync',
} as const;

// local 命名空间下的完整 storage key（带 `local:` 前缀）
// 集中管理避免散落硬编码，详见 docs/2026-06-02-cloud-sync-fix-plan.md P1-6
export const LOCAL_STORAGE_KEY = {
  SETTINGS: `local:${STORAGE_KEY.SETTINGS}`,
  SHORTCUTS: `local:${STORAGE_KEY.SHORTCUTS}`,
  GROUPS: `local:${STORAGE_KEY.GROUPS}`,
  SEARCH_HISTORY: `local:${STORAGE_KEY.SEARCH_HISTORY}`,
  TAB_SESSIONS: `local:${STORAGE_KEY.TAB_SESSIONS}`,
  LAST_SYNC: `local:${STORAGE_KEY.LAST_SYNC}`,
} as const;

// 标签页会话限制
export const SESSION_LIMITS = {
  MAX_SESSIONS: 5,         // 最多保存 5 个存档
  MAX_TABS_PER_SESSION: 30, // 每个存档最多 30 个标签页
} as const;

// 默认快捷方式
export const DEFAULT_SHORTCUTS = [
  { id: '1', name: 'Google', url: 'https://www.google.com', createdAt: Date.now(), updatedAt: Date.now() },
  { id: '2', name: 'GitHub', url: 'https://github.com', createdAt: Date.now(), updatedAt: Date.now() },
  { id: '3', name: 'YouTube', url: 'https://www.youtube.com', createdAt: Date.now(), updatedAt: Date.now() },
  { id: '4', name: 'Twitter', url: 'https://twitter.com', createdAt: Date.now(), updatedAt: Date.now() },
];

// 默认分组
export const DEFAULT_GROUPS: ShortcutGroup[] = [];

// 分组颜色选项
export const GROUP_COLORS = [
  { name: '蓝色', value: 'blue' },
  { name: '绿色', value: 'green' },
  { name: '紫色', value: 'purple' },
  { name: '橙色', value: 'orange' },
  { name: '红色', value: 'red' },
  { name: '青色', value: 'cyan' },
] as const;

// 搜索引擎选项(name 走 i18n,组件内通过 t('searchEngine.baidu') 等渲染)
export const SEARCH_ENGINES: SearchEngineOption[] = [
  { id: 'google', name: 'Google', url: 'https://www.google.com/search?q=', icon: '🔍' },
  { id: 'bing', name: 'Bing', url: 'https://www.bing.com/search?q=', icon: '🔎' },
  { id: 'baidu', name: 'baidu', url: 'https://www.baidu.com/s?wd=', icon: '🌐' },
];

// 默认设置
export const DEFAULT_SETTINGS: Settings = {
  searchEngine: 'bing',
  iconsPerRow: 8,
  layout: 'group',
  background: { type: 'image', imageUrl: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=1920&q=80', size: 'cover', opacity: 1 },
};

// 背景设置相关
export const DEFAULT_BACKGROUND_COLOR = '#1a1a2e';

export const PRESET_COLORS = [
  { name: '深夜蓝', color: '#1a1a2e' },
  { name: '星空紫', color: '#16213e' },
  { name: '极客黑', color: '#0f0f23' },
  { name: '薄荷绿', color: '#1e3a3a' },
  { name: '暖阳橙', color: '#2d2d44' },
  { name: '玫瑰粉', color: '#2e1f2e' },
  { name: '冰川蓝', color: '#1a2a3a' },
  { name: '森林绿', color: '#1a2e1a' },
] as const;

export const PRESET_IMAGES = [
  { name: '星空', url: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1920&q=80' },
  { name: '山脉', url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80' },
  { name: '城市', url: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1920&q=80' },
  { name: '海浪', url: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=1920&q=80' },
  { name: '森林', url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1920&q=80' },
  { name: '日落', url: 'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=1920&q=80' },
] as const;

export const SIZE_OPTIONS: { value: BackgroundSize; label: string }[] = [
  { value: 'cover', label: '覆盖 (cover)' },
  { value: 'contain', label: '适应 (contain)' },
  { value: 'auto', label: '原始大小 (auto)' },
  { value: '100% 100%', label: '拉伸 (100% 100%)' },
];

// UI 配置
export const UI_CONFIG = {
  POPUP_WIDTH: 320,
  SHORTCUT_ICON_SIZE: 48,
  GRID_COLS: {
    sm: 5,
    md: 6,
    lg: 8,
  },
  DEFAULT_ICONS_PER_ROW: 8,
  MIN_ICONS_PER_ROW: 4,
  MAX_ICONS_PER_ROW: 12,
  SEARCH_DEBOUNCE_DELAY: 300,
} as const;

// 样式常量
export const STYLE = {
  // Tab 激活态
  TAB_ACTIVE: 'text-blue-400 border-b-2 border-blue-400',
  TAB_INACTIVE: 'text-gray-400 hover:text-white',
} as const;

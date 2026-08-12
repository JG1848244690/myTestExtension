/**
 * 全局类型定义
 */

// 快捷方式
export interface Shortcut {
  id: string;
  name: string;
  url: string;
  icon?: string;
  createdAt: number;
  updatedAt: number;
}

// 快捷方式分组
export interface ShortcutGroup {
  id: string;
  name: string;
  icon?: string;
  color?: string; // 分组颜色
  shortcutIds: string[]; // 分组包含的快捷方式 ID
  isExpanded: boolean; // 是否展开
  order?: number; // 排序顺序
  createdAt: number;
  updatedAt: number;
}

// 标签页会话存储
export interface TabInfo {
  url: string;
  title: string;
}

export interface TabSession {
  id: string;
  title: string;
  createdAt: number;
  tabCount: number;
  tabs: TabInfo[];
}

// 云同步结果
// 云同步结果
export interface SyncConflict {
  error: "version mismatch";
  currentVersion: number;
  currentPayload: unknown;
}

export interface SyncResult {
  success: boolean;
  error?: string;
  lastSyncAt?: number;
  count?: number;
  /** 乐观锁冲突时返回,UI 弹窗让用户选择 */
  conflict?: SyncConflict;
}

// 布局类型
export type LayoutType = 'grid' | 'group';

// 搜索引擎
export type SearchEngineType = 'google' | 'bing' | 'baidu';

export interface SearchEngineOption {
  id: SearchEngineType;
  name: string;
  url: string;
  icon: string;
}

// 背景适配方式
export type BackgroundSize = 'cover' | 'contain' | 'auto' | '100% 100%';

// 背景类型
export type BackgroundType = 'none' | 'color' | 'image';

// 背景设置
export interface BackgroundSetting {
  type: BackgroundType; // 'none' | 'color' | 'image'
  color?: string; // 背景色，如 '#1a1a2e'
  imageUrl?: string; // 背景图 URL
  size?: BackgroundSize; // 适配方式
  opacity?: number; // 透明度 0-1
}

// 设置
export interface Settings {
  searchEngine: SearchEngineType;
  iconsPerRow: number;
  layout: LayoutType; // 布局类型
  background?: BackgroundSetting; // 背景设置
}

// 页面类型
export type PageType = 'home' | 'detail' | 'unknown';

// 导出数据格式
export interface ExportData {
  version: string; // 版本号，用于兼容性
  exportedAt: number; // 导出时间戳
  shortcuts: Shortcut[];
  groups: ShortcutGroup[];
}

// 扩展 Window 类型
declare global {
  interface Window {
    __extensionInitialized?: boolean;
    __currentPage?: PageType;
    __currentUI?: unknown;
  }
}

export {};

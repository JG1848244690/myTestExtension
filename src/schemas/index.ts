/**
 * Shortcut / Group / Session 的 schema 定义
 *
 * 用途：
 * 1. 从 storage 读出来的数据校验（防止老数据 / 异常写入崩溃）
 * 2. 从云端 / 导入文件 JSON 校验
 * 3. 写之前可调用 parse 自检
 */

import { v } from './validator';
import type { Shortcut, ShortcutGroup, TabSession, TabInfo, Settings, BackgroundSetting } from '@/src/utils/types';
import { SUPPORTED_LOCALES } from '@/src/i18n';

const STORAGE_KEYS = ['google', 'bing', 'baidu'] as const;
const LAYOUTS = ['grid', 'group', 'dock'] as const;
const BG_TYPES = ['none', 'color', 'image', 'video'] as const;
const BG_SIZES = ['cover', 'contain', 'auto', '100% 100%'] as const;

export const shortcutSchema = v.object({
  id: v.string(),
  name: v.string(),
  url: v.string(),
  icon: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const groupSchema = v.object({
  id: v.string(),
  name: v.string(),
  icon: v.optional(v.string()),
  color: v.optional(v.string()),
  shortcutIds: v.array(v.string()),
  isExpanded: v.boolean(),
  order: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const tabInfoSchema = v.object({
  url: v.string(),
  title: v.string(),
});

export const sessionSchema = v.object({
  id: v.string(),
  title: v.string(),
  createdAt: v.number(),
  tabCount: v.number(),
  tabs: v.array(tabInfoSchema),
});

const backgroundSchema = v.object({
  type: v.oneOf(BG_TYPES),
  color: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  size: v.optional(v.oneOf(BG_SIZES)),
  opacity: v.optional(v.number()),
  // 视频背景:实际 blob 存在 IndexedDB,这里只存 meta
  videoFileName: v.optional(v.string()),
  muted: v.optional(v.boolean()),
});

export const settingsSchema = v.object({
  searchEngine: v.oneOf(STORAGE_KEYS),
  iconsPerRow: v.number(),
  layout: v.oneOf(LAYOUTS),
  background: v.optional(backgroundSchema),
  language: v.optional(v.oneOf(SUPPORTED_LOCALES)),
});

export { v, safeRead } from './validator';
export type { Shortcut, ShortcutGroup, TabSession, TabInfo, Settings, BackgroundSetting };
/**
 * i18n 类型定义
 *
 * Locale: 支持的语言列表。当前固定 2 种,后续扩展在 SUPPORTED_LOCALES 加项即可。
 * TranslationTree: 嵌套字符串树,key 形如 'common.appName' / 'settings.bg.color'。
 *   不引入 react-i18next,自研极简实现,牺牲灵活性换取零依赖 + 类型安全。
 */

export type Locale = 'zh_CN' | 'en';

export const SUPPORTED_LOCALES: readonly Locale[] = ['zh_CN', 'en'] as const;
export const DEFAULT_LOCALE: Locale = 'en';

/**
 * 嵌套字符串字典的递归类型
 * 例: { common: { appName: '序言' }, settings: { bg: { type: { color: '纯色' } } } }
 */
export type TranslationTree = {
  [key: string]: string | TranslationTree;
};

/**
 * t 函数返回值 — 同 key 串 + 可选 vars 插值
 * 例: t('common.shortcutCount', { n: 5 }) → '5 shortcuts'
 */
export type TranslateVars = Record<string, string | number>;
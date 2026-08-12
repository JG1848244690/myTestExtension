/**
 * i18n 入口 — 自研极简实现
 *
 * 设计要点:
 *   - 不引 react-i18next(避免 50KB+ 依赖),自研 < 100 行
 *   - 语言存 settings store(已存在),不做单独 i18n storage
 *   - 缺失 key fallback: 当前 locale → en → key 字符串本身
 *   - 插值:简单 `{name}` 占位符,不支持嵌套/复数/ICU(够用)
 *   - listen:settings store 变化会自动触发组件重渲染(因 useI18n 用 useStoreState)
 */

import { useCallback, useMemo } from 'react';
import { useStoreState } from '@/src/lib/store';
import { settingsStore } from '@/src/store/settings';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale, type TranslationTree, type TranslateVars } from './types';
import { detectLocale } from './detect';
import { en } from './locales/en';
import { zh_CN } from './locales/zh_CN';

const DICTIONARIES: Record<Locale, TranslationTree> = {
  en,
  zh_CN,
};

export { SUPPORTED_LOCALES, DEFAULT_LOCALE };
export type { Locale, TranslationTree, TranslateVars };

/** 通过点路径访问嵌套字典,任何一段不存在返回 undefined */
function getByPath(tree: TranslationTree | undefined, path: string): string | undefined {
  if (!tree) return undefined;
  const segments = path.split('.');
  let cursor: string | TranslationTree | undefined = tree;
  for (const seg of segments) {
    if (typeof cursor !== 'object' || cursor === null) return undefined;
    cursor = (cursor as TranslationTree)[seg];
  }
  return typeof cursor === 'string' ? cursor : undefined;
}

/** 把 {name} / {n} 等占位符替换为 vars 对应值(数字也安全) */
function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const v = vars[key];
    return v === undefined || v === null ? match : String(v);
  });
}

/**
 * t:点路径取文案,缺失时 fallback 到 en,再缺失则返回 key 串(便于开发期一眼看出)。
 * 注意:t 不是 hook,可在组件外使用;但需要传 locale 才能工作。
 */
export function translate(locale: Locale, key: string, vars?: TranslateVars): string {
  // 1. 当前 locale 命中
  const direct = getByPath(DICTIONARIES[locale], key);
  if (direct !== undefined) return interpolate(direct, vars);

  // 2. fallback 到 en
  if (locale !== DEFAULT_LOCALE) {
    const fallback = getByPath(DICTIONARIES[DEFAULT_LOCALE], key);
    if (fallback !== undefined) return interpolate(fallback, vars);
  }

  // 3. 开发期提示:返回 key
  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.warn(`[i18n] missing key: ${key} (locale=${locale})`);
  }
  return key;
}

/**
 * useI18n — 组件内使用,从 settings store 读 locale
 * 返回 { locale, setLocale, t },locale 切换会自动触发重渲染
 */
export function useI18n() {
  const language = useStoreState(settingsStore, (s) => s.language) as Locale | undefined;
  const locale: Locale = useMemo(() => {
    if (language && SUPPORTED_LOCALES.includes(language)) return language;
    return detectLocale();
  }, [language]);

  const t = useCallback(
    (key: string, vars?: TranslateVars) => translate(locale, key, vars),
    [locale]
  );

  return {
    locale,
    t,
  };
}
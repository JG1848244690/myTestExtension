/**
 * 浏览器语言检测
 *
 * navigator.language 返回形如 'zh-CN' / 'en-US' / 'en' / 'zh'。
 * 策略:
 *   1. 精确匹配 'zh-CN' / 'zh_CN' → 'zh_CN'
 *   2. 以 'zh' 开头(港、台、新马等) → 默认归 zh_CN(本扩展主用户群)
 *   3. 以 'en' 开头 → 'en'
 *   4. 其余 → DEFAULT_LOCALE('en')
 *
 * 在 SSR / 测试场景 navigator 未定义时返回 DEFAULT_LOCALE。
 */

import { DEFAULT_LOCALE, type Locale } from './types';

export function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;

  const raw = (navigator.language || '').toLowerCase().trim();
  if (!raw) return DEFAULT_LOCALE;

  if (raw === 'zh-cn' || raw === 'zh_cn') return 'zh_CN';
  if (raw.startsWith('zh')) return 'zh_CN';
  if (raw.startsWith('en')) return 'en';

  return DEFAULT_LOCALE;
}
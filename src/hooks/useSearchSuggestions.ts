/**
 * 搜索建议 hook
 *
 * 职责：管理 query 状态、按 engine 拉取搜索建议、合并本地历史与快捷方式，
 * 自动 debounce + 清理。所有建议分组都通过 SuggestionGroup[] 返回。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  SearchEngineType,
  Shortcut,
} from '@/src/utils/types';
import type { SearchHistoryItem } from '@/src/store/history';
import { useI18n } from '@/src/i18n';

export interface SuggestionItem {
  id: string;
  text: string;
  type: 'history' | 'shortcut' | 'suggestion';
  /** 仅 shortcut 类型有 URL，可点击直接打开 */
  url?: string;
}

export interface SuggestionGroup {
  title: string;
  items: SuggestionItem[];
}

interface UseSearchSuggestionsParams {
  engine: SearchEngineType;
  history: SearchHistoryItem[];
  shortcuts: Shortcut[];
  debounceMs?: number;
}

interface UseSearchSuggestionsReturn {
  query: string;
  setQuery: (q: string) => void;
  groups: SuggestionGroup[];
  setGroups: React.Dispatch<React.SetStateAction<SuggestionGroup[]>>;
  isLoading: boolean;
}

const SUGGESTION_APIS: Record<
  SearchEngineType,
  { url: (q: string) => string; jsonp: boolean }
> = {
  baidu: {
    url: (q) => `https://suggestion.baidu.com/su?wd=${encodeURIComponent(q)}&cb=jsonp_callback`,
    jsonp: true,
  },
  bing: {
    url: (q) => `https://api.bing.com/osjson.aspx?query=${encodeURIComponent(q)}`,
    jsonp: false,
  },
  google: {
    url: (q) => `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(q)}`,
    jsonp: false,
  },
};

export function useSearchSuggestions({
  engine,
  history,
  shortcuts,
  debounceMs = 150,
}: UseSearchSuggestionsParams): UseSearchSuggestionsReturn {
  const { locale } = useI18n();
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<SuggestionGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const jsonpCallbackRef = useRef<string>('');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // JSONP: 百度建议
  const fetchBaiduSuggestions = useCallback((keyword: string): Promise<string[]> => {
    return new Promise((resolve) => {
      if (jsonpCallbackRef.current) {
        const oldScript = document.getElementById(jsonpCallbackRef.current);
        if (oldScript) oldScript.remove();
        delete (window as unknown as Record<string, unknown>)[jsonpCallbackRef.current];
      }

      const callbackName = `jsonp_callback_${Date.now()}`;
      jsonpCallbackRef.current = callbackName;

      (window as unknown as Record<string, unknown>)[callbackName] = (data: { s?: string[] }) => {
        resolve(data.s || []);
        const script = document.getElementById(callbackName);
        if (script) script.remove();
        delete (window as unknown as Record<string, unknown>)[callbackName];
      };

      const script = document.createElement('script');
      script.id = callbackName;
      script.src = SUGGESTION_APIS.baidu.url(keyword);
      script.onerror = () => {
        resolve([]);
        script.remove();
        delete (window as unknown as Record<string, unknown>)[callbackName];
      };
      document.body.appendChild(script);
    });
  }, []);

  // 通用搜索建议获取（Bing/Google/Baidu）
  const fetchSearchSuggestions = useCallback(
    async (keyword: string): Promise<string[]> => {
      if (!keyword.trim()) return [];

      const apiConfig = SUGGESTION_APIS[engine];
      if (!apiConfig) return [];

      try {
        if (apiConfig.jsonp) {
          return await fetchBaiduSuggestions(keyword);
        }
        const response = await fetch(apiConfig.url(keyword));
        const data = await response.json();
        if (Array.isArray(data) && Array.isArray(data[1])) {
          return data[1].slice(0, 10);
        }
        return [];
      } catch {
        return [];
      }
    },
    [engine, fetchBaiduSuggestions]
  );

  // 构造本地建议分组（历史 + 快捷方式）
  const generateSuggestionGroups = useCallback((): SuggestionGroup[] => {
    const result: SuggestionGroup[] = [];
    const lowerQuery = query.toLowerCase().trim();

    const historyMatches = lowerQuery
      ? history.filter((h) => h.query.toLowerCase().includes(lowerQuery))
      : history.slice(0, 5);

    if (historyMatches.length > 0) {
      result.push({
        title: '历史记录',
        items: historyMatches.slice(0, 5).map((h) => ({
          id: `history-${h.query}`,
          text: h.query,
          type: 'history' as const,
        })),
      });
    }

    if (lowerQuery && shortcuts.length > 0) {
      const shortcutMatches = shortcuts
        .filter(
          (s) =>
            s.name.toLowerCase().includes(lowerQuery) ||
            s.url.toLowerCase().includes(lowerQuery)
        )
        .slice(0, 3);

      if (shortcutMatches.length > 0) {
        result.push({
          title: '快捷方式',
          items: shortcutMatches.map((s) => ({
            id: `shortcut-${s.id}`,
            text: s.name,
            type: 'shortcut' as const,
            url: s.url,
          })),
        });
      }
    }

    return result;
  }, [query, history, shortcuts]);
  // 注:title 字段保留中文占位('历史记录'/'快捷方式'),实际渲染由 SuggestionDropdown
  // 根据 item.type 调用 i18n.t() 重新本地化。locale 变化触发 effect 重生 groups 时一并刷新。

  // debounce 更新
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      const localGroups = generateSuggestionGroups();
      const lowerQuery = query.toLowerCase().trim();
      const next: SuggestionGroup[] = [...localGroups];

      if (lowerQuery.length >= 1) {
        setIsLoading(true);
        try {
          const apiSuggestions = await fetchSearchSuggestions(query);
          if (apiSuggestions.length > 0) {
            const insertIndex =
              localGroups.length > 0 && localGroups[0].title === '历史记录' ? 1 : 0;
            next.splice(insertIndex, 0, {
              title: '搜索建议',
              items: apiSuggestions.slice(0, 5).map((s) => ({
                id: `suggestion-${s}`,
                text: s,
                type: 'suggestion' as const,
              })),
            });
          }
        } finally {
          setIsLoading(false);
        }
      }

      setGroups(next);
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, debounceMs, generateSuggestionGroups, fetchSearchSuggestions, locale]);

  // query 清空时也要清空 groups（避免脏数据）
  useEffect(() => {
    if (!query) {
      setGroups([]);
      setIsLoading(false);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    }
  }, [query]);

  return {
    query,
    setQuery,
    groups,
    setGroups,
    isLoading,
  };
}
import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Search, Clock, X, ArrowRight, Globe, Loader2, TrendingUp } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import { useHistoryStore } from '@/src/hooks/useHistoryStore';
import type { SearchEngineType, SearchEngineOption, Shortcut } from '@/src/utils/types';
import { cn } from '@/src/lib/utils';
import { notifyNewtabNavigated } from '@/src/utils/navigationReset';

interface SearchBarProps {
  engine: SearchEngineType;
  engineOption: SearchEngineOption;
  engineOptions: SearchEngineOption[];
  onEngineChange: (engine: SearchEngineType) => void;
  onSearch: (query: string) => void;
  shortcuts?: Shortcut[];
}

interface SuggestionItem {
  id: string;
  text: string;
  type: 'history' | 'shortcut' | 'suggestion';
  icon: React.ReactNode;
  url?: string;
}

interface SuggestionGroup {
  title: string;
  items: SuggestionItem[];
}

const SUGGESTION_APIS = {
  baidu: {
    url: (q: string) => `https://suggestion.baidu.com/su?wd=${encodeURIComponent(q)}&cb=jsonp_callback`,
    jsonp: true,
  },
  bing: {
    url: (q: string) => `https://api.bing.com/osjson.aspx?query=${encodeURIComponent(q)}`,
    jsonp: false,
  },
  google: {
    url: (q: string) => `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(q)}`,
    jsonp: false,
  },
};

export function SearchBar({
  engine,
  engineOption,
  engineOptions,
  onEngineChange,
  onSearch,
  shortcuts = [],
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [suggestionGroups, setSuggestionGroups] = useState<SuggestionGroup[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const suggestionsListRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const jsonpCallbackRef = useRef<string>('');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const { history, addHistory, clearHistory, removeHistoryItem } = useHistoryStore();

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

  const fetchSearchSuggestions = useCallback(async (keyword: string): Promise<string[]> => {
    if (!keyword.trim()) return [];

    const apiConfig = SUGGESTION_APIS[engine];
    if (!apiConfig) return [];

    try {
      if (apiConfig.jsonp) {
        return await fetchBaiduSuggestions(keyword);
      } else {
        const response = await fetch(apiConfig.url(keyword));
        const data = await response.json();
        if (Array.isArray(data) && Array.isArray(data[1])) {
          return data[1].slice(0, 10);
        }
        return [];
      }
    } catch {
      return [];
    }
  }, [engine, fetchBaiduSuggestions]);

  const generateSuggestionGroups = useCallback((): SuggestionGroup[] => {
    const groups: SuggestionGroup[] = [];
    const lowerQuery = query.toLowerCase().trim();

    const historyMatches = lowerQuery
      ? history.filter((h) => h.query.toLowerCase().includes(lowerQuery))
      : history.slice(0, 5);

    if (historyMatches.length > 0) {
      groups.push({
        title: '历史记录',
        items: historyMatches.slice(0, 5).map((h) => ({
          id: `history-${h.query}`,
          text: h.query,
          type: 'history' as const,
          icon: <Clock className="w-4 h-4 text-muted-foreground" />,
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
        groups.push({
          title: '快捷方式',
          items: shortcutMatches.map((s) => ({
            id: `shortcut-${s.id}`,
            text: s.name,
            type: 'shortcut' as const,
            icon: <Globe className="w-4 h-4 text-primary" />,
            url: s.url,
          })),
        });
      }
    }

    return groups;
  }, [query, history, shortcuts]);

  const updateSuggestions = useCallback(async () => {
    const groups = generateSuggestionGroups();
    const lowerQuery = query.toLowerCase().trim();
    const newGroups = [...groups];

    if (lowerQuery.length >= 1) {
      setIsLoadingSuggestions(true);
      try {
        const apiSuggestions = await fetchSearchSuggestions(query);

        if (apiSuggestions.length > 0) {
          const insertIndex = groups.length > 0 && groups[0].title === '历史记录' ? 1 : 0;

          newGroups.splice(insertIndex, 0, {
            title: '搜索建议',
            items: apiSuggestions.slice(0, 5).map((s) => ({
              id: `suggestion-${s}`,
              text: s,
              type: 'suggestion' as const,
              icon: <TrendingUp className="w-4 h-4 text-orange-500" />,
            })),
          });
        }
      } finally {
        setIsLoadingSuggestions(false);
      }
    }

    setSuggestionGroups(newGroups);
  }, [query, generateSuggestionGroups, fetchSearchSuggestions]);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (showSuggestions) {
      debounceRef.current = setTimeout(() => {
        updateSuggestions();
      }, 150);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, showSuggestions, updateSuggestions]);

  // 清空 item refs 当建议列表变化时
  useEffect(() => {
    itemRefs.current.clear();
  }, [suggestionGroups]);

  useEffect(() => {
    if (showSuggestions && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
      });
    }
  }, [showSuggestions, suggestionGroups]);

  const handleSearch = (searchQuery?: string) => {
    const finalQuery = searchQuery || query;
    if (!finalQuery.trim()) return;

    addHistory(finalQuery);
    onSearch(finalQuery);
    setShowSuggestions(false);
    setQuery(finalQuery);
  };

  const handleSuggestionClick = (item: SuggestionItem) => {
    if (item.type === 'shortcut' && item.url) {
      window.open(item.url, '_blank');
      notifyNewtabNavigated();
      setShowSuggestions(false);
    } else {
      setQuery(item.text);
      handleSearch(item.text);
    }
  };

  const getGlobalIndex = (groupIndex: number, itemIndex: number): number => {
    let total = 0;
    for (let i = 0; i < groupIndex; i++) {
      total += suggestionGroups[i].items.length;
    }
    return total + itemIndex;
  };

  const findItemByGlobalIndex = (globalIndex: number) => {
    let currentIndex = 0;
    for (const group of suggestionGroups) {
      for (let i = 0; i < group.items.length; i++) {
        if (currentIndex === globalIndex) {
          return { group, item: group.items[i], itemIndex: i };
        }
        currentIndex++;
      }
    }
    return null;
  };

  // 滚动选中的项到可见区域
  const scrollToSelectedItem = (index: number) => {
    const doScroll = () => {
      const itemElement = itemRefs.current.get(index);
      if (itemElement && suggestionsListRef.current) {
        const container = suggestionsListRef.current;
        const itemTop = itemElement.offsetTop;
        const itemHeight = itemElement.offsetHeight;
        const containerScrollTop = container.scrollTop;
        const containerHeight = container.clientHeight;

        // 如果项在可视区域上方
        if (itemTop < containerScrollTop) {
          container.scrollTo({ top: itemTop, behavior: 'instant' });
        }
        // 如果项在可视区域下方
        else if (itemTop + itemHeight > containerScrollTop + containerHeight) {
          container.scrollTo({ top: itemTop - containerHeight + itemHeight, behavior: 'instant' });
        }
      }
    };

    // 如果 ref 还没设置好，延迟重试
    if (!itemRefs.current.has(index)) {
      setTimeout(() => doScroll(), 10);
    } else {
      doScroll();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const totalItems = suggestionGroups.reduce((sum, g) => sum + g.items.length, 0);

    if (totalItems === 0) {
      if (e.key === 'Enter') {
        handleSearch();
      }
      return;
    }

    // 确保 selectedIndex 在有效范围内
    const safeIndex = Math.min(selectedIndex, totalItems - 1);
    let newIndex = safeIndex;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        newIndex = safeIndex < totalItems - 1 ? safeIndex + 1 : 0;
        break;
      case 'ArrowUp':
        e.preventDefault();
        newIndex = safeIndex > 0 ? safeIndex - 1 : totalItems - 1;
        break;
      case 'Enter':
        e.preventDefault();
        if (safeIndex >= 0) {
          const found = findItemByGlobalIndex(safeIndex);
          if (found) {
            handleSuggestionClick(found.item);
          }
        } else {
          handleSearch();
        }
        return;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        return;
    }

    setSelectedIndex(newIndex);
    // 延迟滚动，确保 DOM 已更新
    setTimeout(() => scrollToSelectedItem(newIndex), 0);
  };

  useEffect(() => {
    setSelectedIndex(-1);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRemoveHistory = (e: React.MouseEvent, queryText: string) => {
    e.stopPropagation();
    removeHistoryItem(queryText);
  };

  return (
    <>
      <div ref={containerRef} className="w-full relative">
        <div
          className={cn(
            "flex items-center gap-2 p-2 rounded-xl transition-all duration-200",
            "bg-white/10 dark:bg-black/10 backdrop-blur-xl",
            "border border-white/20 dark:border-black/10",
            "shadow-lg shadow-black/5 dark:shadow-black/20",
            showSuggestions && query
              ? "ring-2 ring-primary/30 shadow-xl"
              : "hover:shadow-xl hover:shadow-black/10 dark:hover:shadow-black/30"
          )}
        >
          <Select value={engine} onValueChange={(value) => onEngineChange(value as SearchEngineType)}>
            <SelectTrigger className="w-[100px] border-0 bg-transparent focus:ring-0 shrink-0 hover:bg-accent/50 rounded-xl transition-colors">
              <SelectValue>
                <span className="text-sm truncate">{engineOption.name}</span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="z-[10000]">
              {engineOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.icon} {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="w-px h-8 bg-border/50 shrink-0" />

          <div className="flex-1 min-w-0 relative">
            <Input
              ref={inputRef}
              type="text"
              placeholder="搜索或直接访问网址..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleKeyDown}
              className={cn(
                "w-full border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0",
                "text-base placeholder:text-muted-foreground pr-6"
              )}
            />
            {isLoadingSuggestions && (
              <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </div>

          <Button
            onClick={() => handleSearch()}
            disabled={!query.trim()}
            className="rounded-xl px-6 shrink-0
              bg-primary/90 hover:bg-primary
              shadow-md shadow-primary/20
              transition-all duration-300
              hover:shadow-lg hover:shadow-primary/30
              disabled:opacity-50 disabled:shadow-none"
          >
            <Search className="w-4 h-4 mr-2" />
            搜索
          </Button>
        </div>

        {showSuggestions && suggestionGroups.length > 0 && createPortal(
          <div
            ref={suggestionsRef}
            className="fixed z-[10001]
              bg-white/10 dark:bg-black/10 backdrop-blur-xl
              border border-white/20 dark:border-black/10 rounded-xl shadow-2xl
              overflow-hidden animate-in fade-in-0 slide-in-from-top-2 duration-200"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
              maxHeight: '400px',
            }}
          >
            <div ref={suggestionsListRef} className="overflow-y-auto max-h-[360px]">
              {suggestionGroups.map((group, groupIndex) => (
                <div key={group.title}>
                  <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/30">
                    {group.title}
                  </div>

                  {group.items.map((item, itemIndex) => {
                    const globalIndex = getGlobalIndex(groupIndex, itemIndex);
                    const isSelected = selectedIndex === globalIndex;

                    return (
                      <div
                        key={item.id}
                        ref={(el) => {
                          if (el) itemRefs.current.set(globalIndex, el);
                        }}
                        onClick={() => handleSuggestionClick(item)}
                        onMouseEnter={() => {
                          setSelectedIndex(globalIndex);
                          scrollToSelectedItem(globalIndex);
                        }}
                        className={cn(
                          "flex items-center justify-between px-3 py-2.5 cursor-pointer transition-all duration-100",
                          isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                            isSelected ? "bg-primary/20" : "bg-muted"
                          )}>
                            {item.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{item.text}</div>
                            {item.url && (
                              <div className="text-xs text-muted-foreground truncate">
                                {item.url.replace(/^https?:\/\//, '').split('/')[0]}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          {item.type === 'history' && (
                            <button
                              onClick={(e) => handleRemoveHistory(e, item.text)}
                              className={cn(
                                "p-1.5 rounded-md transition-colors",
                                isSelected ? "hover:bg-primary/20" : "hover:bg-muted"
                              )}
                              title="删除"
                            >
                              <X className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                          )}
                          <div className={cn(
                            "p-1.5 rounded-md transition-colors",
                            isSelected ? "bg-primary/20" : ""
                          )}>
                            <ArrowRight className={cn(
                              "w-3.5 h-3.5 transition-all",
                              isSelected ? "text-primary translate-x-0.5" : "text-muted-foreground"
                            )} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between px-3 py-2 border-t border-white/20 dark:border-black/10 bg-white/10 dark:bg-black/10 text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">↑↓</kbd>
                  导航
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">Enter</kbd>
                  确认
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">Esc</kbd>
                  关闭
                </span>
              </div>
              {history.length > 0 && (
                <button
                  onClick={() => {
                    clearHistory();
                    setSuggestionGroups([]);
                  }}
                  className="hover:text-destructive transition-colors"
                >
                  清空历史
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
      </div>
    </>
  );
}
